import { describe, expect, it } from 'vitest'
import {
  hiddenByPatterns,
  interpret,
  matchPattern,
  parsePatternList,
  type FilePattern
} from './filePattern'

// docs/refactoring/REFACTORING_TASKS.md §3.1 "매칭 검증: 19개 케이스(종류
// 판별 6, 패키지 변환 매치 8, 경로/파일명 5) 직접 실행 통과"의 이식.

describe('interpret — 종류 판별 (6)', () => {
  it('슬래시 포함 → path', () => {
    expect(interpret('src/test/**').kind).toBe('path')
  })

  it('식별자.** → package, 글롭은 **/a/b/c/**로 변환', () => {
    expect(interpret('com.acme.legacy.**')).toEqual({
      kind: 'package',
      glob: '**/com/acme/legacy/**'
    })
  })

  it('2세그먼트 패키지도 인식', () => {
    expect(interpret('a.b.**')).toEqual({ kind: 'package', glob: '**/a/b/**' })
  })

  it('*.png → name(파일명)', () => {
    expect(interpret('*.png').kind).toBe('name')
  })

  it('application.* → name — .*는 패키지 표기로 보지 않는다', () => {
    expect(interpret('application.*').kind).toBe('name')
  })

  it('com.acme.legacy(와일드카드 없음) → name — 매치 없음으로 처리될 뿐 패키지 아님', () => {
    expect(interpret('com.acme.legacy').kind).toBe('name')
  })
})

describe('matchPattern — 패키지 변환 매치 (8)', () => {
  const PKG = 'com.acme.legacy.**'

  it('패키지 하위 중첩 경로에 매치', () => {
    expect(matchPattern(PKG, 'src/main/java/com/acme/legacy/Foo.java')).toBe(true)
  })

  it('루트에서 시작해도 매치(선행 **/는 없어도 됨)', () => {
    expect(matchPattern(PKG, 'com/acme/legacy/Foo.java')).toBe(true)
  })

  it('.java 한정이 아니다 — 같은 패키지의 리소스 파일도 매치', () => {
    expect(matchPattern(PKG, 'src/main/resources/com/acme/legacy/message.properties')).toBe(true)
  })

  it('형제 패키지(legacyOld)는 매치하지 않는다 — 세그먼트 경계 존중', () => {
    expect(matchPattern(PKG, 'src/main/java/com/acme/legacyOld/Foo.java')).toBe(false)
  })

  it('세그먼트가 이어붙은 이름(acmelegacy)은 매치하지 않는다', () => {
    expect(matchPattern(PKG, 'com/acmelegacy/Foo.java')).toBe(false)
  })

  it('다른 조상 패키지(other)는 매치하지 않는다', () => {
    expect(matchPattern(PKG, 'com/other/legacy/Foo.java')).toBe(false)
  })

  it('1세그먼트 패키지(a.**)도 하위 깊은 경로에 매치', () => {
    expect(matchPattern('a.**', 'a/nested/deep/File.java')).toBe(true)
  })

  it('1세그먼트 패키지(a.**)는 어느 깊이에서 시작해도 매치', () => {
    expect(matchPattern('a.**', 'b/a/File.java')).toBe(true)
  })
})

describe('matchPattern — 경로/파일명 (5)', () => {
  it('*.png는 마지막 조각에만 적용 — 매치', () => {
    expect(matchPattern('*.png', 'resources/icon.png')).toBe(true)
  })

  it('*.png는 파일명 전체 매치라 .png로 끝나지 않으면 매치하지 않는다', () => {
    expect(matchPattern('*.png', 'resources/icon.png.bak')).toBe(false)
  })

  it('application.*는 파일명 접두사 매치', () => {
    expect(matchPattern('application.*', 'src/main/resources/application.yml')).toBe(true)
  })

  it('src/test/**는 경로 전체 매치 — 하위 파일에 매치', () => {
    expect(matchPattern('src/test/**', 'src/test/java/com/acme/FooTest.java')).toBe(true)
  })

  it('src/test/**는 다른 경로에 매치하지 않는다', () => {
    expect(matchPattern('src/test/**', 'src/main/java/Foo.java')).toBe(false)
  })
})

describe('hiddenByPatterns — 제외 우선, 포함은 화이트리스트', () => {
  it('패턴이 없으면 아무것도 숨기지 않는다', () => {
    expect(hiddenByPatterns('src/main/java/Foo.java', [])).toBe(false)
  })

  it('비활성 패턴은 적용되지 않는다', () => {
    const patterns: FilePattern[] = [{ pattern: '*.java', mode: 'exclude', enabled: false }]
    expect(hiddenByPatterns('src/main/java/Foo.java', patterns)).toBe(false)
  })

  it('활성 제외 패턴에 매치하면 숨긴다', () => {
    const patterns: FilePattern[] = [{ pattern: '*.log', mode: 'exclude', enabled: true }]
    expect(hiddenByPatterns('app.log', patterns)).toBe(true)
  })

  it('활성 포함 패턴이 있으면 그중 하나에 매치해야 남는다', () => {
    const patterns: FilePattern[] = [{ pattern: '*.java', mode: 'include', enabled: true }]
    expect(hiddenByPatterns('README.md', patterns)).toBe(true)
    expect(hiddenByPatterns('Foo.java', patterns)).toBe(false)
  })

  it('제외가 포함보다 우선한다', () => {
    const patterns: FilePattern[] = [
      { pattern: '*.java', mode: 'include', enabled: true },
      { pattern: 'src/test/**', mode: 'exclude', enabled: true }
    ]
    expect(hiddenByPatterns('src/test/java/FooTest.java', patterns)).toBe(true)
  })
})

describe('parsePatternList — RT-46 한 번에 여러 패턴 입력', () => {
  it('쉼표로 구분한 여러 패턴을 나눈다', () => {
    expect(parsePatternList('*.png, *.md, target/**')).toEqual(['*.png', '*.md', 'target/**'])
  })

  it('줄바꿈도 구분자로 취급한다(붙여 넣은 여러 줄)', () => {
    expect(parsePatternList('*.png\n*.md\ntarget/**')).toEqual(['*.png', '*.md', 'target/**'])
  })

  it('앞뒤 공백을 제거한다', () => {
    expect(parsePatternList(' *.png ,  *.md ')).toEqual(['*.png', '*.md'])
  })

  it('빈 항목은 무시한다', () => {
    expect(parsePatternList('*.png, ,,*.md')).toEqual(['*.png', '*.md'])
  })

  it('빈 항목만 있으면 빈 배열을 반환한다', () => {
    expect(parsePatternList(', ,,')).toEqual([])
    expect(parsePatternList('   ')).toEqual([])
  })

  it('같은 입력 안의 중복은 한 번만 남긴다', () => {
    expect(parsePatternList('*.png, *.png, *.md')).toEqual(['*.png', '*.md'])
  })
})
