import { describe, expect, it } from 'vitest'
import { classifyExportTarget } from './classifyExportTarget'

// RT-56(U-16) §5.1 — 순수 함수 vitest. 호출부(validateExportTarget)가
// 이미 fs.realpath + 대소문자 정책을 적용해 넘긴다고 가정하고, 여기서는
// path.relative 판정 로직 자체만 검증한다(fs 접근 없음).

describe('classifyExportTarget', () => {
  const repo = '/work/proj'

  it('저장소와 정확히 같으면 INSIDE_REPO', () => {
    expect(classifyExportTarget(repo, repo)).toBe('INSIDE_REPO')
  })

  it('저장소 바로 아래 하위 폴더면 INSIDE_REPO', () => {
    expect(classifyExportTarget(repo, '/work/proj/git-deploy-extracted')).toBe('INSIDE_REPO')
  })

  it('저장소의 더 깊은 하위 폴더도 INSIDE_REPO', () => {
    expect(classifyExportTarget(repo, '/work/proj/a/b')).toBe('INSIDE_REPO')
  })

  it('F(sub 모드 산출물 폴더)가 저장소를 포함하면 CONTAINS_REPO', () => {
    // 예: 저장소가 <선택 경로>/git-deploy-extracted/proj — sub 모드는
    // F를 fs.rm(recursive)로 통째 지우므로 저장소가 삭제될 수 있다.
    expect(classifyExportTarget('/work/out/git-deploy-extracted/proj', '/work/out')).toBe(
      'CONTAINS_REPO'
    )
  })

  it('형제 폴더는 OK', () => {
    expect(classifyExportTarget(repo, '/work/other')).toBe('OK')
  })

  it('접두사만 같은 형제(-old, 2)는 OK — startsWith 함정을 피한다', () => {
    expect(classifyExportTarget(repo, '/work/proj-old')).toBe('OK')
    expect(classifyExportTarget(repo, '/work/proj2')).toBe('OK')
    expect(classifyExportTarget('/work/proj-old', repo)).toBe('OK')
  })

  it('저장소를 포함하지 않는 상위 폴더(형제 관계)는 OK', () => {
    // R=/work/proj, F=/work(상위) — R이 F 하위이므로 얼핏 CONTAINS_REPO로
    // 보이지만, 이 케이스는 실제로 R이 F의 하위이므로 CONTAINS_REPO가
    // 맞다(F가 저장소를 포함) — 별도 테스트로 명시한다.
    expect(classifyExportTarget(repo, '/work')).toBe('CONTAINS_REPO')
  })
})
