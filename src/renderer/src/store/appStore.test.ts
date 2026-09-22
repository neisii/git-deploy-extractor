import { describe, expect, it } from 'vitest'
import {
  parseMultiValueFilter,
  selectionMatches,
  type AnalyzedSelection,
  type SelectionSnapshot
} from './appStore'

// RT-01(P0 안전망) — 기존 동작의 회귀 테스트. 리팩토링 착수 전 현재 동작을
// 고정해 두는 것이 목적이라 동작을 바꾸는 케이스는 없다.

describe('parseMultiValueFilter — REQ-022/REQ-023', () => {
  it('빈 문자열은 빈 배열', () => {
    expect(parseMultiValueFilter('')).toEqual([])
  })

  it('공백만 있으면 빈 배열', () => {
    expect(parseMultiValueFilter('   \n  ')).toEqual([])
  })

  it('쉼표로 구분', () => {
    expect(parseMultiValueFilter('alice,bob,carol')).toEqual(['alice', 'bob', 'carol'])
  })

  it('줄바꿈으로 구분', () => {
    expect(parseMultiValueFilter('alice\nbob\ncarol')).toEqual(['alice', 'bob', 'carol'])
  })

  it('연속된 구분자·앞뒤 공백은 빈 토큰 없이 정리', () => {
    expect(parseMultiValueFilter(' alice ,, bob\n\n carol ')).toEqual(['alice', 'bob', 'carol'])
  })

  it('공백과 쉼표 혼합도 처리', () => {
    expect(parseMultiValueFilter('alice, bob carol,  dave')).toEqual([
      'alice',
      'bob',
      'carol',
      'dave'
    ])
  })
})

describe('selectionMatches — §6.1 케이스 C 레이스 컨디션 가드', () => {
  const base: SelectionSnapshot = {
    selectedBranch: 'main',
    selectedProfile: 'default',
    selectedHashes: new Set(['a1', 'b2'])
  }

  it('브랜치·프로필·해시 집합이 모두 같으면 true(배열 순서는 무관)', () => {
    const a: AnalyzedSelection = { branch: 'main', profileName: 'default', hashes: ['b2', 'a1'] }
    expect(selectionMatches(a, base)).toBe(true)
  })

  it('브랜치가 다르면 false', () => {
    const a: AnalyzedSelection = { branch: 'dev', profileName: 'default', hashes: ['a1', 'b2'] }
    expect(selectionMatches(a, base)).toBe(false)
  })

  it('프로필이 다르면 false', () => {
    const a: AnalyzedSelection = { branch: 'main', profileName: 'other', hashes: ['a1', 'b2'] }
    expect(selectionMatches(a, base)).toBe(false)
  })

  it('해시 개수가 다르면 false', () => {
    const a: AnalyzedSelection = { branch: 'main', profileName: 'default', hashes: ['a1'] }
    expect(selectionMatches(a, base)).toBe(false)
  })

  it('개수는 같아도 실제 해시 값이 다르면 false', () => {
    const a: AnalyzedSelection = { branch: 'main', profileName: 'default', hashes: ['a1', 'c3'] }
    expect(selectionMatches(a, base)).toBe(false)
  })

  it('빈 선택끼리는 true', () => {
    const empty: SelectionSnapshot = { ...base, selectedHashes: new Set() }
    const a: AnalyzedSelection = { branch: 'main', profileName: 'default', hashes: [] }
    expect(selectionMatches(a, empty)).toBe(true)
  })
})
