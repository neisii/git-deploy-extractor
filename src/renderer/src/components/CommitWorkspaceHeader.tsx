import { useAppStore } from '../store/appStore'
import { useAnalysisPhase } from '../lib/useAnalysisPhase'

// RT-47(§5.1 RT-47) — 커밋 섹션(CommitWorkspace)의 접힌 헤더 요약: "N개
// 선택됨"(명세 원문) + Deleted/경고 개수(M-8 결정 "경고 개수는 요약에") —
// 둘 다 PreviewSummary가 갖고 있던 값이라 phase가 ready일 때만 덧붙인다.
export function CommitWorkspaceSummary(): React.JSX.Element {
  const selectedCount = useAppStore((s) => s.selectedHashes.size)
  const deleteCount = useAppStore((s) => s.deleteList.length)
  const warningCount = useAppStore((s) => s.warnings.length)
  const { phase } = useAnalysisPhase()

  const parts = [`${selectedCount}개 선택됨`]
  if (phase === 'ready') {
    if (deleteCount > 0) parts.push(`Deleted ${deleteCount}`)
    if (warningCount > 0) parts.push(`⚠ ${warningCount}`)
  }
  return <>{parts.join(' · ')}</>
}

// RT-47(M-8) — "접힌 헤더에 Preview 유지" 결정. CommitListPanel 안의
// Preview 버튼과 같은 disabled/title 조건을 그대로 복제한다(본문이
// hidden일 때도 헤더는 항상 렌더링되므로, 본문 안 버튼과 별개 인스턴스가
// 필요하다) — CollapsibleSection이 collapsed일 때만 렌더링하므로 펼친
// 상태에서 버튼이 두 번 보이지는 않는다.
export function CommitWorkspacePreviewAction(): React.JSX.Element {
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const analyzing = useAppStore((s) => s.analyzing)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const runPreview = useAppStore((s) => s.runPreview)

  return (
    <button
      type="button"
      disabled={selectedHashes.size === 0 || analyzing || dependencyAnalyzing}
      title={
        analyzing || dependencyAnalyzing
          ? '분석 중입니다 — 완료 후 다시 실행할 수 있습니다'
          : undefined
      }
      onClick={() => void runPreview()}
    >
      Preview
    </button>
  )
}
