import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { analyzeCommits } from '../src/main/analysis/analyzeCommits'
import { resolveServerPath, validateMappingProfile } from '../src/main/mapping/resolveServerPath'
import {
  listProfileNames,
  loadProfile,
  seedDefaultProfileIfEmpty
} from '../src/main/mapping/profileStore'
import type { MappingProfile } from '../src/main/mapping/types'

function sh(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString().trim()
}

function writeFile(dir: string, relPath: string, content: string): void {
  const fullPath = join(dir, relPath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content, 'utf8')
}

interface Fixture {
  dir: string
  hashes: Record<string, string>
}

function setupRepo(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'gde-phase2-'))
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

  // C1 (root commit, 부모 없음)
  writeFile(dir, 'shared.txt', 'v1')
  writeFile(dir, 'other.txt', 'other v1')
  commit('c1_root', 'root: shared.txt, other.txt 추가')

  // C2, C3: shared.txt를 두 커밋에 걸쳐 반복 수정 (중복 제거 테스트),
  // C3에서 other.txt 삭제
  writeFile(dir, 'shared.txt', 'v2')
  commit('c2_modify', 'shared.txt 수정 1')

  writeFile(dir, 'shared.txt', 'v3')
  execFileSync('git', ['rm', '-q', 'other.txt'], { cwd: dir })
  commit('c3_modify_and_delete', 'shared.txt 수정 2, other.txt 삭제')

  // feature 브랜치: featureOnly.txt 추가 (나중에 merge)
  sh(dir, ['checkout', '-q', '-b', 'feature'])
  writeFile(dir, 'featureOnly.txt', 'feature content')
  commit('c4_feature', 'feature: featureOnly.txt 추가')

  // main으로 돌아와 mainOnly.txt 추가 (feature와 분기)
  sh(dir, ['checkout', '-q', 'main'])
  writeFile(dir, 'mainOnly.txt', 'main only content')
  commit('c5_main_only', 'main: mainOnly.txt 추가')

  // merge (첫 번째 부모는 c5_main_only)
  sh(dir, ['merge', '-q', '--no-ff', 'feature', '-m', 'merge feature into main'])
  hashes['c6_merge'] = sh(dir, ['rev-parse', 'HEAD'])

  // rename (감지 없이 D+A로 나와야 함, DR-008)
  execFileSync('git', ['mv', 'mainOnly.txt', 'mainOnlyRenamed.txt'], { cwd: dir })
  commit('c7_rename', 'mainOnly.txt -> mainOnlyRenamed.txt rename')

  // temp 파일: 추가 후 다음 커밋에서 삭제 (삭제 커밋은 분석 대상에서 제외해
  // "선택된 커밋에서는 added인데 HEAD엔 없음" 상황을 재현)
  writeFile(dir, 'tempWillBeDeleted.txt', 'temp')
  commit('c8_add_temp', 'tempWillBeDeleted.txt 추가')

  execFileSync('git', ['rm', '-q', 'tempWillBeDeleted.txt'], { cwd: dir })
  commit('c9_delete_temp_unselected', 'tempWillBeDeleted.txt 삭제 (분석에서 선택 안 함)')

  return { dir, hashes }
}

async function verifyAnalysisEngine(fixture: Fixture): Promise<void> {
  const { dir, hashes } = fixture

  console.log('-- 케이스 1: 동일 파일이 여러 커밋에서 수정된 경우 (중복 제거, REQ-006/DR-004) --')
  const dedupResult = await analyzeCommits(dir, 'main', [
    hashes.c2_modify,
    hashes.c3_modify_and_delete
  ])
  console.log(JSON.stringify(dedupResult, null, 2))
  assert.equal(dedupResult.deployTargets.length, 1)
  assert.equal(dedupResult.deployTargets[0].path, 'shared.txt')
  assert.equal(dedupResult.deployTargets[0].status, 'modified')
  assert.deepEqual(dedupResult.deleteList, ['other.txt'])
  assert.equal(dedupResult.warnings.length, 0)

  console.log('\n-- 케이스 2: Merge 커밋이 섞인 경우 (첫 번째 부모 기준, §3.3) --')
  const mergeResult = await analyzeCommits(dir, 'main', [hashes.c6_merge])
  console.log(JSON.stringify(mergeResult, null, 2))
  assert.equal(mergeResult.deployTargets.length, 1)
  assert.equal(mergeResult.deployTargets[0].path, 'featureOnly.txt')
  assert.equal(
    mergeResult.deployTargets[0].status,
    'added',
    'merge commit 자체 기준 첫 커밋이므로 added'
  )
  assert.deepEqual(
    mergeResult.deleteList,
    [],
    'mainOnly.txt는 첫 번째 부모(c5)에서 이미 생겼으므로 merge commit의 diff에는 나오지 않아야 함'
  )

  console.log('\n-- 케이스 3: Rename이 Delete+Add 두 줄로 나오는지 (DR-008) --')
  const renameResult = await analyzeCommits(dir, 'main', [hashes.c7_rename])
  console.log(JSON.stringify(renameResult, null, 2))
  assert.deepEqual(renameResult.deleteList, ['mainOnly.txt'])
  assert.equal(renameResult.deployTargets.length, 1)
  assert.equal(renameResult.deployTargets[0].path, 'mainOnlyRenamed.txt')
  assert.equal(renameResult.deployTargets[0].status, 'added')

  console.log('\n-- 케이스 4: HEAD에 없는 파일 Warning (DR-009) --')
  const warningResult = await analyzeCommits(dir, 'main', [hashes.c8_add_temp])
  console.log(JSON.stringify(warningResult, null, 2))
  assert.equal(warningResult.deployTargets.length, 0)
  assert.equal(warningResult.deleteList.length, 0)
  assert.equal(warningResult.warnings.length, 1)
  assert.equal(warningResult.warnings[0].path, 'tempWillBeDeleted.txt')

  console.log('\n-- 케이스 4-1(추가 확인): Root Commit(부모 없음) 처리 --')
  const rootResult = await analyzeCommits(dir, 'main', [hashes.c1_root])
  console.log(JSON.stringify(rootResult, null, 2))
  assert.equal(rootResult.deployTargets.length, 1)
  assert.equal(rootResult.deployTargets[0].path, 'shared.txt')
  assert.equal(rootResult.deployTargets[0].status, 'added')
  assert.equal(
    rootResult.warnings.length,
    1,
    'other.txt는 root commit에서는 added지만 c3에서 삭제되어 HEAD엔 없음 -> Warning'
  )
  assert.equal(rootResult.warnings[0].path, 'other.txt')
}

function verifyMappingEngine(): void {
  console.log(
    '\n-- 케이스 5: Mapping Profile override가 있는 경로/없는 경로 (REQ-008, DR-010~012) --'
  )

  const profile: MappingProfile = {
    profileName: 'test-profile',
    version: '1.0',
    overrides: [
      { from: 'config/deploy-only.properties', to: 'config/override/deploy-only.properties' },
      // DR-011/012 경로에 실수로 override를 넣어도 무시되어야 함
      { from: 'src/main/java/com/example/Ignored.java', to: 'should-not-be-used' }
    ]
  }

  const javaPath = resolveServerPath(
    'src/main/java/com/example/sell/GuaranteeListController.java',
    profile
  )
  console.log('java path ->', javaPath)
  assert.equal(javaPath, 'src/main/java/com/example/sell/GuaranteeListController.java')

  const resourcesPath = resolveServerPath('src/main/resources/static/js/guarantee/list.js', profile)
  console.log('resources path ->', resourcesPath)
  assert.equal(resourcesPath, 'src/main/resources/static/js/guarantee/list.js')

  const ignoredOverridePath = resolveServerPath('src/main/java/com/example/Ignored.java', profile)
  console.log('java path with matching override (무시되어야 함) ->', ignoredOverridePath)
  assert.equal(ignoredOverridePath, 'src/main/java/com/example/Ignored.java')

  const overriddenPath = resolveServerPath('config/deploy-only.properties', profile)
  console.log('override 적용 경로 ->', overriddenPath)
  assert.equal(overriddenPath, 'config/override/deploy-only.properties')

  const identityPath = resolveServerPath('config/no-override.properties', profile)
  console.log('override 없는 경로(identity) ->', identityPath)
  assert.equal(identityPath, 'config/no-override.properties')

  console.log('\n-- validateMappingProfile: 중복 from 거부 --')
  assert.throws(() =>
    validateMappingProfile({
      profileName: 'dup',
      version: '1.0',
      overrides: [
        { from: 'a.txt', to: 'b.txt' },
        { from: 'a.txt', to: 'c.txt' }
      ]
    })
  )
  console.log('중복 from에서 정상적으로 에러 발생 확인')
}

async function verifyProfileStore(): Promise<void> {
  console.log('\n-- 케이스 6: Profile 저장소 (§1.3) --')
  const profilesDir = mkdtempSync(join(tmpdir(), 'gde-phase2-profiles-'))
  try {
    let names = await listProfileNames(profilesDir)
    assert.deepEqual(names, [])

    await seedDefaultProfileIfEmpty(profilesDir)
    names = await listProfileNames(profilesDir)
    console.log('시드 후 프로필 목록:', names)
    assert.deepEqual(names, ['default'])

    const loaded = await loadProfile(profilesDir, 'default')
    console.log('로드된 default 프로필:', loaded)
    assert.equal(loaded.profileName, 'default')
    assert.deepEqual(loaded.overrides, [])

    // 이미 파일이 있으면 재시드하지 않는다
    const raw = readFileSync(join(profilesDir, 'default.json'), 'utf8')
    await seedDefaultProfileIfEmpty(profilesDir)
    const rawAfter = readFileSync(join(profilesDir, 'default.json'), 'utf8')
    assert.equal(raw, rawAfter, '이미 파일이 있으면 덮어쓰지 않아야 함')
  } finally {
    rmSync(profilesDir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  console.log('=== Phase 2 검증: Commit 분석 엔진 + Mapping Rule 엔진 ===\n')
  const fixture = setupRepo()
  try {
    await verifyAnalysisEngine(fixture)
    verifyMappingEngine()
    await verifyProfileStore()
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
