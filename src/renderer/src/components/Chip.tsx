import type { ReactNode } from 'react'

export type ChipVariant = 'exclude' | 'include' | 'manual'

export interface ChipProps {
  label: string
  variant: ChipVariant
  // 토글 개념이 없는 칩(예: 수동 추가 이력)은 항상 on으로 둔다.
  on?: boolean
  // 없으면 라벨은 버튼이 아니라 순수 텍스트로 렌더링된다(토글 불가능한 칩).
  onToggle?: () => void
  // 없으면 × 버튼 자체를 그리지 않는다.
  onRemove?: () => void
  removeLabel?: string
  badge?: ReactNode
  secondaryText?: ReactNode
  title?: string
}

// RT-40 — 라벨 버튼과 × 버튼을 별도 `<button>` 두 개로 분리한다(하나의
// `<button>` 안에 다른 `<button>`을 중첩할 수 없다는 HTML 제약,
// RT-24 결정 이력과 같은 이유 — 기존 exclude-pattern-chip이 이미
// 이 구조였다, 이 primitive가 그 패턴을 일반화한다).
export function Chip({
  label,
  variant,
  on = true,
  onToggle,
  onRemove,
  removeLabel,
  badge,
  secondaryText,
  title
}: ChipProps): React.JSX.Element {
  const className = ['chip', `chip--${variant}`, on ? 'chip--on' : 'chip--off'].join(' ')

  return (
    <span className={className} title={title}>
      {onToggle ? (
        <button type="button" className="chip__label" onClick={onToggle}>
          {label}
        </button>
      ) : (
        <span className="chip__label">{label}</span>
      )}
      {badge != null && <span className="chip__badge">{badge}</span>}
      {secondaryText != null && <span className="chip__secondary">{secondaryText}</span>}
      {onRemove && (
        <button
          type="button"
          className="chip__remove"
          onClick={onRemove}
          aria-label={removeLabel ?? `${label} 삭제`}
        >
          ×
        </button>
      )}
    </span>
  )
}
