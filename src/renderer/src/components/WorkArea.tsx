import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAppStore } from '../store/appStore'
import { WorkAreaPopupContext } from '../lib/workAreaPopupContext'
import type { OpenPopup } from '../lib/workAreaPopupContext'
import { PopupHost } from './PopupHost'

export interface WorkAreaProps {
  children: ReactNode
}

// RT-43(§2.1·§2.3·§5.1) — openPopup의 유일한 소유자([L] 로컬 상태 —
// store에는 두지 않는다, 화면 전용 UI 상태라 새로고침 시 초기화되는 게
// 맞다). PreviewSummary와 DeployFilesWorkspace의 공통 부모라서 둘 중
// 어디서 올라오는 열기 이벤트든 받을 수 있다. 앵커: 이 컴포넌트가
// position:relative를 가져 PopupHost가 그리는 팝업이 이 영역 정중앙에
// 뜬다(기존엔 .deploy-files-panel이 앵커였다 — RT-15 주석 참고).
export function WorkArea({ children }: WorkAreaProps): React.JSX.Element {
  const [openPopup, setOpenPopup] = useState<OpenPopup>(null)
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

  return (
    <div className="work-area">
      <WorkAreaPopupContext.Provider
        value={{ openPopup, open: setOpenPopup, close: () => setOpenPopup(null) }}
      >
        {children}
        <PopupHost />
      </WorkAreaPopupContext.Provider>
    </div>
  )
}
