import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { DeployFilesWorkspace } from './deployFiles/DeployFilesWorkspace'
import { ManualAddPopup } from './deployFiles/ManualAddPopup'
import { includedPathsSet } from '../lib/includedPathsSet'

// RT-42 — 좌우 패널 조립 로직을 IncludedFilesPane/MissingDependenciesPane/
// DeployFilesWorkspace로 옮긴 뒤, 이 컴포넌트에는 제목·경고 배너·
// ManualAddPopup 배치만 남았다(RT-44가 제목·배너를 다시 정리할 예정 —
// 이번엔 손대지 않는다).
export function DeployFilesPanel(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const warnings = useAppStore((s) => s.warnings)
  const dependencyParseWarnings = useAppStore((s) => s.dependencyParseWarnings)

  // REQ-021/DR-019 — 배포 대상 파일 수동 추가
  const headTreeFiles = useAppStore((s) => s.headTreeFiles)
  const manuallyAddedPaths = useAppStore((s) => s.manuallyAddedPaths)
  const addManualFile = useAppStore((s) => s.addManualFile)
  const removeManualFile = useAppStore((s) => s.removeManualFile)
  // 팝업 열림 상태는 store에 둘 이유가 없는 순수 UI 상태다 — 부모
  // (.deploy-files-panel) 중앙에 띄우려면 좌우 두 Pane과 같은 레벨(여기)에서
  // 소유해야 한다(2026-08-22 정정 — 원래는 FileListColumn 로컬 상태였음).
  const [manualAddOpen, setManualAddOpen] = useState(false)

  // RT-42 — IncludedFilesPane도 독립적으로 이 값을 구하지만(useIncludedFilesView
  // 내부), 여기선 그 훅 전체를 또 부르지 않고 저렴한 파생만 재사용한다.
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  // REQ-021/DR-019 — 이미 deployFiles에 있는 경로는 후보에서 미리 제외한다
  // (선택해도 무의미한 no-op이 되는 걸 방지 — 팝업 쪽은 순수 문자열 필터만
  // 하면 되도록 여기서 미리 정리해서 내려준다).
  const manualAddCandidates = useMemo(
    () => headTreeFiles.filter((path) => !includedSet.has(path)),
    [headTreeFiles, includedSet]
  )

  return (
    <div className="deploy-files-panel">
      <div className="deploy-files-panel__title">Deploy Files (HEAD Latest Version)</div>
      {warnings.length > 0 && (
        <div className="warning-banner">{warnings.length}개 파일이 HEAD에 없어 제외되었습니다</div>
      )}
      {dependencyParseWarnings.length > 0 && (
        <div className="warning-banner">
          {dependencyParseWarnings.length}개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다
        </div>
      )}
      <DeployFilesWorkspace onOpenManualAdd={() => setManualAddOpen(true)} />
      {manualAddOpen && (
        <ManualAddPopup
          candidates={manualAddCandidates}
          addedPaths={manuallyAddedPaths}
          onAdd={addManualFile}
          onRemove={removeManualFile}
          onClose={() => setManualAddOpen(false)}
        />
      )}
    </div>
  )
}
