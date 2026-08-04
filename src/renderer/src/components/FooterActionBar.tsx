import { useAppStore, selectIsAnalysisStale } from '../store/appStore'

export function FooterActionBar(): React.JSX.Element {
  const profiles = useAppStore((s) => s.profiles)
  const selectedProfile = useAppStore((s) => s.selectedProfile)
  const setProfile = useAppStore((s) => s.setProfile)
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const runExport = useAppStore((s) => s.runExport)
  const exportStatus = useAppStore((s) => s.exportStatus)
  const exportError = useAppStore((s) => s.exportError)
  const lastExportDir = useAppStore((s) => s.lastExportDir)
  const isStale = useAppStore(selectIsAnalysisStale)

  const noSelection = selectedHashes.size === 0
  const exportDisabled = noSelection || isStale || exportStatus === 'exporting'

  return (
    <div className="panel footer-action-bar">
      <label>
        Mapping Profile :
        <select value={selectedProfile} onChange={(e) => setProfile(e.target.value)}>
          {profiles.map((profile) => (
            <option key={profile} value={profile}>
              {profile}
            </option>
          ))}
        </select>
      </label>
      <button disabled={exportDisabled} onClick={() => void runExport()}>
        {exportStatus === 'exporting' ? '내보내는 중...' : 'Export'}
      </button>
      {!noSelection && isStale && <div className="status-text">Preview를 먼저 실행하세요</div>}
      {exportStatus === 'done' && lastExportDir && (
        <div className="status-text status-text--success">Export 완료: {lastExportDir}</div>
      )}
      {exportStatus === 'error' && exportError && (
        <div className="status-text status-text--error">{exportError}</div>
      )}
    </div>
  )
}
