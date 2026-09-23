import type { ExportMode } from '../../../shared/types'

export interface ExportModeSelectProps {
  value: ExportMode
  onChange: (mode: ExportMode) => void
  disabled?: boolean
}

// RT-56(U-16) — Export 버튼 왼쪽의 방식 선택 드롭다운.
export function ExportModeSelect({
  value,
  onChange,
  disabled
}: ExportModeSelectProps): React.JSX.Element {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ExportMode)}
      aria-label="Export 방식"
    >
      <option value="sub">git-deploy-extracted 폴더 생성 후 추출</option>
      <option value="direct">선택한 경로에 바로 추출</option>
    </select>
  )
}
