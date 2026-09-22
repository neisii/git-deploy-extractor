import { useMemo, useState } from 'react'
import { Popup } from '../Popup'
import { useAppStore } from '../../store/appStore'
import { includedPathsSet } from '../../lib/includedPathsSet'

const RESULT_LIMIT = 50

export interface ManualAddPopupProps {
  onClose: () => void
}

// REQ-021/DR-019 — 배포 대상 파일 수동 추가 팝업. 좌우 두 FilePane을
// 감싸는 WorkArea 중앙에 고정 크기로 뜬다.
//
// RT-43 — PopupHost가 렌더링하면서 이 컴포넌트도 IncludedFilesPane 등
// 다른 *Pane과 같은 방식으로 스토어를 직접 구독하는 D4+ 컨테이너가
// 됐다(이전엔 DeployFilesPanel이 열림 상태와 후보/이력을 props로
// 내려줬음).
//
// RT-44 — dependencyParseWarnings(파싱 실패 경고)를 임시로 이 팝업
// 상단에 표시한다. §5.1 RT-44 명세는 최종적으로 AddFilesPopup(RT-52)
// 상단 분석 상태 안내 줄로 옮기라고 하지만 RT-52(단일 화면 HEAD 트리
// 팝업으로 개편)가 아직 없어, 우선 지금의 ManualAddPopup에 임시로
// 둔다(2026-09-22 사용자 결정) — RT-52가 이 팝업을 AddFilesPopup으로
// 교체할 때 함께 옮겨간다.
//
// RT-15 — 백드롭·박스·닫기 버튼·Esc·포커스 트랩은 공용 Popup 컴포넌트로
// 옮겨졌다(U5).
export function ManualAddPopup({ onClose }: ManualAddPopupProps): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const headTreeFiles = useAppStore((s) => s.headTreeFiles)
  const manuallyAddedPaths = useAppStore((s) => s.manuallyAddedPaths)
  const dependencyParseWarnings = useAppStore((s) => s.dependencyParseWarnings)
  const addManualFile = useAppStore((s) => s.addManualFile)
  const removeManualFile = useAppStore((s) => s.removeManualFile)

  const [query, setQuery] = useState('')

  // REQ-021/DR-019 — 이미 deployFiles에 있는 경로는 후보에서 미리
  // 제외한다(선택해도 무의미한 no-op이 되는 걸 방지).
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])
  const candidates = useMemo(
    () => headTreeFiles.filter((path) => !includedSet.has(path)),
    [headTreeFiles, includedSet]
  )

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []
    return candidates.filter((path) => path.toLowerCase().includes(trimmed)).slice(0, RESULT_LIMIT)
  }, [candidates, query])

  return (
    <Popup title="파일 추가" onClose={onClose}>
      {dependencyParseWarnings.length > 0 && (
        <div className="warning-banner">
          {dependencyParseWarnings.length}개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다
        </div>
      )}
      <input
        type="text"
        autoFocus
        value={query}
        placeholder="경로 일부 입력..."
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="manual-add-popup__results">
          {results.map((path) => (
            <li key={path} title={path}>
              <span className="manual-add-popup__result-path">{path}</span>
              <button type="button" onClick={() => void addManualFile(path)}>
                추가
              </button>
            </li>
          ))}
        </ul>
      )}
      {manuallyAddedPaths.length > 0 && (
        <div className="manual-add-popup__chips">
          {manuallyAddedPaths.map((path) => (
            <button
              key={path}
              type="button"
              className="manual-add-popup__chip"
              onClick={() => removeManualFile(path)}
              title="클릭하면 배포 대상에서 뺍니다"
            >
              {path} ×
            </button>
          ))}
        </div>
      )}
    </Popup>
  )
}
