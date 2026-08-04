import { useAppStore, selectIsAnalysisStale } from '../store/appStore'

export function DeploymentPreviewPanel(): React.JSX.Element {
  const summary = useAppStore((s) => s.summary)
  const analyzing = useAppStore((s) => s.analyzing)
  const analysisError = useAppStore((s) => s.analysisError)
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const isStale = useAppStore(selectIsAnalysisStale)

  if (analysisError) {
    return (
      <div className="panel deployment-preview-panel deployment-preview-panel--error">
        계산 실패: {analysisError}
      </div>
    )
  }

  if (selectedHashes.size === 0) {
    return <div className="panel deployment-preview-panel">커밋을 선택하세요</div>
  }

  if (analyzing) {
    return <div className="panel deployment-preview-panel">계산 중...</div>
  }

  if (isStale || !summary) {
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
