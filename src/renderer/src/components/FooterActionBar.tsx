import { useAppStore, selectIsAnalysisStale } from '../store/appStore'
import { useCopyToClipboard } from '../lib/useCopyToClipboard'
import { formatDeployDirDisplay } from '../lib/exportPath'
import { ExportModeSelect } from './ExportModeSelect'

// RISK_ISSUES.md §7.1: Mapping Profile 드롭다운은 화면에서 숨긴다 —
// "default" 하나뿐이고 편집 UI도 없어 사실상 무의미하다. 내부 로직은
// selectedProfile: 'default'를 그대로 계산에 넘긴다(동작 변경 없음).
export function FooterActionBar(): React.JSX.Element {
  const exportParentDir = useAppStore((s) => s.exportParentDir)
  const exportMode = useAppStore((s) => s.exportMode)
  const setExportMode = useAppStore((s) => s.setExportMode)
  const exportTargetValidation = useAppStore((s) => s.exportTargetValidation)
  const browseExportParentDir = useAppStore((s) => s.browseExportParentDir)
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const runExport = useAppStore((s) => s.runExport)
  const exportStatus = useAppStore((s) => s.exportStatus)
  const exportError = useAppStore((s) => s.exportError)
  const lastExportDir = useAppStore((s) => s.lastExportDir)
  const isStale = useAppStore(selectIsAnalysisStale)
  const analyzing = useAppStore((s) => s.analyzing)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const { status: copyStatus, copy } = useCopyToClipboard()

  const noSelection = selectedHashes.size === 0
  // RT-56(U-16) — 경로 미선택/저장소와 겹침/direct에서 폴더가 비어 있지
  // 않음(NO_PATH/INSIDE_REPO/CONTAINS_REPO/NOT_EMPTY)이 Preview 계산 중·
  // 의존성 확인 중(RT-17)보다 먼저 표시된다(§5.1 RT-56 검사 우선순위).
  const targetError =
    exportTargetValidation && !exportTargetValidation.ok ? exportTargetValidation : null
  const targetBlocked = targetError !== null
  // RT-17(R4·R5) — Preview 계산 중(analyzing)이거나 의존성 확인 중
  // (dependencyAnalyzing)이면 Export를 막는다(확인창 대안은 채택 안 함,
  // 2026-09-21 사용자 결정). 의존성 분석이 실패하거나 적용 불가로
  // 끝나면(dependencyAnalyzing이 꺼짐) 자동으로 다시 활성화된다.
  const exportDisabled =
    noSelection ||
    isStale ||
    exportStatus === 'exporting' ||
    analyzing ||
    dependencyAnalyzing ||
    targetBlocked
  const displayedExportDir = exportParentDir
    ? formatDeployDirDisplay(exportParentDir, exportMode)
    : null

  return (
    <div className="panel footer-action-bar">
      <button onClick={() => void browseExportParentDir()}>변경</button>
      <span className="footer-action-bar__export-path" title={displayedExportDir ?? undefined}>
        {displayedExportDir ?? '추출할 폴더를 선택하세요'}
      </span>
      <ExportModeSelect
        value={exportMode}
        onChange={setExportMode}
        disabled={exportStatus === 'exporting'}
      />
      <button
        className="button--primary"
        disabled={exportDisabled}
        onClick={() => void runExport()}
      >
        {exportStatus === 'exporting' ? '내보내는 중...' : 'Export'}
      </button>
      {/* RT-56: 경로 검증 실패가 가장 먼저, 그다음 RT-17 분석 중 메시지,
          마지막이 isStale이다 — 분석 중엔 analyzedSelection이 아직 옛
          선택을 가리켜 isStale도 함께 true가 되므로, 우선순위를 안 두면
          서로 다른 메시지가 동시에 조건을 만족해 혼란스러워진다. */}
      {!noSelection && targetError && (
        <div className="status-text status-text--error">{targetError.message}</div>
      )}
      {!noSelection && !targetBlocked && analyzing && (
        <div className="status-text">Preview 계산 중입니다 — 완료 후 Export할 수 있습니다.</div>
      )}
      {!noSelection && !targetBlocked && !analyzing && dependencyAnalyzing && (
        <div className="status-text">의존성 확인 중입니다 — 완료 후 Export할 수 있습니다.</div>
      )}
      {!noSelection && !targetBlocked && !analyzing && !dependencyAnalyzing && isStale && (
        <div className="status-text">Preview를 먼저 실행하세요</div>
      )}
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
