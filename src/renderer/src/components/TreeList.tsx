import type { ReactNode, CSSProperties } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { buildTree, compressChains, flatten } from '../lib/tree'
import type { FlatTreeRow } from '../lib/tree'
import type { TreeExpansion } from '../lib/useTreeExpansion'
import { CopyPathButton } from './CopyPathButton'

const VIRTUALIZE_THRESHOLD = 300
const ROW_HEIGHT = 28
const INDENT_PX = 14
const LEAF_EXTRA_INDENT_PX = 18

export interface TreeFolderInfo {
  path: string
  name: string
  fileCount: number
  open: boolean
  toggle: () => void
}

export interface TreeLeafInfo {
  path: string
  // 리프는 파일명만 표시하고 전체 경로는 title 툴팁이 담당한다(§5.1
  // RT-53) — path에서 마지막 세그먼트만 뽑아 미리 넘겨준다.
  name: string
}

export interface TreeListProps<T> {
  items: T[]
  getPath: (item: T) => string
  expansion: TreeExpansion
  // AddFilesPopup 탐색 트리는 3(1~2단계는 병합 안 함), 나머지는 기본 1.
  compactFromDepth?: number
  renderLeaf: (item: T, info: TreeLeafInfo) => ReactNode
  // 생략하면 "📁 이름 (개수)" 기본 폴더 행(읽기 전용 목록 — Deleted/경고/
  // AddFilesPopup 전용).
  renderFolder?: (info: TreeFolderInfo) => ReactNode
  emptyMessage: string
  // TreeList가 행마다 경로 복사 버튼을 자동으로 덧붙일지(U-18, 기본
  // true). Extract 목록처럼 ×와의 16px 간격·순서 규칙이 있는 곳은
  // false로 끄고 renderLeaf/renderFolder 안에서 직접 <CopyPathButton>을
  // 배치한다(컴포넌트 자체는 한 번만 구현하고 재사용하는 게 목적이라,
  // "누가 렌더링을 호출하느냐"는 자유롭게 둔다).
  copyable?: boolean
  // 공용 `.tree-row` 클래스에 덧붙일 목록별 클래스(선택) — 스타일 목적이
  // 아니라(모든 트리가 같은 시각 규칙을 공유한다) e2e 테스트가 "지금 이
  // 화면에 동시에 떠 있는 여러 TreeList 중 어느 것"을 구체적으로 짚을 수
  // 있게 하는 훅이다(예: 왼쪽/오른쪽 패널이 구조적으로 동일한 `.tree-row`
  // 를 동시에 렌더링하므로).
  rowClassName?: string
}

// RT-53(§5.1 RT-53, U-13·U-18) — 경로 배열을 트리로 보여주는 공용
// 컴포넌트. 순수 함수(buildTree/compressChains/flatten, lib/tree.ts)로
// 얻은 평탄화 행 배열을 렌더링만 담당하고, 펼침 상태는 `expansion`
// prop(useTreeExpansion, 호출부가 소유 — 목록마다 별도 인스턴스)으로
// 받는다. 300개 초과 시 react-window로 가상화(FileList.tsx/ExtractList.tsx
// 와 같은 패턴).
export function TreeList<T>({
  items,
  getPath,
  expansion,
  compactFromDepth = 1,
  renderLeaf,
  renderFolder,
  emptyMessage,
  copyable = true,
  rowClassName
}: TreeListProps<T>): React.JSX.Element {
  const tree = compressChains(buildTree(items, getPath), compactFromDepth)
  const rows = flatten(tree, expansion.isOpen)
  const extraClass = rowClassName ? ` ${rowClassName}` : ''

  const renderRow = (row: FlatTreeRow<T>, style?: CSSProperties): ReactNode => {
    const indent = row.depth * INDENT_PX + (row.kind === 'file' ? LEAF_EXTRA_INDENT_PX : 0)
    if (row.kind === 'folder') {
      const info: TreeFolderInfo = {
        path: row.path,
        name: row.name,
        fileCount: row.fileCount,
        open: expansion.isOpen(row.path),
        toggle: () => expansion.toggle(row.path)
      }
      return (
        <div
          key={row.path}
          className={`tree-row tree-row--folder${extraClass}`}
          style={{ ...style, paddingLeft: indent }}
          title={row.path}
        >
          <button
            type="button"
            className="tree-row__toggle"
            onClick={info.toggle}
            title={info.open ? '접기' : '펼치기'}
            aria-expanded={info.open}
          >
            {info.open ? '▾' : '▸'}
          </button>
          {renderFolder ? (
            renderFolder(info)
          ) : (
            <span className="tree-row__name tree-row__name--clickable" onClick={info.toggle}>
              📁 {row.name}
              <span className="tree-row__count"> {row.fileCount}</span>
            </span>
          )}
          {copyable && <CopyPathButton path={row.path} />}
        </div>
      )
    }
    return (
      <div
        key={row.path}
        className={`tree-row tree-row--file${extraClass}`}
        style={{ ...style, paddingLeft: indent }}
        title={row.path}
      >
        {renderLeaf(row.item, { path: row.path, name: row.name })}
        {copyable && <CopyPathButton path={row.path} />}
      </div>
    )
  }

  if (rows.length === 0) {
    return <div className="status-text">{emptyMessage}</div>
  }

  if (rows.length > VIRTUALIZE_THRESHOLD) {
    return (
      <List
        rowComponent={VirtualTreeRow<T>}
        rowCount={rows.length}
        rowHeight={ROW_HEIGHT}
        rowProps={{ rows, renderRow }}
        style={{ height: '100%' }}
      />
    )
  }

  return <>{rows.map((row) => renderRow(row, { height: ROW_HEIGHT }))}</>
}

function VirtualTreeRow<T>({
  index,
  style,
  rows,
  renderRow
}: RowComponentProps<{
  rows: FlatTreeRow<T>[]
  renderRow: (row: FlatTreeRow<T>, style?: CSSProperties) => ReactNode
}>): React.JSX.Element {
  return <>{renderRow(rows[index], style)}</>
}
