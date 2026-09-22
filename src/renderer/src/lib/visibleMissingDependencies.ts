import type { DependencyCandidate } from '../../../shared/types'

// RT-17(R4·R5, §5.1 "누락된 의존성 중복 제거") — 이미 Extract 목록(변경
// 파일·수동 추가로 deployFiles에 들어간 경로)에 있는 항목은 "누락된
// 의존성" 목록에서 제외한다. 그대로 두면 수동으로 추가한 파일이 오른쪽
// "누락된 의존성" 패널에도 계속 남아(체크된 채로) 같은 파일이 두 곳에
// 중복 표시된다. 배지 개수·"모두 추가" 대상·팝업 트리의 표시(RT-52)가
// 전부 이 함수가 반환하는 집합을 기준으로 계산돼야 한다.
export function visibleMissingDependencies(
  missing: DependencyCandidate[],
  extractPaths: Set<string>
): DependencyCandidate[] {
  return missing.filter((d) => !extractPaths.has(d.localPath))
}
