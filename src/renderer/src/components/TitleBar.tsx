import { useAppStore } from '../store/appStore'

function basename(path: string): string {
  const normalized = path.replace(/[/\\]+$/, '')
  const parts = normalized.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

export function TitleBar(): React.JSX.Element {
  const repositoryPath = useAppStore((s) => s.repository.path)
  const selectedBranch = useAppStore((s) => s.selectedBranch)

  const repoLabel = repositoryPath ? basename(repositoryPath) : '—'
  const branchLabel = selectedBranch ?? '—'

  return (
    <header className="title-bar">
      Git Deploy Extractor — {repoLabel} / {branchLabel}
    </header>
  )
}
