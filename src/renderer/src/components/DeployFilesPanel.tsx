import { useAppStore } from '../store/appStore'
import type { DeployFilesFilter } from '../store/appStore'

// REQ-011(개별/전체 선택)은 Phase 5에서 구현한다. Phase 4에서는 체크박스가
// 항상 선택된 상태로만 표시되고 조작할 수 없다(PHASE_PLAN.md §2.4).
export function DeployFilesPanel(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filter = useAppStore((s) => s.deployFilesFilter)
  const setFilter = useAppStore((s) => s.setDeployFilesFilter)
  const warnings = useAppStore((s) => s.warnings)

  const filtered = filter === 'all' ? deployFiles : deployFiles.filter((f) => f.status === filter)

  return (
    <div className="panel deploy-files-panel">
      <div className="deploy-files-panel__header">
        <span>Deploy Files (HEAD Latest Version)</span>
        <label>
          Filter:
          <select value={filter} onChange={(e) => setFilter(e.target.value as DeployFilesFilter)}>
            <option value="all">All</option>
            <option value="added">Added</option>
            <option value="modified">Modified</option>
          </select>
        </label>
      </div>
      {warnings.length > 0 && (
        <div className="warning-banner">{warnings.length}개 파일이 HEAD에 없어 제외되었습니다</div>
      )}
      <table className="deploy-files-panel__table">
        <thead>
          <tr>
            <th></th>
            <th>Local Path</th>
            <th>Server Path</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((file) => (
            <tr key={file.localPath}>
              <td>
                <input type="checkbox" checked readOnly />
              </td>
              <td>{file.localPath}</td>
              <td>{file.localPath === file.serverPath ? '(경로 그대로 유지)' : file.serverPath}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
