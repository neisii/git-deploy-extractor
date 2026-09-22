import { useAppStore, selectIsAnalysisStale } from '../store/appStore'
import { useCopyToClipboard } from '../lib/useCopyToClipboard'

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
  const { status: copyStatus, copy } = useCopyToClipboard()

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
        <>
          {/* RT-16(U7): 경로 자체는 길면 ellipsis로 잘리므로(min-width:0,
              overflow:hidden), 복사 피드백은 그 안에 이어붙이지 않고
              별도 flex 아이템으로 둔다 — 잘려서 안 보이는 걸 방지. */}
          <div
            className="status-text status-text--success status-text--copyable"
            title={lastExportDir}
            onClick={() => void copy(lastExportDir)}
          >
            Export 완료: {lastExportDir}
          </div>
          {copyStatus === 'success' && (
            <span className="status-text status-text--success">✓ 복사됨</span>
          )}
          {copyStatus === 'error' && (
            <span className="status-text status-text--error">복사하지 못했습니다</span>
          )}
          <span className="visually-hidden" aria-live="polite">
            {copyStatus === 'success' && '경로를 복사했습니다'}
            {copyStatus === 'error' && '경로 복사에 실패했습니다'}
          </span>
        </>
      )}
      {exportStatus === 'error' && exportError && (
        <div className="status-text status-text--error">{exportError}</div>
      )}
    </div>
  )
}
