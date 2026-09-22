import { useAppStore } from '../store/appStore'
import { useAnalysisPhase } from '../lib/useAnalysisPhase'
import { useWorkAreaPopup } from '../lib/workAreaPopupContext'

// RT-44(§2.1·§5.1) — 기존 DeploymentPreviewPanel을 대체한다(D4
// PreviewSummary). "empty/stale/loading/ready/error" 5단계 표시는
// useAnalysisPhase로 그대로 유지하고, ready 단계에 `Deleted`/`⚠ HEAD에
// 없음` 버튼 두 개를 추가했다 — 기존 DeleteListPanel(상시 노출 목록)과
// DeployFilesPanel의 "N개 파일이 HEAD에 없어 제외되었습니다" 배너를
// 대체한다(U-1·U-2, DR-009).
export function PreviewSummary(): React.JSX.Element {
  const { phase, summary, analysisError } = useAnalysisPhase()
  const deleteCount = useAppStore((s) => s.deleteList.length)
  const warningCount = useAppStore((s) => s.warnings.length)
  const { open } = useWorkAreaPopup()

  if (phase === 'error') {
    return (
      <div className="panel deployment-preview-panel deployment-preview-panel--error">
        계산 실패: {analysisError}
      </div>
    )
  }

  if (phase === 'empty') {
    return <div className="panel deployment-preview-panel">커밋을 선택하세요</div>
  }

  if (phase === 'loading') {
    return <div className="panel deployment-preview-panel">계산 중...</div>
  }

  if (phase === 'stale' || !summary) {
    return (
      <div className="panel deployment-preview-panel">
        선택이 변경되었습니다 — Preview를 눌러 계산하세요
      </div>
    )
  }

  return (
    <div className="panel deployment-preview-panel">
      <div>Files : {summary.files}</div>
      <div>Added : {summary.added}</div>
      <div>Modified : {summary.modified}</div>
      <button
        type="button"
        className="preview-summary__deleted-button"
        disabled={deleteCount === 0}
        onClick={() => open('deleted')}
      >
        Deleted: {deleteCount} ▸
      </button>
      {warningCount > 0 && (
        <button
          type="button"
          className="preview-summary__warning-button"
          onClick={() => open('warnings')}
        >
          ⚠ HEAD에 없음: {warningCount} ▸
        </button>
      )}
    </div>
  )
}
