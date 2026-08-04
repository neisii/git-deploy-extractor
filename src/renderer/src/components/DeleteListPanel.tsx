import { useAppStore, selectIsAnalysisStale } from '../store/appStore'

export function DeleteListPanel(): React.JSX.Element {
  const deleteList = useAppStore((s) => s.deleteList)
  const isStale = useAppStore(selectIsAnalysisStale)

  return (
    <div className="panel delete-list-panel">
      <div className="delete-list-panel__header">Delete List</div>
      {isStale ? (
        <div className="status-text">선택이 변경되었습니다 — Preview를 눌러 계산하세요</div>
      ) : deleteList.length === 0 ? (
        <div className="status-text">없음</div>
      ) : (
        <ul>
          {deleteList.map((entry) => (
            <li key={entry.path}>{entry.path}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
