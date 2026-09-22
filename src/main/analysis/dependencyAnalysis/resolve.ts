import type { ProjectIndex } from './projectIndex'

// DETAILED_DESIGN.md §6.4(참조 해석 전략) — 식별자 하나(항상 점 없는 단순
// 이름 — collectIdentifiers가 dotted qualified 이름을 구조적으로 만들지
// 않고 세그먼트 단위로 평평하게 뽑기 때문)를 우리 프로젝트 내부 파일
// 경로로 해석한다. 순서: 명시적 import → 같은 패키지 기본 규칙 → 이름이
// 프로젝트 안에서 유일하면 그것 → 같은 패키지 후보가 여러 개 중에 있으면
// 그것 → 그래도 모호하면 포기(추측하지 않는다).
export function resolveToPath(
  simpleName: string,
  currentPackage: string,
  importedSimpleNameToFqn: Map<string, string>,
  index: ProjectIndex
): string | undefined {
  const importedFqn = importedSimpleNameToFqn.get(simpleName)
  if (importedFqn && index.fqnToPath.has(importedFqn)) return index.fqnToPath.get(importedFqn)

  const samePackageFqn = currentPackage ? `${currentPackage}.${simpleName}` : simpleName
  if (index.fqnToPath.has(samePackageFqn)) return index.fqnToPath.get(samePackageFqn)

  const candidates = index.simpleNameToFqns.get(simpleName)
  if (!candidates || candidates.length === 0) return undefined
  if (candidates.length === 1) return index.fqnToPath.get(candidates[0])

  const inSamePackage = candidates.filter((fqn) => fqn.startsWith(`${currentPackage}.`))
  if (inSamePackage.length === 1) return index.fqnToPath.get(inSamePackage[0])

  return undefined // 진짜 모호함 — 추측하지 않는다
}
