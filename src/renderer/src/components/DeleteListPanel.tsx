import { useAppStore } from '../store/appStore'

export function DeleteListPanel(): React.JSX.Element {
  const deleteList = useAppStore((s) => s.deleteList)

  return (
    <div className="panel delete-list-panel">
      <div className="delete-list-panel__header">Delete List</div>
      {deleteList.length === 0 ? (
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
