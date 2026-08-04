import { useAppStore } from '../store/appStore'

export function RepositoryPanel(): React.JSX.Element {
  const repository = useAppStore((s) => s.repository)
  const browseRepository = useAppStore((s) => s.browseRepository)
  const reloadRepository = useAppStore((s) => s.reloadRepository)

  return (
    <section className="panel repository-panel">
      <div className="repository-panel__path">{repository.path ?? '저장소를 선택하세요'}</div>
      <div className="repository-panel__actions">
        <button onClick={() => void browseRepository()}>Browse...</button>
        <button onClick={() => void reloadRepository()} disabled={!repository.path}>
          Reload
        </button>
      </div>
      {repository.status === 'validating' && <div className="status-text">확인 중...</div>}
      {repository.status === 'invalid' && (
        <div className="status-text status-text--error">{repository.error}</div>
      )}
    </section>
  )
}
