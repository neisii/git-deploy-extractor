import { describe, expect, it } from 'vitest'
import { buildExtractListText, treeText } from './extractListText'
import type { CommitEntry } from '../../shared/types'

function commit(overrides: Partial<CommitEntry> = {}): CommitEntry {
  return {
    hash: '0123456789abcdef0123456789abcdef01234567',
    author: 'Tester',
    date: '2026-01-01T00:00:00+09:00',
    message: 'commit message',
    ...overrides
  }
}

describe('treeText', () => {
  it('빈 목록이면 "  (없음)"', () => {
    expect(treeText([])).toBe('  (없음)')
  })

  it('루트 파일 하나', () => {
    expect(treeText(['a.txt'])).toBe('└── a.txt')
  })

  it('단일 자식 폴더 체인을 한 줄로 합친다', () => {
    expect(treeText(['src/main/java/App.java'])).toBe('└── src/main/java/\n    └── App.java')
  })

  it('체인 중간에 파일이 있으면 합치지 않고 끊긴다(폴더가 파일보다 먼저)', () => {
    expect(treeText(['src/App.java', 'src/main/App2.java'])).toBe(
      '└── src/\n    ├── main/\n    │   └── App2.java\n    └── App.java'
    )
  })

  it('정렬: 폴더 먼저, 그다음 이름순 파일', () => {
    expect(treeText(['b.txt', 'a/x.txt', 'a.txt'])).toBe(
      '├── a/\n│   └── x.txt\n├── a.txt\n└── b.txt'
    )
  })

  it('같은 레벨은 이름순 정렬(폴더끼리, 파일끼리)', () => {
    expect(treeText(['z/1.txt', 'a/1.txt', 'm.txt', 'b.txt'])).toBe(
      '├── a/\n│   └── 1.txt\n├── z/\n│   └── 1.txt\n├── b.txt\n└── m.txt'
    )
  })

  it('한글 경로', () => {
    expect(treeText(['공통/설정.properties'])).toBe('└── 공통/\n    └── 설정.properties')
  })

  it('마지막 항목만 └──, 나머지는 ├──/│  ', () => {
    expect(treeText(['a.txt', 'b.txt', 'c.txt'])).toBe('├── a.txt\n├── b.txt\n└── c.txt')
  })
})

describe('buildExtractListText', () => {
  const fixedDate = new Date(2026, 8, 23, 14, 5, 9) // 로컬 타임존 기준 2026-09-23 14:05:09

  it('머리말 형식(생성 시각 고정 주입, 기준 브랜치, 커밋 0개)', () => {
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits: [],
      files: [],
      deleted: []
    })
    const bar = '='.repeat(64)
    const offsetMinutes = -fixedDate.getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const offH = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')
    const offM = String(Math.abs(offsetMinutes) % 60).padStart(2, '0')
    expect(text.startsWith(bar)).toBe(true)
    expect(text).toContain(' Extract 목록')
    expect(text).toContain(` 생성 시각   : 2026-09-23 14:05:09 ${sign}${offH}:${offM}`)
    expect(text).toContain(' 기준 브랜치 : main')
    expect(text).toContain(' 원본 커밋 (0개)')
    expect(text).toContain(' 배포 대상 파일 (0개)')
    expect(text).toContain(' 삭제 대상 파일 (0개)')
  })

  it('빈 배포/삭제 목록은 "  (없음)"을 포함한다', () => {
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits: [],
      files: [],
      deleted: []
    })
    const occurrences = text.split('  (없음)').length - 1
    expect(occurrences).toBe(2)
  })

  it('LF로 끝나고 파일 전체가 개행으로 끝난다', () => {
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits: [],
      files: ['a.txt'],
      deleted: []
    })
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toContain('\r\n')
  })

  it('배포/삭제 개수가 제목 숫자와 일치한다', () => {
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits: [],
      files: ['a.txt', 'b/c.txt'],
      deleted: ['old.js']
    })
    expect(text).toContain(' 배포 대상 파일 (2개)')
    expect(text).toContain(' 삭제 대상 파일 (1개)')
  })

  it('커밋 행 형식: 해시 7자리 + 날짜 + 작성자(정렬) + 제목', () => {
    const commits: CommitEntry[] = [
      commit({
        hash: 'abc1234567890',
        author: 'Bob',
        date: '2026-01-02T00:00:00+09:00',
        message: 'fix bug'
      }),
      commit({
        hash: 'def4567890abc',
        author: 'Alice Kim',
        date: '2026-01-01T00:00:00+09:00',
        message: 'add feature'
      })
    ]
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits,
      files: [],
      deleted: []
    })
    expect(text).toContain(`   abc1234  2026-01-02  ${'Bob'.padEnd(9)}  fix bug`)
    expect(text).toContain(`   def4567  2026-01-01  ${'Alice Kim'.padEnd(9)}  add feature`)
    expect(text).toContain(' 원본 커밋 (2개)')
  })

  it('커밋 10줄 경계: 정확히 10개면 "… 외"가 없다', () => {
    const commits = Array.from({ length: 10 }, (_, i) =>
      commit({ hash: `hash${i}`, message: `c${i}` })
    )
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits,
      files: [],
      deleted: []
    })
    expect(text).not.toContain('… 외')
    expect(text).toContain(' 원본 커밋 (10개)')
  })

  it('커밋 11개면 10줄 + "… 외 1개"', () => {
    const commits = Array.from({ length: 11 }, (_, i) =>
      commit({ hash: `hash${i}`, message: `c${i}` })
    )
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits,
      files: [],
      deleted: []
    })
    expect(text).toContain('   … 외 1개')
    expect(text).toContain(' 원본 커밋 (11개)')
  })

  it('커밋 25개면 10줄 + "… 외 15개"', () => {
    const commits = Array.from({ length: 25 }, (_, i) =>
      commit({ hash: `hash${i}`, message: `c${i}` })
    )
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits,
      files: [],
      deleted: []
    })
    expect(text).toContain('   … 외 15개')
  })

  it('커밋 1개도 정상 처리된다', () => {
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits: [commit({ message: 'only commit' })],
      files: [],
      deleted: []
    })
    expect(text).toContain(' 원본 커밋 (1개)')
    expect(text).not.toContain('… 외')
  })

  it('패턴 제외 항목은 files에 미리 걸러진 채로 들어온다는 계약(호출부 책임) — 전달된 목록만 그대로 반영', () => {
    const text = buildExtractListText({
      branch: 'main',
      generatedAt: fixedDate,
      commits: [],
      files: ['keep.txt'],
      deleted: []
    })
    expect(text).toContain('keep.txt')
    expect(text).not.toContain('excluded.txt')
  })
})
