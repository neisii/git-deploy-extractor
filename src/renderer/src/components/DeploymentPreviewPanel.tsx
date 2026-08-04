import { useAppStore } from '../store/appStore'

export function DeploymentPreviewPanel(): React.JSX.Element {
  const summary = useAppStore((s) => s.summary)
  const analyzing = useAppStore((s) => s.analyzing)
  const analysisError = useAppStore((s) => s.analysisError)
  const selectedHashes = useAppStore((s) => s.selectedHashes)

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

  if (analyzing || !summary) {
    return <div className="panel deployment-preview-panel">계산 중...</div>
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
