import { useAppStore, selectIsAnalysisStale } from '../store/appStore'

// RISK_ISSUES.md §7.1: Mapping Profile 드롭다운은 화면에서 숨긴다 —
// "default" 하나뿐이고 편집 UI도 없어 사실상 무의미하다. 내부 로직은
// selectedProfile: 'default'를 그대로 계산에 넘긴다(동작 변경 없음).
export function FooterActionBar(): React.JSX.Element {
  const repository = useAppStore((s) => s.repository)
  const exportParentDir = useAppStore((s) => s.exportParentDir)
  const browseExportParentDir = useAppStore((s) => s.browseExportParentDir)
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const runExport = useAppStore((s) => s.runExport)
  const exportStatus = useAppStore((s) => s.exportStatus)
  const exportError = useAppStore((s) => s.exportError)
  const lastExportDir = useAppStore((s) => s.lastExportDir)
  const isStale = useAppStore(selectIsAnalysisStale)

  const noSelection = selectedHashes.size === 0
  const exportDisabled = noSelection || isStale || exportStatus === 'exporting'
  const displayedExportDir = exportParentDir ?? repository.path ?? '저장소를 선택하세요'

  return (
    <div className="panel footer-action-bar">
      <button onClick={() => void browseExportParentDir()}>변경</button>
      <span className="footer-action-bar__export-path" title={displayedExportDir}>
        {displayedExportDir}
      </span>
      <button
        className="button--primary"
        disabled={exportDisabled}
        onClick={() => void runExport()}
      >
        {exportStatus === 'exporting' ? '내보내는 중...' : 'Export'}
      </button>
      {!noSelection && isStale && <div className="status-text">Preview를 먼저 실행하세요</div>}
      {exportStatus === 'done' && lastExportDir && (
        <div
          className="status-text status-text--success status-text--copyable"
          title={lastExportDir}
          onClick={() => void navigator.clipboard.writeText(lastExportDir)}
        >
          Export 완료: {lastExportDir}
        </div>
      )}
      {exportStatus === 'error' && exportError && (
        <div className="status-text status-text--error">{exportError}</div>
      )}
    </div>
  )
}
