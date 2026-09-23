import { describe, expect, it } from 'vitest'
import {
  buildBrowseCandidates,
  buildSearchCandidates,
  visibleDependencyPaths,
  missingDependencyAncestorPaths
} from './addFilesCandidates'
import type { DependencyCandidate } from '../../../shared/types'

function dep(localPath: string, kind: DependencyCandidate['kind'] = 'class'): DependencyCandidate {
  return { localPath, serverPath: localPath, status: 'added', kind }
}

describe('buildBrowseCandidates', () => {
  const missing = [dep('src/FooImpl.java', 'class'), dep('src/Bar.java', 'interface')]

  it('HEAD 트리 전체를 반환하고 누락된 의존성은 kind로 표시한다', () => {
    const result = buildBrowseCandidates(
      ['src/FooImpl.java', 'src/Bar.java', 'src/Unrelated.java'],
      missing,
      new Set()
    )
    expect(result).toEqual([
      { localPath: 'src/FooImpl.java', kind: 'class' },
      { localPath: 'src/Bar.java', kind: 'interface' },
      { localPath: 'src/Unrelated.java', kind: undefined }
    ])
  })

  it('이미 deployFiles에 있는(includedSet) 경로는 제외한다(M-36a)', () => {
    const result = buildBrowseCandidates(
      ['src/FooImpl.java', 'src/Unrelated.java'],
      missing,
      new Set(['src/FooImpl.java'])
    )
    expect(result).toEqual([{ localPath: 'src/Unrelated.java', kind: undefined }])
  })
})

describe('buildSearchCandidates', () => {
  it('부분 일치(파일명 기준)로 걸러진 후보를 반환한다', () => {
    const result = buildSearchCandidates(
      ['src/FooImpl.java', 'src/Unrelated.java'],
      [],
      new Set(),
      'unrelated',
      50
    )
    expect(result.candidates).toEqual([{ localPath: 'src/Unrelated.java', kind: undefined }])
    expect(result.truncated).toBe(false)
  })

  it('`*` 와일드카드를 지원한다(파일명 매칭 규칙 재사용)', () => {
    const result = buildSearchCandidates(
      ['src/FooImpl.java', 'src/FooTest.java', 'src/Bar.java'],
      [],
      new Set(),
      'Foo*.java',
      50
    )
    expect(result.candidates.map((c) => c.localPath).sort()).toEqual([
      'src/FooImpl.java',
      'src/FooTest.java'
    ])
  })

  it('상한을 넘으면 truncated=true와 함께 상위 N개만 반환한다', () => {
    const files = Array.from({ length: 5 }, (_, i) => `src/Match${i}.java`)
    const result = buildSearchCandidates(files, [], new Set(), 'match', 3)
    expect(result.candidates).toHaveLength(3)
    expect(result.truncated).toBe(true)
  })

  it('이미 포함된 경로는 검색 결과에서도 제외된다', () => {
    const result = buildSearchCandidates(
      ['src/Foo.java', 'src/Foo2.java'],
      [],
      new Set(['src/Foo.java']),
      'foo',
      50
    )
    expect(result.candidates).toEqual([{ localPath: 'src/Foo2.java', kind: undefined }])
  })
})

describe('visibleDependencyPaths', () => {
  it('kind가 있는(누락된 의존성) 항목의 경로만 반환한다', () => {
    const candidates = [
      { localPath: 'a.java', kind: 'class' as const },
      { localPath: 'b.java', kind: undefined }
    ]
    expect(visibleDependencyPaths(candidates)).toEqual(['a.java'])
  })
})

describe('missingDependencyAncestorPaths', () => {
  it('누락된 의존성 경로의 모든 조상 폴더를 세그먼트마다 하나씩 모은다', () => {
    const set = missingDependencyAncestorPaths(
      [dep('src/main/java/com/acme/repo/FooImpl.java')],
      new Set()
    )
    expect([...set].sort()).toEqual(
      [
        'src',
        'src/main',
        'src/main/java',
        'src/main/java/com',
        'src/main/java/com/acme',
        'src/main/java/com/acme/repo'
      ].sort()
    )
  })

  it('이미 Extract에 있는 의존성은 제외한다', () => {
    const set = missingDependencyAncestorPaths([dep('a/B.java')], new Set(['a/B.java']))
    expect(set.size).toBe(0)
  })

  it('루트 바로 아래 파일은 조상이 없다', () => {
    const set = missingDependencyAncestorPaths([dep('Root.java')], new Set())
    expect(set.size).toBe(0)
  })
})
