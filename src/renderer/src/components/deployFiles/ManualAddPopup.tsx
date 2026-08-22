import { useMemo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

// REQ-021/DR-019 — 배포 대상 파일 수동 추가 팝업. 좌우 두 FileListColumn을
// 감싸는 부모(.deploy-files-panel) 중앙에 고정 크기로 뜬다. 정정
// (2026-08-22): 원래는 "포함된 파일" 목록을 가리지 않는 위치/높이를 실측해서
// 띄우는 형태였으나, 목록을 가려도 상관없다는 결정으로 단순화됐다 — 대신
// 이 팝업 안의 "수동 추가 이력" 칩이 무엇을 추가했는지 강조색으로 보여주는
// 역할을 대신한다(RISK_ISSUES.md 결정 이력 참고).

const RESULT_LIMIT = 50

interface ManualAddPopupProps {
  candidates: string[] // 이미 deployFiles에 있는 경로는 호출부가 미리 제외하고 내려준다
  addedPaths: string[] // 이번 Preview 결과에 수동으로 추가한 파일(칩 이력)
  onAdd: (localPath: string) => void
  onRemove: (localPath: string) => void
  onClose: () => void
}

export function ManualAddPopup({
  candidates,
  addedPaths,
  onAdd,
  onRemove,
  onClose
}: ManualAddPopupProps): React.JSX.Element {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []
    return candidates.filter((path) => path.toLowerCase().includes(trimmed)).slice(0, RESULT_LIMIT)
  }, [candidates, query])

  const stopPropagation = (e: ReactMouseEvent): void => e.stopPropagation()

  return (
    <div className="manual-add-backdrop" onClick={onClose}>
      <div className="manual-add-popup" onClick={stopPropagation}>
        <div className="manual-add-popup__header">
          <span>파일 추가</span>
          <button type="button" onClick={onClose} title="닫기">
            ×
          </button>
        </div>
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
                <button type="button" onClick={() => onAdd(path)}>
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}
        {addedPaths.length > 0 && (
          <div className="manual-add-popup__chips">
            {addedPaths.map((path) => (
              <button
                key={path}
                type="button"
                className="manual-add-popup__chip"
                onClick={() => onRemove(path)}
                title="클릭하면 배포 대상에서 뺍니다"
              >
                {path} ×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
