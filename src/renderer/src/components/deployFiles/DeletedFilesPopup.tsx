import { Popup } from '../Popup'
import { useAppStore } from '../../store/appStore'
import { TreeList } from '../TreeList'
import type { TreeLeafInfo } from '../TreeList'
import { useTreeExpansion } from '../../lib/useTreeExpansion'

export interface DeletedFilesPopupProps {
  onClose: () => void
}

const ALWAYS_OPEN = (): boolean => true

interface DeleteEntryLike {
  path: string
}

const renderLeaf = (_item: DeleteEntryLike, info: TreeLeafInfo): React.JSX.Element => (
  <span>{info.name}</span>
)

// RT-44(U-1) — 기존 DeleteListPanel(화면 상시 노출)을 대체. PreviewSummary의
// `Deleted: N ▸`(N=0이면 비활성)로만 열린다.
//
// RT-53(§5.1 RT-53) — 평탄한 목록(RT-44 임시 구현)을 TreeList로 교체.
// 읽기 전용이라 renderFolder는 기본값(📁 이름 (개수))을 그대로 쓴다.
//
// M-12(결정): 표시 경로는 서버 경로(deleteList가 이미 서버 경로로 채워짐,
// analysisSlice.ts의 plan.deletedServerPaths 참고).
export function DeletedFilesPopup({ onClose }: DeletedFilesPopupProps): React.JSX.Element {
  const deleteList = useAppStore((s) => s.deleteList)
  const expansion = useTreeExpansion(ALWAYS_OPEN)

  return (
    <Popup title={`삭제된 파일 (${deleteList.length}개)`} onClose={onClose}>
      <TreeList
        items={deleteList}
        getPath={(entry) => entry.path}
        expansion={expansion}
        renderLeaf={renderLeaf}
        emptyMessage="없음"
      />
      <p className="status-text">extract-list.txt의 삭제 대상 섹션에 기록되는 경로입니다.</p>
    </Popup>
  )
}
