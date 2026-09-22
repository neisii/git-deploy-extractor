import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { analyzeCommits } from './analyzeCommits'
import { cleanupRepo, commitAll, initRepo, writeFixtureFile } from '../testSupport/gitFixture'

// scripts/verify-phase2.ts 케이스 1~4-1의 이식 — 여러 커밋에 걸친 diff
// 합치기(dedup)·merge·rename·삭제 경고·root commit 처리.

describe('analyzeCommits', () => {
  let dir: string
  const hashes: Record<string, string> = {}

  beforeAll(() => {
    dir = initRepo('gde-analyze-')

    // C1 (root commit, 부모 없음)
    writeFixtureFile(dir, 'shared.txt', 'v1')
    writeFixtureFile(dir, 'other.txt', 'other v1')
    hashes.c1_root = commitAll(dir, 'root: shared.txt, other.txt 추가')

    // C2, C3: shared.txt를 두 커밋에 걸쳐 반복 수정(중복 제거 테스트),
    // C3에서 other.txt 삭제
    writeFixtureFile(dir, 'shared.txt', 'v2')
    hashes.c2_modify = commitAll(dir, 'shared.txt 수정 1')

    writeFixtureFile(dir, 'shared.txt', 'v3')
    execFileSync('git', ['rm', '-q', 'other.txt'], { cwd: dir })
    hashes.c3_modify_and_delete = commitAll(dir, 'shared.txt 수정 2, other.txt 삭제')

    // feature 브랜치: featureOnly.txt 추가(나중에 merge)
    execFileSync('git', ['checkout', '-q', '-b', 'feature'], { cwd: dir })
    writeFixtureFile(dir, 'featureOnly.txt', 'feature content')
    hashes.c4_feature = commitAll(dir, 'feature: featureOnly.txt 추가')

    // main으로 돌아와 mainOnly.txt 추가(feature와 분기)
    execFileSync('git', ['checkout', '-q', 'main'], { cwd: dir })
    writeFixtureFile(dir, 'mainOnly.txt', 'main only content')
    hashes.c5_main_only = commitAll(dir, 'main: mainOnly.txt 추가')

    // merge(첫 번째 부모는 c5_main_only)
    execFileSync('git', ['merge', '-q', '--no-ff', 'feature', '-m', 'merge feature into main'], {
      cwd: dir
    })
    hashes.c6_merge = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim()

    // rename(감지 없이 D+A로 나와야 함, DR-008)
    execFileSync('git', ['mv', 'mainOnly.txt', 'mainOnlyRenamed.txt'], { cwd: dir })
    hashes.c7_rename = commitAll(dir, 'mainOnly.txt -> mainOnlyRenamed.txt rename')

    // temp 파일: 추가 후 다음 커밋에서 삭제(삭제 커밋은 분석 대상에서 제외해
    // "선택된 커밋에서는 added인데 HEAD엔 없음" 상황을 재현)
    writeFixtureFile(dir, 'tempWillBeDeleted.txt', 'temp')
    hashes.c8_add_temp = commitAll(dir, 'tempWillBeDeleted.txt 추가')

    execFileSync('git', ['rm', '-q', 'tempWillBeDeleted.txt'], { cwd: dir })
    commitAll(dir, 'tempWillBeDeleted.txt 삭제(분석에서 선택 안 함)')
  })

  afterAll(() => cleanupRepo(dir))

  it('케이스 1: 동일 파일이 여러 커밋에서 수정되면 중복 제거된다(REQ-006/DR-004)', async () => {
    const result = await analyzeCommits(dir, 'main', [
      hashes.c2_modify,
      hashes.c3_modify_and_delete
    ])
    expect(result.deployTargets).toEqual([{ path: 'shared.txt', status: 'modified' }])
    expect(result.deleteList).toEqual(['other.txt'])
    expect(result.warnings).toHaveLength(0)
  })

  it('케이스 2: Merge 커밋은 첫 번째 부모 기준으로 분석한다(§3.3)', async () => {
    const result = await analyzeCommits(dir, 'main', [hashes.c6_merge])
    expect(result.deployTargets).toEqual([{ path: 'featureOnly.txt', status: 'added' }])
    // mainOnly.txt는 첫 번째 부모(c5)에서 이미 생겼으므로 merge commit의
    // diff에는 나오지 않아야 한다.
    expect(result.deleteList).toEqual([])
  })

  it('케이스 3: Rename은 Delete+Add 두 줄로 나온다(DR-008)', async () => {
    const result = await analyzeCommits(dir, 'main', [hashes.c7_rename])
    expect(result.deleteList).toEqual(['mainOnly.txt'])
    expect(result.deployTargets).toEqual([{ path: 'mainOnlyRenamed.txt', status: 'added' }])
  })

  it('케이스 4: HEAD에 없는 파일은 Warning으로 빠진다(DR-009)', async () => {
    const result = await analyzeCommits(dir, 'main', [hashes.c8_add_temp])
    expect(result.deployTargets).toHaveLength(0)
    expect(result.deleteList).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].path).toBe('tempWillBeDeleted.txt')
  })

  it('케이스 4-1: Root commit(부모 없음)도 정상 처리된다', async () => {
    const result = await analyzeCommits(dir, 'main', [hashes.c1_root])
    expect(result.deployTargets).toEqual([{ path: 'shared.txt', status: 'added' }])
    // other.txt는 root commit에서는 added지만 c3에서 삭제되어 HEAD엔
    // 없으므로 Warning이어야 한다.
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].path).toBe('other.txt')
  })
})
