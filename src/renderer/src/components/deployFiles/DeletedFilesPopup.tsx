import { Popup } from '../Popup'
import { useAppStore } from '../../store/appStore'

export interface DeletedFilesPopupProps {
  onClose: () => void
}

// RT-44(U-1) — 기존 DeleteListPanel(화면 상시 노출)을 대체. PreviewSummary의
// `Deleted: N ▸`(N=0이면 비활성)로만 열린다.
//
// 본문은 평탄한 목록으로 우선 구현한다(2026-09-22 사용자 결정) — §5.1
// RT-44 명세는 "읽기 전용 트리(RT-53)"를 요구하지만 TreeList primitive가
// 아직 없다(RT-53 미착수). RT-53이 만들어지면 이 목록을 그걸로 교체한다.
//
// M-12(결정): 표시 경로는 서버 경로(deleteList가 이미 서버 경로로 채워짐,
// analysisSlice.ts의 plan.deletedServerPaths 참고).
export function DeletedFilesPopup({ onClose }: DeletedFilesPopupProps): React.JSX.Element {
  const deleteList = useAppStore((s) => s.deleteList)

  return (
    <Popup title={`삭제된 파일 (${deleteList.length}개)`} onClose={onClose}>
      {deleteList.length === 0 ? (
        <div className="status-text">없음</div>
      ) : (
        <ul className="popup-plain-list">
          {deleteList.map((entry) => (
            <li key={entry.path} title={entry.path}>
              {entry.path}
            </li>
          ))}
        </ul>
      )}
      <p className="status-text">extract-list.txt의 삭제 대상 섹션에 기록되는 경로입니다.</p>
    </Popup>
  )
}
