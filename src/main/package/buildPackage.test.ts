import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listBranches, pickDefaultBranch } from '../git/repository'
import { listCommits, getDefaultDateRange } from '../git/commits'
import { computeDeployPlan } from '../analysis/computeDeployPlan'
import { buildPackage } from './buildPackage'
import type { MappingProfile } from '../../shared/types'
import { cleanupRepo, commitAll, initRepo, writeFixtureFile } from '../testSupport/gitFixture'

// scripts/verify-phase3.ts (a)~(d)의 이식 — Package Builder.

describe('buildPackage', () => {
  let dir: string
  const hashes: Record<string, string> = {}

  beforeAll(() => {
    dir = initRepo('gde-package-')

    // Spring 표준 구조 파일(DR-011/012, 경로 그대로 유지되어야 함)
    writeFixtureFile(
      dir,
      'src/main/java/com/example/sell/GuaranteeListController.java',
      'class GuaranteeListController {}'
    )
    writeFixtureFile(dir, 'src/main/resources/static/js/guarantee/list.js', 'console.log("v1")')

    // Mapping Profile override 대상(Spring 표준 구조 밖)
    writeFixtureFile(dir, 'config/deploy-only.properties', 'key=v1')

    // CRLF 텍스트(Windows 저장 시뮬레이션) + 바이너리 파일 — §4.2 바이트 보존 확인용
    writeFixtureFile(dir, 'crlf.txt', Buffer.from('line1\r\nline2\r\nline3\r\n'))
    writeFixtureFile(
      dir,
      'binary.dat',
      Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )

    // 삭제될 파일
    writeFixtureFile(dir, 'old.js', 'legacy')

    hashes.c1 = commitAll(dir, '초기 파일 세트 추가')

    writeFixtureFile(dir, 'src/main/resources/static/js/guarantee/list.js', 'console.log("v2")')
    execFileSync('git', ['rm', '-q', 'old.js'], { cwd: dir })
    hashes.c2 = commitAll(dir, 'list.js 수정, old.js 삭제')
  })

  afterAll(() => cleanupRepo(dir))

  it('(a) 바이트 단위 동일성 + Export 3종 파일(UTF-8/LF, deploy-files/delete-list/summary)', async () => {
    const profile: MappingProfile = {
      profileName: 'test-profile',
      version: '1.0',
      overrides: [
        { from: 'config/deploy-only.properties', to: 'config/override/deploy-only.properties' }
      ]
    }

    const plan = await computeDeployPlan(dir, 'main', [hashes.c1, hashes.c2], profile)
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

    // 원본 git 저장소 파일과 git-deploy-extracted/ 산출물이 바이트 단위로
    // 동일한지 확인한다.
    const compare = (relPath: string, serverRelPath: string = relPath): void => {
      const original = readFileSync(join(dir, relPath))
      const copied = readFileSync(join(result.deployDir, serverRelPath))
      expect(Buffer.compare(original, copied)).toBe(0)
    }
    compare('crlf.txt')
    compare('binary.dat')
    compare('src/main/java/com/example/sell/GuaranteeListController.java')
    compare('src/main/resources/static/js/guarantee/list.js')
    compare('config/deploy-only.properties', 'config/override/deploy-only.properties')

    // DR-011/012: Spring 표준 구조는 경로 그대로
    expect(
      existsSync(
        join(result.deployDir, 'src/main/java/com/example/sell/GuaranteeListController.java')
      )
    ).toBe(true)
    expect(
      existsSync(join(result.deployDir, 'src/main/resources/static/js/guarantee/list.js'))
    ).toBe(true)
    // Mapping override 적용 확인 + 원래 경로에는 파일이 없어야 함
    expect(existsSync(join(result.deployDir, 'config/override/deploy-only.properties'))).toBe(true)
    expect(existsSync(join(result.deployDir, 'config/deploy-only.properties'))).toBe(false)

    // Export 3종 파일: UTF-8(BOM 없음), LF
    for (const name of ['deploy-files.txt', 'delete-list.txt', 'deploy-summary.json']) {
      const raw = readFileSync(join(result.deployDir, name))
      expect(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf).toBe(false)
      expect(raw.toString('utf8')).not.toContain('\r\n')
    }

    const deployFilesTxt = readFileSync(join(result.deployDir, 'deploy-files.txt'), 'utf8')
    expect(deployFilesTxt).toContain('config/override/deploy-only.properties')

    const deleteListTxt = readFileSync(join(result.deployDir, 'delete-list.txt'), 'utf8')
    expect(deleteListTxt.trim()).toBe('old.js')

    const summaryJson = JSON.parse(
      readFileSync(join(result.deployDir, 'deploy-summary.json'), 'utf8')
    )
    expect(summaryJson.summary.files).toBe(result.summary.files.length)
    expect(summaryJson.summary.deleted).toBe(1)
    expect(summaryJson.mappingProfile).toBe('test-profile')
    expect(summaryJson.commits).toHaveLength(2)
  })

  it('(b) 재실행하면 이전 잔여 파일이 제거된다', async () => {
    const profile: MappingProfile = { profileName: 'default', version: '1.0', overrides: [] }

    // 이번엔 crlf.txt만 건드리는 새 커밋을 판다 — 그것만 선택 대상이 되도록.
    writeFixtureFile(dir, 'crlf.txt', Buffer.from('line1\r\nchanged\r\n'))
    const onlyCrlfHash = commitAll(dir, 'crlf.txt만 재수정')

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
    expect(existsSync(staleJavaFile)).toBe(false)
    expect(existsSync(join(result.deployDir, 'crlf.txt'))).toBe(true)
  })

  it('(c) 대소문자만 다른 경로가 충돌하면 에러로 중단하고 기존 산출물은 건드리지 않는다(§4.1)', async () => {
    // 서로 다른 두 로컬 경로가 같은(대소문자만 다른) 서버 경로로 매핑되도록 override 구성
    const collidingProfile: MappingProfile = {
      profileName: 'colliding',
      version: '1.0',
      overrides: [
        { from: 'crlf.txt', to: 'Config.txt' },
        { from: 'binary.dat', to: 'config.txt' }
      ]
    }

    const plan = await computeDeployPlan(dir, 'main', [hashes.c1], collidingProfile)

    // 충돌 시도 전, git-deploy-extracted/에 이전(정상) 실행 결과물이 남아있는지
    // 스냅샷을 남겨서 "충돌하면 아무것도 건드리지 않고 중단한다"를 검증한다.
    const deployDir = join(dir, 'git-deploy-extracted')
    const beforeExists = existsSync(deployDir)
    const beforeSnapshot = beforeExists
      ? readFileSync(join(deployDir, 'deploy-files.txt'), 'utf8')
      : null

    await expect(
      buildPackage({
        repoPath: dir,
        branch: 'main',
        mappingProfileName: collidingProfile.profileName,
        selectedCommits: [],
        files: plan.files,
        deletedServerPaths: plan.deletedServerPaths,
        warnings: plan.warnings
      })
    ).rejects.toThrow(/대소문자만 다른 경로 충돌/)

    if (beforeExists) {
      const afterSnapshot = readFileSync(join(deployDir, 'deploy-files.txt'), 'utf8')
      expect(afterSnapshot).toBe(beforeSnapshot)
    } else {
      expect(existsSync(deployDir)).toBe(false)
    }
  })
})

describe('buildPackage — 전체 파이프라인(Repository -> Commit 선택 -> git-deploy-extracted/)', () => {
  it('(d) Phase 1~3을 연달아 거쳐도 정상 동작한다', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gde-package-pipeline-'))
    try {
      execFileSync('git', ['init', '-q'], { cwd: dir })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
      execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: dir })
      execFileSync('git', ['checkout', '-q', '-b', 'main'], { cwd: dir })
      writeFixtureFile(dir, 'src/main/resources/templates/guarantee/list.html', '<html></html>')
      execFileSync('git', ['add', '-A'], { cwd: dir })
      execFileSync('git', ['commit', '-q', '-m', 'guarantee html'], { cwd: dir })

      const branches = await listBranches(dir)
      const branch = pickDefaultBranch(branches)
      expect(branch).toBe('main')

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
      expect(commits).toHaveLength(1)

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

      expect(
        existsSync(join(result.deployDir, 'src/main/resources/templates/guarantee/list.html'))
      ).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
