import { describe, expect, it } from 'vitest'
import { visibleMissingDependencies } from './visibleMissingDependencies'
import type { DependencyCandidate } from '../../../shared/types'

function candidate(localPath: string): DependencyCandidate {
  return { localPath, serverPath: localPath, status: 'added', kind: 'class' }
}

describe('visibleMissingDependencies', () => {
  it('Extract 목록에 없는 항목은 그대로 남는다', () => {
    const missing = [candidate('A.java'), candidate('B.java')]
    expect(visibleMissingDependencies(missing, new Set())).toEqual(missing)
  })

  it('이미 Extract 목록(변경 파일·수동 추가)에 있는 경로는 제외된다', () => {
    const missing = [candidate('A.java'), candidate('B.java')]
    const result = visibleMissingDependencies(missing, new Set(['A.java']))
    expect(result.map((d) => d.localPath)).toEqual(['B.java'])
  })

  it('전부 이미 포함돼 있으면 빈 배열', () => {
    const missing = [candidate('A.java'), candidate('B.java')]
    const result = visibleMissingDependencies(missing, new Set(['A.java', 'B.java']))
    expect(result).toEqual([])
  })
})
