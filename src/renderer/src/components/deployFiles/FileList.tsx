import { List } from 'react-window'
import type { FileListItem } from './FileRow'
import { FileRow, VirtualFileRow } from './FileRow'
import { TriStateCheckbox } from '../TriStateCheckbox'
import { useMeasuredColumnWidth } from '../../lib/useMeasuredColumnWidth'

const VIRTUALIZE_THRESHOLD = 300
const ROW_HEIGHT = 28

export type { FileListItem }

// 좌우 둘 다 같은 체크박스 하나로 통일됐다(우측도 "전체 추가"에서 "전체
// 선택"으로 바뀌면서 kind:'button' 변형이 더 이상 쓰이지 않게 되어 제거).
export interface BulkSelectAction {
  checked: boolean
  indeterminate: boolean
  onClick: () => void
}

function displayText(item: FileListItem): string {
  return item.extraLabel ? `${item.localPath} ${item.extraLabel}` : item.localPath
}

export interface FileListProps {
  items: FileListItem[] // 상태 필터 + 검색 + 제외 패턴이 이미 적용된 상태로 전달받는다
  onToggleItem: (localPath: string) => void
  bulkAction: BulkSelectAction
  emptyMessage: string
}

// RT-41(S4·U1) — FileListColumn.tsx에서 검색·제외 패턴 등 툴바 UI(이제
// FilePane의 toolbar 슬롯으로 옮겨감)를 뺀 목록 부분만 남긴 컴포넌트.
// 컬럼 리사이즈 핸들·"Local Path" 헤더 글자·useColumnResize·컬럼 폭
// localStorage 저장은 삭제했다(사용자 결정 2026-09-21 — 컬럼이 하나뿐이고
// 행에 파일명만 보여 의미가 없어짐). 헤더 행은 이제 "전체 선택"
// TriStateCheckbox 하나만 남는다(REQ-020).
export function FileList({
  items,
  onToggleItem,
  bulkAction,
  emptyMessage
}: FileListProps): React.JSX.Element {
  const itemTexts = items.map(displayText)
  const { naturalWidth, probeRef } = useMeasuredColumnWidth(itemTexts)

  return (
    <div
      className="file-list__scroll"
      style={{ '--local-col-natural': `${naturalWidth}px` } as React.CSSProperties}
    >
      <div className="deploy-files-grid-row file-list__header-row">
        <TriStateCheckbox
          checked={bulkAction.checked}
          indeterminate={bulkAction.indeterminate}
          onChange={() => bulkAction.onClick()}
          aria-label="전체 선택"
          title="화면에 보이는 변경 파일을 모두 Extract 대상으로 이동"
        />
        {/* 컬럼 실측 폭 계산용 — 화면에 보이지 않고 레이아웃에도 관여하지 않는다 */}
        <span
          ref={probeRef}
          className="deploy-files-row__local deploy-files-measure-probe"
          aria-hidden
        />
      </div>
      <div className="file-list__body">
        {items.length === 0 ? (
          <div className="status-text">{emptyMessage}</div>
        ) : items.length > VIRTUALIZE_THRESHOLD ? (
          <List
            rowComponent={VirtualFileRow}
            rowCount={items.length}
            rowHeight={ROW_HEIGHT}
            rowProps={{ items, onToggle: onToggleItem }}
            // DETAILED_DESIGN.md §12.2 — react-window List가 세로 가상
            // 스크롤을 위해 자기 루트에 overflowY:auto를 설정하면 CSS
            // 스펙상 overflow-x도 auto로 강제 승격되어, 바깥 컨테이너
            // (.file-list__scroll)와 별개로 자체 가로 스크롤 컨텍스트가
            // 생겼다(300개 초과 시 재현 확인). 이 컴포넌트가 내부에서
            // style prop을 마지막에 spread한다는 걸 소스로 확인해
            // overflowX:hidden으로 억제 — 가로 스크롤은 항상 바깥
            // 컨테이너 하나만 담당하게 한다.
            style={{ height: '100%', overflowX: 'hidden' }}
          />
        ) : (
          items.map((item) => (
            <FileRow
              key={item.localPath}
              item={item}
              onToggle={onToggleItem}
              style={{ height: ROW_HEIGHT }}
            />
          ))
        )}
      </div>
    </div>
  )
}
