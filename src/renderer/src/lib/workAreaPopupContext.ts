import { createContext, useContext } from 'react'

// RT-43(§2.3·§5.1) — openPopup은 WorkArea에만 존재한다(PreviewSummary와
// DeployFilesWorkspace의 공통 부모여야 두 가지에서 열 수 있다). 팝업은
// 종류와 무관하게 동시에 하나(단일 값으로 구조적 보장). 컨텍스트로 내려
// 트리거 컴포넌트가 prop 없이도(가장 가까운 조상까지 이벤트를 직접
// 올리는 대신) "이벤트를 WorkArea로 올려 보낸다".
export type OpenPopup = 'manual' | 'patterns' | 'deleted' | 'warnings' | null

export interface WorkAreaPopupApi {
  openPopup: OpenPopup
  open: (popup: Exclude<OpenPopup, null>) => void
  close: () => void
}

export const WorkAreaPopupContext = createContext<WorkAreaPopupApi | null>(null)

export function useWorkAreaPopup(): WorkAreaPopupApi {
  const ctx = useContext(WorkAreaPopupContext)
  if (!ctx) throw new Error('useWorkAreaPopup은 WorkArea 안에서만 쓸 수 있습니다')
  return ctx
}
