import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAppStore } from '../store/appStore'
import { WorkAreaPopupContext } from '../lib/workAreaPopupContext'
import type { OpenPopup } from '../lib/workAreaPopupContext'
import { PopupHost } from './PopupHost'
import { CollapsibleSection } from './CollapsibleSection'
import { SplitPane } from './SplitPane'
import { CommitWorkspaceSummary, CommitWorkspacePreviewAction } from './CommitWorkspaceHeader'
import { DeployFilesWorkspaceSummary } from './deployFiles/DeployFilesWorkspaceSummary'

export interface WorkAreaProps {
  // RT-47 — 예전엔 App.tsx가 조립한 세로 SplitPane 하나를 children으로
  // 통째로 받았다. 이제 WorkArea 자신이 CommitWorkspace/DeployFilesWorkspace
  // 접힘 상태(§5.1 RT-47 "상태는 WorkArea 소유")와 그 둘을 감싸는 세로
  // SplitPane을 직접 갖고 있어야 해서, 내용물 두 개를 이름 있는 슬롯으로
  // 받는다.
  commitWorkspace: ReactNode
  deployFilesWorkspace: ReactNode
}

interface SectionEventDetail {
  key: string
  name: string
  owner: 'local' | 'workArea'
}

// RT-43(§2.1·§2.3·§5.1) — openPopup의 유일한 소유자([L] 로컬 상태 —
// store에는 두지 않는다, 화면 전용 UI 상태라 새로고침 시 초기화되는 게
// 맞다). PreviewSummary와 DeployFilesWorkspace의 공통 부모라서 둘 중
// 어디서 올라오는 열기 이벤트든 받을 수 있다. 앵커: 이 컴포넌트가
// position:relative를 가져 PopupHost가 그리는 팝업이 이 영역 정중앙에
// 뜬다(기존엔 .deploy-files-panel이 앵커였다 — RT-15 주석 참고).
//
// RT-47 — CommitWorkspace/DeployFilesWorkspace 접힘 상태도 여기서
// 소유한다(§5.1 "상태는 WorkArea 소유" — 레이아웃 재분배가 이 컴포넌트의
// 세로 SplitPane 트랙 크기에 걸려 있으므로). 두 상태 다 미영속(M-7) —
// 새로고침하면 항상 펼침으로 시작한다.
export function WorkArea({
  commitWorkspace,
  deployFilesWorkspace
}: WorkAreaProps): React.JSX.Element {
  const [openPopup, setOpenPopup] = useState<OpenPopup>(null)
  const [commitsCollapsed, setCommitsCollapsed] = useState(false)
  const [deployCollapsed, setDeployCollapsed] = useState(false)
  const analyzing = useAppStore((s) => s.analyzing)
  const repositoryStatus = useAppStore((s) => s.repository.status)

  // 닫힘 조건(§5.1 RT-43) — Preview 재실행: analyzing이 켜지는 시점(재실행
  // 시작)에 닫는다. Reload(및 Browse...를 통한 저장소 전환): 재검증을
  // 시작하는 시점에 repository.status가 'validating'이 된다. React가
  // 권장하는 "렌더 중 이전 값과 비교해 조정" 패턴을 쓴다 — useEffect
  // 안에서 setState하면 커밋 후 추가 렌더가 한 번 더 생겨(react-hooks/
  // set-state-in-effect) 비효율적이다.
  const [prevAnalyzing, setPrevAnalyzing] = useState(analyzing)
  if (analyzing !== prevAnalyzing) {
    setPrevAnalyzing(analyzing)
    if (analyzing) setOpenPopup(null)
  }
  const [prevRepositoryStatus, setPrevRepositoryStatus] = useState(repositoryStatus)
  if (repositoryStatus !== prevRepositoryStatus) {
    setPrevRepositoryStatus(repositoryStatus)
    if (repositoryStatus === 'validating') setOpenPopup(null)
  }

  // RT-47(M-7) — "팝업이 열린 채로 (그 섹션을) 접으면 팝업을 닫는다".
  // WorkArea가 소유한 두 섹션(owner: 'workArea') 중 어느 쪽이 접혀도 열려
  // 있는 팝업을 닫는다 — 팝업 트리거(PreviewSummary/DeployFilesPanel)가
  // 정확히 어느 섹션 소속인지 이 컴포넌트가 굳이 구분하지 않아도, 두
  // 섹션 다 이 컴포넌트 산하라 안전하게 닫을 수 있다. CommitQueryBar
  // (owner: 'local')가 접히는 건 무시한다 — 그쪽엔 팝업 트리거가 없다.
  useEffect(() => {
    function handleSectionHide(event: Event): void {
      const detail = (event as CustomEvent<SectionEventDetail>).detail
      if (detail?.owner === 'workArea') setOpenPopup(null)
    }
    window.addEventListener('section:hide', handleSectionHide)
    return () => window.removeEventListener('section:hide', handleSectionHide)
  }, [])

  return (
    <div className="work-area fill-scroll">
      <WorkAreaPopupContext.Provider
        value={{ openPopup, open: setOpenPopup, close: () => setOpenPopup(null) }}
      >
        <SplitPane
          className="vertical-main-split fill-scroll"
          direction="vertical"
          storageKey="gde:splitRatio:commitsVsFiles"
          defaultRatio={0.45}
          minStartPx={90}
          minEndPx={120}
          startCollapsed={commitsCollapsed}
          endCollapsed={deployCollapsed}
          start={
            <CollapsibleSection
              sectionKey="commits"
              owner="workArea"
              fill
              title="커밋"
              collapsed={commitsCollapsed}
              onToggle={() => setCommitsCollapsed((v) => !v)}
              summary={<CommitWorkspaceSummary />}
              headerActions={<CommitWorkspacePreviewAction />}
            >
              {commitWorkspace}
            </CollapsibleSection>
          }
          end={
            <CollapsibleSection
              sectionKey="deployFiles"
              owner="workArea"
              fill
              title="배포 대상 파일"
              collapsed={deployCollapsed}
              onToggle={() => setDeployCollapsed((v) => !v)}
              summary={<DeployFilesWorkspaceSummary />}
            >
              {deployFilesWorkspace}
            </CollapsibleSection>
          }
        />
        <PopupHost />
      </WorkAreaPopupContext.Provider>
    </div>
  )
}
