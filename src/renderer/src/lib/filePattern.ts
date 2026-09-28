// 파일 패턴(제외/포함, REQ-026) 규칙의 순수 함수 구현 — 종류 자동 파생
// (interpret)·매치 판정(matchPattern/hiddenByPatterns). `FilePattern` 타입은
// Main(patternStore.ts)도 참조해 shared/types.ts로 옮겨졌다(2026-09-28) —
// 여기서는 재수출만 한다. 매칭 로직 자체는 Main이 필요 없어(Export 대상
// 필터링은 Renderer가 이미 걸러서 IPC로 넘김) 계속 여기 남는다.

import type { FilePattern } from '../../../shared/types'
export type { FilePattern } from '../../../shared/types'

export type PatternKind = 'path' | 'package' | 'name'

export interface InterpretedPattern {
  kind: PatternKind
  glob: string
}

const REGEX_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g

// 식별자만으로 이루어지고 끝이 `.**`인 형태만 패키지 표기로 본다.
// `application.*`(끝이 `.*`)는 여기 해당하지 않는다(정상 파일명 패턴).
const PACKAGE_PATTERN_RE = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*\.\*\*$/

// 글롭 → 정규식. `*` = 한 세그먼트(슬래시를 못 넘음), `**` = 하위 전체(0개
// 포함), 선행 `**/`는 있어도 없어도(루트 포함) 매치한다.
function globToRegExp(glob: string): RegExp {
  // 치환 중간에 쓰는 자리표시자는 제어 문자 대신 유니코드 사용 영역(PUA)
  // 문자를 쓴다 — 정규식 리터럴에 제어 문자가 들어가면 eslint no-control-regex
  // 에 걸린다.
  const LEADING_DOUBLE_STAR = ''
  const DOUBLE_STAR = ''
  let pattern = glob.replace(REGEX_SPECIAL_CHARS, '\\$&')
  pattern = pattern
    .replace(/\*\*\//g, LEADING_DOUBLE_STAR)
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(LEADING_DOUBLE_STAR, 'g'), '(?:.*/)?')
    .replace(new RegExp(DOUBLE_STAR, 'g'), '.*')
  return new RegExp(`^${pattern}$`)
}

// 종류는 입력 형식에서 자동 파생한다(사용자가 고르지 않음):
//  1) '/' 포함 → 경로: 경로 전체에 글롭
//  2) a.b.c.** 형태(식별자만, 끝이 .**) → 패키지 표기: 경로 **/a/b/c/** 로 변환
//  3) 그 외 → 파일명: 마지막 조각(파일명)에 글롭
export function interpret(pattern: string): InterpretedPattern {
  const trimmed = pattern.trim()
  if (trimmed.includes('/')) return { kind: 'path', glob: trimmed }
  if (PACKAGE_PATTERN_RE.test(trimmed)) {
    return { kind: 'package', glob: `**/${trimmed.slice(0, -3).split('.').join('/')}/**` }
  }
  return { kind: 'name', glob: trimmed }
}

function fileName(localPath: string): string {
  return localPath.slice(localPath.lastIndexOf('/') + 1)
}

export function matchPattern(pattern: string, localPath: string): boolean {
  const interpreted = interpret(pattern)
  const target = interpreted.kind === 'name' ? fileName(localPath) : localPath
  return globToRegExp(interpreted.glob).test(target)
}

// RT-46 — 한 번에 여러 패턴 입력: 쉼표·줄바꿈을 모두 구분자로 취급하고
// 앞뒤 공백 제거·빈 항목 무시·같은 입력 안 중복은 한 번만 남긴다.
export function parsePatternList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  )
}

// 제외가 항상 우선. 활성 포함 패턴이 하나라도 있으면 그중 하나 이상에
// 매치되는 파일만 남는다(활성 포함 패턴이 없으면 포함 조건 없이 전부 통과).
export function hiddenByPatterns(localPath: string, patterns: FilePattern[]): boolean {
  const active = patterns.filter((p) => p.enabled)
  if (active.some((p) => p.mode === 'exclude' && matchPattern(p.pattern, localPath))) {
    return true
  }
  const includes = active.filter((p) => p.mode === 'include')
  return includes.length > 0 && !includes.some((p) => matchPattern(p.pattern, localPath))
}
