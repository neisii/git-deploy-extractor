import type { DependencyCandidate, JavaDependencyKind } from '../../../shared/types'
import { matchesFileName } from './matchesFileName'

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

// RT-52/53(§5.1 RT-52, U-19·U-20) — AddFilesPopup의 "탐색 모드"(검색어
// 없음) 후보. HEAD 트리 전체(이미 Extract·변경 파일에 있는 경로는
// M-36(a) 가정대로 제외)를 그대로 반환한다 — TreeList가 폴더로 묶어
// 보여준다. 누락된 의존성은 kind로 표시된다.
export function buildBrowseCandidates(
  headTreeFiles: string[],
  missingDependencies: DependencyCandidate[],
  includedSet: Set<string>
): AddFilesCandidate[] {
  const kinds = kindByPath(missingDependencies, includedSet)
  return headTreeFiles
    .filter((path) => !includedSet.has(path))
    .map((localPath) => ({ localPath, kind: kinds.get(localPath) }))
}

export interface SearchCandidatesResult {
  candidates: AddFilesCandidate[]
  truncated: boolean
}

// "결과 모드"(검색어 있음) 후보 — 부분 일치(대소문자 무관, `*` 와일드카드
// 규칙 재사용, §5.1 "와일드카드 규칙 재사용"), 최대 50개.
export function buildSearchCandidates(
  headTreeFiles: string[],
  missingDependencies: DependencyCandidate[],
  includedSet: Set<string>,
  query: string,
  resultLimit: number
): SearchCandidatesResult {
  const kinds = kindByPath(missingDependencies, includedSet)
  const trimmed = query.trim()
  const matched = headTreeFiles
    .filter((path) => !includedSet.has(path))
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
  includedSet: Set<string>
): Set<string> {
  const set = new Set<string>()
  for (const d of missingDependencies) {
    if (includedSet.has(d.localPath)) continue
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
