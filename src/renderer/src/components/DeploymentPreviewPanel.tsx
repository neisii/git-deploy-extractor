import { useAnalysisPhase } from '../lib/useAnalysisPhase'

export function DeploymentPreviewPanel(): React.JSX.Element {
  const { phase, summary, analysisError } = useAnalysisPhase()

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
      <div>Deleted : {summary.deleted}</div>
    </div>
  )
}
