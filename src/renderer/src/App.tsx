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
import { Credit } from './components/Credit'
import { SplitPane } from './components/SplitPane'

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
      <SplitPane
        className="vertical-main-split"
        direction="vertical"
        storageKey="gde:splitRatio:commitsVsFiles"
        defaultRatio={0.5}
        minStartPx={140}
        minEndPx={140}
        start={
          <SplitPane
            className="main-grid"
            storageKey="gde:splitRatio:mainGrid"
            defaultRatio={0.8}
            minStartPx={320}
            minEndPx={180}
            start={<CommitListPanel />}
            end={<DeploymentPreviewPanel />}
          />
        }
        end={<DeployFilesPanel />}
      />
      <DeleteListPanel />
      <FooterActionBar />
      <Credit />
    </div>
  )
}

export default App
