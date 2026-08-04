import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { listBranches, pickDefaultBranch } from '../src/main/git/repository'
import { listCommits, getDefaultDateRange } from '../src/main/git/commits'
import { computeDeployPlan } from '../src/main/analysis/computeDeployPlan'
import { buildPackage } from '../src/main/package/buildPackage'
import type { MappingProfile } from '../src/main/mapping/types'

function sh(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString().trim()
}

function writeFile(dir: string, relPath: string, content: Buffer | string): void {
  const fullPath = join(dir, relPath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

interface Fixture {
  dir: string
  hashes: Record<string, string>
}

function setupRepo(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'gde-phase3-'))
  sh(dir, ['init', '-q'])
  sh(dir, ['config', 'user.email', 'test@example.com'])
  sh(dir, ['config', 'user.name', 'Tester'])
  sh(dir, ['checkout', '-q', '-b', 'main'])

  const hashes: Record<string, string> = {}
  const commit = (key: string, message: string): void => {
    sh(dir, ['add', '-A'])
    sh(dir, ['commit', '-q', '-m', message])
    hashes[key] = sh(dir, ['rev-parse', 'HEAD'])
  }

  // Spring 표준 구조 파일 (DR-011/012, 경로 그대로 유지되어야 함)
  writeFile(
    dir,
    'src/main/java/com/example/sell/GuaranteeListController.java',
    'class GuaranteeListController {}'
  )
  writeFile(dir, 'src/main/resources/static/js/guarantee/list.js', 'console.log("v1")')

  // Mapping Profile override 대상 (Spring 표준 구조 밖)
  writeFile(dir, 'config/deploy-only.properties', 'key=v1')

  // CRLF 텍스트 (Windows 저장 시뮬레이션) + 바이너리 파일 — §4.2 바이트 보존 확인용
  writeFile(dir, 'crlf.txt', Buffer.from('line1\r\nline2\r\nline3\r\n'))
  writeFile(
    dir,
    'binary.dat',
    Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )

  // 삭제될 파일
  writeFile(dir, 'old.js', 'legacy')

  commit('c1', '초기 파일 세트 추가')

  writeFile(dir, 'src/main/resources/static/js/guarantee/list.js', 'console.log("v2")')
  execFileSync('git', ['rm', '-q', 'old.js'], { cwd: dir })
  commit('c2', 'list.js 수정, old.js 삭제')

  return { dir, hashes }
}

async function verifyByteFidelityAndExportFiles(fixture: Fixture): Promise<string> {
  console.log('-- (a) 바이트 단위 동일성 + Export 3종 UTF-8/LF --')
  const { dir, hashes } = fixture

  const profile: MappingProfile = {
    profileName: 'test-profile',
    version: '1.0',
    overrides: [
      { from: 'config/deploy-only.properties', to: 'config/override/deploy-only.properties' }
    ]
  }

  const plan = await computeDeployPlan(dir, 'main', [hashes.c1, hashes.c2], profile)
  console.log('plan:', JSON.stringify(plan, null, 2))

  const result = await buildPackage({
    repoPath: dir,
    branch: 'main',
    mappingProfileName: profile.profileName,
    selectedCommits: [
      { hash: hashes.c1, author: 'Tester', date: '2026-01-01T00:00:00+09:00', message: 'c1' },
      { hash: hashes.c2, author: 'Tester', date: '2026-01-02T00:00:00+09:00', message: 'c2' }
    ],
    files: plan.files,
    deletedServerPaths: plan.deletedServerPaths,
    warnings: plan.warnings
  })

  console.log('deployDir:', result.deployDir)

  // 원본 git 저장소의 파일과 deploy/ 산출물이 바이트 단위로 동일한지 확인
  const compare = (relPath: string, serverRelPath: string = relPath): void => {
    const original = readFileSync(join(dir, relPath))
    const copied = readFileSync(join(result.deployDir, serverRelPath))
    assert.equal(Buffer.compare(original, copied), 0, `${relPath} 바이트 불일치`)
  }
  compare('crlf.txt')
  compare('binary.dat')
  compare('src/main/java/com/example/sell/GuaranteeListController.java')
  compare('src/main/resources/static/js/guarantee/list.js')
  compare('config/deploy-only.properties', 'config/override/deploy-only.properties')
  console.log('바이트 단위 동일성 확인 완료 (crlf/binary/java/resources/override 경로 5종)')

  // DR-011/012: Spring 표준 구조는 경로 그대로
  assert.ok(
    existsSync(
      join(result.deployDir, 'src/main/java/com/example/sell/GuaranteeListController.java')
    )
  )
  assert.ok(existsSync(join(result.deployDir, 'src/main/resources/static/js/guarantee/list.js')))
  // Mapping override 적용 확인 + 원래 경로에는 파일이 없어야 함
  assert.ok(existsSync(join(result.deployDir, 'config/override/deploy-only.properties')))
  assert.ok(!existsSync(join(result.deployDir, 'config/deploy-only.properties')))

  // Export 3종 파일: UTF-8(BOM 없음), LF
  for (const name of ['deploy-files.txt', 'delete-list.txt', 'deploy-summary.json']) {
    const raw = readFileSync(join(result.deployDir, name))
    assert.ok(
      !(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf),
      `${name}에 UTF-8 BOM이 있으면 안 됨`
    )
    const text = raw.toString('utf8')
    assert.ok(!text.includes('\r\n'), `${name}에 CRLF가 있으면 안 됨`)
  }

  const deployFilesTxt = readFileSync(join(result.deployDir, 'deploy-files.txt'), 'utf8')
  console.log('deploy-files.txt:\n' + deployFilesTxt)
  assert.ok(deployFilesTxt.includes('config/override/deploy-only.properties'))

  const deleteListTxt = readFileSync(join(result.deployDir, 'delete-list.txt'), 'utf8')
  console.log('delete-list.txt:\n' + deleteListTxt)
  assert.equal(deleteListTxt.trim(), 'old.js')

  const summaryJson = JSON.parse(
    readFileSync(join(result.deployDir, 'deploy-summary.json'), 'utf8')
  )
  console.log('deploy-summary.json summary:', summaryJson.summary)
  assert.equal(summaryJson.summary.files, result.summary.files.length)
  assert.equal(summaryJson.summary.deleted, 1)
  assert.equal(summaryJson.mappingProfile, 'test-profile')
  assert.equal(summaryJson.commits.length, 2)

  return dir
}

async function verifyReExportWipesStaleFiles(dir: string): Promise<void> {
  console.log('\n-- (b) 재실행 시 이전 잔여 파일 제거 --')
  const profile: MappingProfile = { profileName: 'default', version: '1.0', overrides: [] }

  // 이번엔 딱 하나의 파일만 선택 대상으로 잡히도록, crlf.txt만 건드리는 새 커밋을 판다
  writeFile(dir, 'crlf.txt', Buffer.from('line1\r\nchanged\r\n'))
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync('git', ['commit', '-q', '-m', 'crlf.txt만 재수정'], { cwd: dir })
  const onlyCrlfHash = sh(dir, ['rev-parse', 'HEAD'])

  const plan = await computeDeployPlan(dir, 'main', [onlyCrlfHash], profile)
  const result = await buildPackage({
    repoPath: dir,
    branch: 'main',
    mappingProfileName: profile.profileName,
    selectedCommits: [],
    files: plan.files,
    deletedServerPaths: plan.deletedServerPaths,
    warnings: plan.warnings
  })

  const staleJavaFile = join(
    result.deployDir,
    'src/main/java/com/example/sell/GuaranteeListController.java'
  )
  console.log('이전 실행에서 생성됐던 파일이 남아있는지:', existsSync(staleJavaFile))
  assert.ok(!existsSync(staleJavaFile), '이전 Export의 잔여 파일이 새 deploy/에 남아있으면 안 됨')
  assert.ok(existsSync(join(result.deployDir, 'crlf.txt')))
}

async function verifyCaseCollisionAborts(fixture: Fixture): Promise<void> {
  console.log('\n-- (c) 대소문자 충돌 시 에러로 중단 (§4.1) --')
  const { dir } = fixture

  // 서로 다른 두 로컬 경로가 같은(대소문자만 다른) 서버 경로로 매핑되도록 override 구성
  const collidingProfile: MappingProfile = {
    profileName: 'colliding',
    version: '1.0',
    overrides: [
      { from: 'crlf.txt', to: 'Config.txt' },
      { from: 'binary.dat', to: 'config.txt' }
    ]
  }

  const hashes = fixture.hashes
  const plan = await computeDeployPlan(dir, 'main', [hashes.c1], collidingProfile)

  // 충돌 시도 전, deploy/에 이전 정상 실행의 결과물이 남아있는지 스냅샷을 남겨서
  // "충돌하면 아무것도 건드리지 않고 중단한다"를 검증한다.
  const deployDir = join(dir, 'deploy')
  const beforeExists = existsSync(deployDir)
  const beforeSnapshot = beforeExists
    ? readFileSync(join(deployDir, 'deploy-files.txt'), 'utf8')
    : null

  await assert.rejects(
    () =>
      buildPackage({
        repoPath: dir,
        branch: 'main',
        mappingProfileName: collidingProfile.profileName,
        selectedCommits: [],
        files: plan.files,
        deletedServerPaths: plan.deletedServerPaths,
        warnings: plan.warnings
      }),
    /대소문자만 다른 경로 충돌/
  )
  console.log('예상대로 충돌 에러 발생, deploy/ 미변경 확인')

  if (beforeExists) {
    const afterSnapshot = readFileSync(join(deployDir, 'deploy-files.txt'), 'utf8')
    assert.equal(afterSnapshot, beforeSnapshot, '충돌 시 기존 deploy/가 변경되면 안 됨')
  } else {
    assert.ok(!existsSync(deployDir), '충돌 시 deploy/가 새로 생기면 안 됨')
  }
}

async function verifyFullPipeline(): Promise<void> {
  console.log('\n-- (d) Phase 1~3 전체 파이프라인 (Repository -> Commit 선택 -> deploy/) --')
  const dir = mkdtempSync(join(tmpdir(), 'gde-phase3-pipeline-'))
  try {
    sh(dir, ['init', '-q'])
    sh(dir, ['config', 'user.email', 'test@example.com'])
    sh(dir, ['config', 'user.name', 'Tester'])
    sh(dir, ['checkout', '-q', '-b', 'main'])
    writeFile(dir, 'src/main/resources/templates/guarantee/list.html', '<html></html>')
    execFileSync('git', ['add', '-A'], { cwd: dir })
    execFileSync('git', ['commit', '-q', '-m', 'guarantee html'], { cwd: dir })

    const branches = await listBranches(dir)
    const branch = pickDefaultBranch(branches)
    assert.equal(branch, 'main')

    const { startDate, endDate } = getDefaultDateRange()
    const { commits } = await listCommits({
      repoPath: dir,
      branch: branch!,
      startDate,
      endDate,
      maxCount: 100,
      skip: 0,
      pageSize: 100
    })
    assert.equal(commits.length, 1)

    const profile: MappingProfile = { profileName: 'default', version: '1.0', overrides: [] }
    const plan = await computeDeployPlan(
      dir,
      branch!,
      commits.map((c) => c.hash),
      profile
    )
    const result = await buildPackage({
      repoPath: dir,
      branch: branch!,
      mappingProfileName: profile.profileName,
      selectedCommits: commits,
      files: plan.files,
      deletedServerPaths: plan.deletedServerPaths,
      warnings: plan.warnings
    })

    assert.ok(
      existsSync(join(result.deployDir, 'src/main/resources/templates/guarantee/list.html'))
    )
    console.log('전체 파이프라인 정상 동작 확인:', result.deployDir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  console.log('=== Phase 3 검증: Package Builder ===\n')
  const fixture = setupRepo()
  try {
    const dir = await verifyByteFidelityAndExportFiles(fixture)
    await verifyReExportWipesStaleFiles(dir)
    await verifyCaseCollisionAborts(fixture)
    await verifyFullPipeline()
    console.log('\n=== 전체 통과 ===')
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error('\n=== 검증 실패 ===')
  console.error(error)
  process.exit(1)
})
