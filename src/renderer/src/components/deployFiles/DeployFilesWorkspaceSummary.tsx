import { useAppStore, selectIsAnalysisStale } from '../../store/appStore'
import { includedPathsSet } from '../../lib/includedPathsSet'
import { visibleMissingDependencies } from '../../lib/visibleMissingDependencies'
import { useIncludedFilesView } from '../../lib/useIncludedFilesView'
import { useExtractTargetsView } from '../../lib/useExtractTargetsView'

// RT-47/RT-51(§5.1 RT-47·RT-51) — 배포 대상 파일 섹션(DeployFilesWorkspace)의
// 접힌 헤더 요약: "Extract N개(패턴 제외 K) · 미선택 변경 파일 M개 ·
// 누락된 의존성 K개"(RT-47 때는 이 개념이 아직 없어 "포함된 파일" 기준
// 임시 문구를 썼다 — RT-51로 대체).
export function DeployFilesWorkspaceSummary(): React.JSX.Element {
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const analyzing = useAppStore((s) => s.analyzing)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const analysisError = useAppStore((s) => s.analysisError)
  const summary = useAppStore((s) => s.summary)
  const isStale = useAppStore(selectIsAnalysisStale)
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filePatterns = useAppStore((s) => s.filePatterns)
  const missingDependencies = useAppStore((s) => s.missingDependencies)

  const { totalBeforeFilter: unmovedCount } = useIncludedFilesView(deployFiles, filePatterns)
  const { items: extractItems, patternExcludedCount } = useExtractTargetsView(
    deployFiles,
    filePatterns
  )

  // useAnalysisPhase와 같은 우선순위(error > empty > loading > stale)지만,
  // dependencyAnalyzing도 "계산 중"으로 묶는다 — 이 요약은 우측 의존성
  // 개수까지 포함하므로 그 계산이 끝나기 전엔 카운트를 보여줄 수 없다.
  if (analysisError) return <>계산 실패</>
  if (selectedHashes.size === 0) return <>선택 없음</>
  if (analyzing || dependencyAnalyzing) return <>계산 중</>
  if (isStale || !summary) return <>Preview 필요</>

  const includedPaths = includedPathsSet(deployFiles)
  const missingCount = visibleMissingDependencies(missingDependencies, includedPaths).length

  return (
    <>
      Extract {extractItems.length}개
      {patternExcludedCount > 0 && `(패턴 제외 ${patternExcludedCount})`} · 미선택 변경 파일{' '}
      {unmovedCount}개 · 누락된 의존성 {missingCount}개
    </>
  )
}
