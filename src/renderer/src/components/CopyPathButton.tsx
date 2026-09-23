import { useCopyToClipboard } from '../lib/useCopyToClipboard'
import { toRepoRelativePath } from '../lib/toRepoRelativePath'

export interface CopyPathButtonProps {
  path: string
  className?: string
}

// RT-53(§5.1 RT-53, U-18) — 5개 목록의 파일·폴더 행 공용 경로 복사
// 버튼. 상시 노출하지 않고 행 호버·포커스 시에만 보이게 하는 건 CSS
// (`.copy-path-button`, `visibility`)가 담당한다 — 이 컴포넌트는 항상
// DOM에 렌더링해 자리를 미리 확보한다(나타날 때 레이아웃이 밀리지
// 않게). 리프 행은 `<label>`이라 클릭이 체크 토글로 번질 수 있어
// `stopPropagation`+`preventDefault`를 반드시 건다.
export function CopyPathButton({ path, className }: CopyPathButtonProps): React.JSX.Element {
  const { status, copy } = useCopyToClipboard()

  const label = status === 'success' ? '✓' : status === 'error' ? '✕' : '⧉'
  const title =
    status === 'success'
      ? '복사됨'
      : status === 'error'
        ? '복사하지 못했습니다'
        : '경로 복사(저장소 기준 상대경로)'

  return (
    <>
      <button
        type="button"
        className={
          className
            ? `copy-path-button ${className}${status === 'error' ? ' copy-path-button--error' : ''}`
            : `copy-path-button${status === 'error' ? ' copy-path-button--error' : ''}`
        }
        title={title}
        aria-label={`경로 복사: ${path}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void copy(toRepoRelativePath(path))
        }}
      >
        {label}
      </button>
      {status === 'success' && (
        <span className="visually-hidden" role="status" aria-live="polite">
          경로를 복사했습니다
        </span>
      )}
      {status === 'error' && (
        <span className="visually-hidden" role="status" aria-live="polite">
          경로를 복사하지 못했습니다
        </span>
      )}
    </>
  )
}
