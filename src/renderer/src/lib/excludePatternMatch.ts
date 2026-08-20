// REQ-019/DR-018 — 지원 범위를 `*`(한 세그먼트 안에서만 매치, 슬래시를 못
// 넘음) 하나로 한정한다. `**`(다중 세그먼트)·`!`(부정 패턴)·트레일링 슬래시
// 디렉터리 접두사 매치는 백로그(RISK_ISSUES.md 결정 이력 #42/#43).
//
// `/`가 없는 패턴은 파일명(경로 마지막 조각)과 전체 매치, `/`가 있는 패턴은
// 경로 전체와 전체 매치(부분/substring 매치 아님 — .gitignore 관례와 동일).
// 대소문자는 항상 구분한다(결정 이력 #8과 일관성).

const REGEX_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(REGEX_SPECIAL_CHARS, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

export function matchesExcludePattern(localPath: string, pattern: string): boolean {
  if (!pattern) return false
  const regex = patternToRegExp(pattern)
  if (pattern.includes('/')) {
    return regex.test(localPath)
  }
  const fileName = localPath.slice(localPath.lastIndexOf('/') + 1)
  return regex.test(fileName)
}

export function matchesAnyActiveExcludePattern(
  localPath: string,
  patterns: { pattern: string; enabled: boolean }[]
): boolean {
  return patterns.some((p) => p.enabled && matchesExcludePattern(localPath, p.pattern))
}
