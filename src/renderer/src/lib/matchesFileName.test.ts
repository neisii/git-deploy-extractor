import { describe, expect, it } from 'vitest'
import { matchesFileName } from './matchesFileName'

// RT-34 — DeployFilesPanel.tsx에 있던 걸 뺀 뒤 첫 단위 테스트.

describe('matchesFileName', () => {
  it('빈 검색어는 항상 매치', () => {
    expect(matchesFileName('src/Foo.java', '')).toBe(true)
  })

  it('* 없는 검색어는 대소문자 무관 부분 일치', () => {
    expect(matchesFileName('src/main/Foo.java', 'foo')).toBe(true)
    expect(matchesFileName('src/main/Foo.java', 'FOO')).toBe(true)
    expect(matchesFileName('src/main/Foo.java', 'bar')).toBe(false)
  })

  it('* 포함 검색어는 파일명 전체와 글롭 매치(슬래시를 못 넘음)', () => {
    expect(matchesFileName('src/main/Foo.java', '*.java')).toBe(true)
    expect(matchesFileName('src/main/FooList.java', '*List.java')).toBe(true)
    expect(matchesFileName('src/main/Foo.java', '*.html')).toBe(false)
  })

  it('경로 구분자가 없어도 파일명 자체로 매치한다', () => {
    expect(matchesFileName('Foo.java', '*.java')).toBe(true)
  })
})
