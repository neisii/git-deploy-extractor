import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { RepositoryPanel } from './components/RepositoryPanel'
import { BranchSearchBar } from './components/BranchSearchBar'
import { CommitListPanel } from './components/CommitListPanel'
import { PreviewSummary } from './components/PreviewSummary'
import { DeployFilesPanel } from './components/DeployFilesPanel'
import { FooterActionBar } from './components/FooterActionBar'
import { Credit } from './components/Credit'
import { SplitPane } from './components/SplitPane'
import { WorkArea } from './components/WorkArea'

function App(): React.JSX.Element {
  const initProfiles = useAppStore((s) => s.initProfiles)
  const loadAppVersion = useAppStore((s) => s.loadAppVersion)
  const initUpdateCheck = useAppStore((s) => s.initUpdateCheck)

  useEffect(() => {
    void initProfiles()
    void loadAppVersion()
    void initUpdateCheck()
  }, [initProfiles, loadAppVersion, initUpdateCheck])

  return (
    <div className="app-shell">
      <RepositoryPanel />
      <BranchSearchBar />
      <WorkArea
        commitWorkspace={
          <SplitPane
            className="main-grid"
            storageKey="gde:splitRatio:mainGrid"
            defaultRatio={0.8}
            minStartPx={320}
            minEndPx={180}
            start={<CommitListPanel />}
            end={<PreviewSummary />}
          />
        }
        deployFilesWorkspace={<DeployFilesPanel />}
      />
      <FooterActionBar />
      <Credit />
    </div>
  )
}

export default App
