import type { DependencyCandidate, JavaDependencyKind } from '../../../shared/types'
import { matchesFileName } from './matchesFileName'
import { hiddenByPatterns } from './filePattern'
import type { FilePattern } from './filePattern'

export interface AddFilesCandidate {
  localPath: string
  // 존재하면 누락된 의존성(빨간 글자 + Impl/I 배지)이다.
  kind?: JavaDependencyKind
}

function kindByPath(
  missingDependencies: DependencyCandidate[],
  includedSet: Set<string>
): Map<string, JavaDependencyKind> {
  const map = new Map<string, JavaDependencyKind>()
  for (const d of missingDependencies) {
    if (!includedSet.has(d.localPath)) map.set(d.localPath, d.kind)
  }
  return map
}

// 정정(2026-09-28) — REQ-019 시절 "누락된 의존성은 항상 .java만 나와
// 패턴이 적용될 일이 없다"는 근거가, RT-52/53으로 이 팝업이 HEAD 트리
// 전체(모든 파일 종류) 탐색까지 흡수하면서 더 이상 성립하지 않게 됐다
// (탐색/검색 모드는 .java 한정이 아님) — 활성 제외/포함 패턴에 걸리는
// 후보는 "포함된 파일"과 동일하게 완전히 숨긴다(추가해도 Extract에서
// 어차피 제외되는 파일을 미리 숨겨 헛수고를 막는다).
export function buildBrowseCandidates(
  headTreeFiles: string[],
  missingDependencies: DependencyCandidate[],
  includedSet: Set<string>,
  filePatterns: FilePattern[]
): AddFilesCandidate[] {
  const kinds = kindByPath(missingDependencies, includedSet)
  return headTreeFiles
    .filter((path) => !includedSet.has(path))
    .filter((path) => !hiddenByPatterns(path, filePatterns))
    .map((localPath) => ({ localPath, kind: kinds.get(localPath) }))
}

export interface SearchCandidatesResult {
  candidates: AddFilesCandidate[]
  truncated: boolean
}

// "결과 모드"(검색어 있음) 후보 — 부분 일치(대소문자 무관, `*` 와일드카드
// 규칙 재사용, §5.1 "와일드카드 규칙 재사용"), 최대 50개. 패턴 필터링은
// buildBrowseCandidates와 동일(위 주석 참고).
export function buildSearchCandidates(
  headTreeFiles: string[],
  missingDependencies: DependencyCandidate[],
  includedSet: Set<string>,
  query: string,
  resultLimit: number,
  filePatterns: FilePattern[]
): SearchCandidatesResult {
  const kinds = kindByPath(missingDependencies, includedSet)
  const trimmed = query.trim()
  const matched = headTreeFiles
    .filter((path) => !includedSet.has(path))
    .filter((path) => !hiddenByPatterns(path, filePatterns))
    .filter((path) => matchesFileName(path, trimmed))
  return {
    candidates: matched
      .slice(0, resultLimit)
      .map((localPath) => ({ localPath, kind: kinds.get(localPath) })),
    truncated: matched.length > resultLimit
  }
}

// RT-52 — "보이는 항목 모두 추가 (N)"의 대상(누락된 의존성만). 현재
// candidates가 곧 "보이는" 전부다(트리에서 접힌 폴더 안에 있어도
// 포함 — 접힘은 표시 상태일 뿐이라는 §5.1 RT-52 규칙과 일치, 이 함수는
// 펼침 상태를 아예 모르므로 자동으로 만족된다).
export function visibleDependencyPaths(candidates: AddFilesCandidate[]): string[] {
  return candidates.filter((c) => c.kind !== undefined).map((c) => c.localPath)
}

// RT-53 — 누락된 의존성 경로의 모든 조상 폴더 경로(세그먼트마다 하나).
// AddFilesPopup 탐색 트리의 기본 펼침 규칙("누락된 의존성이 하나라도
// 있는 폴더의 모든 조상은 기본 펼침")에 쓴다 — TreeList가 내부적으로
// compact 병합을 하더라도, 병합된 폴더 노드의 path는 항상 원래(압축 전)
// 조상 경로 중 하나와 같으므로(가장 깊은 병합 지점의 path를 그대로
// 물려받는다) 이 집합에 반드시 포함된다.
export function missingDependencyAncestorPaths(
  missingDependencies: DependencyCandidate[],
  includedSet: Set<string>,
  filePatterns: FilePattern[]
): Set<string> {
  const set = new Set<string>()
  for (const d of missingDependencies) {
    if (includedSet.has(d.localPath)) continue
    if (hiddenByPatterns(d.localPath, filePatterns)) continue
    const parts = d.localPath.split('/')
    parts.pop()
    let acc = ''
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg
      set.add(acc)
    }
  }
  return set
}
