import type { CSSProperties } from 'react'
import type { RowComponentProps } from 'react-window'

export interface FileListItem {
  localPath: string
  checked: boolean
  extraLabel?: string // 예: "(인터페이스)" / "(구현체)" — 우측 패널 전용
}

// RT-41 — FileListColumn.tsx의 Row/VirtualRow를 그대로 옮겼다(동작 무변경).
export function FileRow({
  item,
  onToggle,
  style
}: {
  item: FileListItem
  onToggle: (localPath: string) => void
  style?: CSSProperties
}): React.JSX.Element {
  return (
    <div
      style={{ ...style, width: 'max-content' }}
      className="deploy-files-grid-row deploy-files-row"
    >
      {/* RT-16(U8) — 예전엔 파일명이 <span onClick>이라 마우스로만 토글
          가능했다(키보드로는 24px짜리 체크박스만 Tab으로 닿을 수 있었음).
          checkbox와 텍스트를 <label>로 감싸면 네이티브 브라우저 동작으로
          텍스트를 클릭해도 토글되고(기존 동작 유지), 체크박스에 포커스를
          두고 Space로도 토글된다(키보드 접근성). `display: contents`라
          .deploy-files-grid-row의 2열 grid(체크박스|경로)에는 그대로
          checkbox/span이 직접 배치된다(label 자체는 박스를 만들지 않음). */}
      <label className="deploy-files-row__label">
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.localPath)} />
        <span className="deploy-files-row__local deploy-files-row__local--clickable">
          {item.localPath}
          {item.extraLabel && (
            <span className="deploy-files-row__extra-label"> {item.extraLabel}</span>
          )}
        </span>
      </label>
    </div>
  )
}

export interface VirtualFileRowProps {
  items: FileListItem[]
  onToggle: (localPath: string) => void
}

export function VirtualFileRow({
  index,
  style,
  items,
  onToggle
}: RowComponentProps<VirtualFileRowProps>): React.JSX.Element {
  return <FileRow item={items[index]} onToggle={onToggle} style={style} />
}
