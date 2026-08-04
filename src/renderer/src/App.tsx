import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { TitleBar } from './components/TitleBar'
import { RepositoryPanel } from './components/RepositoryPanel'
import { BranchSearchBar } from './components/BranchSearchBar'
import { CommitListPanel } from './components/CommitListPanel'
import { DeploymentPreviewPanel } from './components/DeploymentPreviewPanel'
import { DeployFilesPanel } from './components/DeployFilesPanel'
import { DeleteListPanel } from './components/DeleteListPanel'
import { FooterActionBar } from './components/FooterActionBar'

function App(): React.JSX.Element {
  const initProfiles = useAppStore((s) => s.initProfiles)

  useEffect(() => {
    void initProfiles()
  }, [initProfiles])

  return (
    <div className="app-shell">
      <TitleBar />
      <RepositoryPanel />
      <BranchSearchBar />
      <div className="main-grid">
        <CommitListPanel />
        <DeploymentPreviewPanel />
      </div>
      <DeployFilesPanel />
      <DeleteListPanel />
      <FooterActionBar />
    </div>
  )
}

export default App
