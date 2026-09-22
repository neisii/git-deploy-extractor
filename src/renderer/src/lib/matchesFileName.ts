// RISK_ISSUES.md §7.2 — 파일명(경로의 마지막 조각)에 대한 매칭. 좌우 두
// 검색 필드(포함된 파일/누락된 의존성)가 동일 기준을 공유한다 — RT-34에서
// useIncludedFilesView/useMissingDependenciesView 두 훅이 나눠지면서 이
// 함수를 DeployFilesPanel.tsx 밖으로 뺐다.
//
// 2026-09-14 — `*` 와일드카드 지원 추가로 §7.3(파일명으로 커밋 검색)과의
// 매칭 기준 통일 원칙을 이 지점에서 의도적으로 깬다(커밋 검색까지 와일드카드를
// 확장해달라는 요청은 아직 없었음). `*`가 없는 입력은 기존 그대로 대소문자
// 무관 부분 일치(타이핑해서 좁혀보는 워크플로우 유지, 하위 호환) — `*`가
// 있으면 REQ-019 제외 패턴과 같은 문법(슬래시를 못 넘는 단일 세그먼트
// 와일드카드)으로 파일명 전체와 매치한다. 다만 REQ-019(영속 규칙, 대소문자
// 구분)와 달리 이건 그때그때 타이핑하는 일시적 검색이라 대소문자는 항상
// 무관하게 비교한다.
const GLOB_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g

export function matchesFileName(path: string, term: string): boolean {
  if (!term) return true
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  if (!term.includes('*')) {
    return fileName.toLowerCase().includes(term.toLowerCase())
  }
  const escaped = term.replace(GLOB_SPECIAL_CHARS, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`, 'i').test(fileName)
}
