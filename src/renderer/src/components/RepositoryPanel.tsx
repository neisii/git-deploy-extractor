import { useAppStore } from '../store/appStore'

function basename(path: string): string {
  const normalized = path.replace(/[/\\]+$/, '')
  const parts = normalized.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

// REQ-018/DR-017 — 원래 별도 행(TitleBar)이었으나, 경로 텍스트와 한 행에
// 합치면서 이 컴포넌트로 흡수했다(RISK_ISSUES.md 결정 이력 #38). remote
// 이름이 로컬 폴더명과 다르면 폴더명을 부가정보로 괄호 표시, 같으면
// 중복 표시 안 함, remote가 없으면 폴더명만.
function RepoLabel({
  repositoryPath,
  remoteProjectName
}: {
  repositoryPath: string | null
  remoteProjectName: string | null
}): React.JSX.Element {
  if (!repositoryPath) return <>—</>

  const folderName = basename(repositoryPath)
  if (!remoteProjectName || remoteProjectName === folderName) {
    return <>{remoteProjectName ?? folderName}</>
  }
  return (
    <>
      {remoteProjectName} <span className="repository-panel__title-local">({folderName})</span>
    </>
  )
}

// REQ-017/DR-016. updateChecking과 updateInfo는 서로 독립적으로 갱신되므로
// (재확인 중에도 직전 값을 그대로 보여주며 스피너만 얹는다), 순수 함수로
// 뽑아 렌더링 분기를 한곳에 모은다 — 실패/최초 확인 중을 구분하지 않으면
// 아직 실패하지 않은 최초 확인 중에도 "확인 실패" 툴팁이 잘못 뜬다.
function updateBadgeState(
  updateInfo: { hasUpdate: boolean; latestVersion: string } | null,
  updateChecking: boolean
): { highlighted: boolean; title: string } {
  if (updateInfo) {
    return updateInfo.hasUpdate
      ? { highlighted: true, title: `새 버전으로 업데이트 하세요 (v${updateInfo.latestVersion})` }
      : { highlighted: false, title: '최신 버전입니다' }
  }
  if (updateChecking) {
    return { highlighted: false, title: '업데이트 확인 중...' }
  }
  return { highlighted: false, title: '업데이트 확인 실패 — 인터넷 연결을 확인하세요' }
}

export function RepositoryPanel(): React.JSX.Element {
  const repository = useAppStore((s) => s.repository)
  const remoteProjectName = useAppStore((s) => s.remoteProjectName)
  const selectedBranch = useAppStore((s) => s.selectedBranch)
  const browseRepository = useAppStore((s) => s.browseRepository)
  const reloadRepository = useAppStore((s) => s.reloadRepository)
  const appVersion = useAppStore((s) => s.appVersion)
  const updateInfo = useAppStore((s) => s.updateInfo)
  const updateChecking = useAppStore((s) => s.updateChecking)
  const clickUpdateBadge = useAppStore((s) => s.clickUpdateBadge)

  const badge = updateBadgeState(updateInfo, updateChecking)

  return (
    <section className="panel repository-panel">
      <div className="repository-panel__title">
        <RepoLabel repositoryPath={repository.path} remoteProjectName={remoteProjectName} /> /{' '}
        {selectedBranch ?? '—'}
      </div>
      <div className="repository-panel__path" title={repository.path ?? undefined}>
        {repository.path ?? '저장소를 선택하세요'}
      </div>
      <div className="repository-panel__right">
        <div className="repository-panel__actions">
          <button onClick={() => void browseRepository()}>Browse...</button>
          <button onClick={() => void reloadRepository()} disabled={!repository.path}>
            Reload
          </button>
        </div>
        {appVersion && (
          <button
            type="button"
            className={
              badge.highlighted
                ? 'repository-panel__update-badge repository-panel__update-badge--available'
                : 'repository-panel__update-badge'
            }
            title={badge.title}
            onClick={() => clickUpdateBadge()}
          >
            v{appVersion}
            {updateChecking && (
              <span className="repository-panel__update-spinner" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {repository.status === 'validating' && <div className="status-text">확인 중...</div>}
      {repository.status === 'invalid' && (
        <div className="status-text status-text--error">{repository.error}</div>
      )}
    </section>
  )
}
