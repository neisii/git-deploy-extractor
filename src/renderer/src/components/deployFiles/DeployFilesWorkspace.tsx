import { SplitPane } from '../SplitPane'
import { IncludedFilesPane } from './IncludedFilesPane'
import { ExtractTargetsPane } from './ExtractTargetsPane'

const SPLIT_MIN_PX = 260

export interface DeployFilesWorkspaceProps {
  onOpenManualAdd: () => void
}

// RT-42(§5.1 RT-41/42) — 조립만 담당한다(제목 없음). RT-51 — 우측을
// MissingDependenciesPane에서 ExtractTargetsPane으로 교체했다(§3.2
// "SplitPane은 기존 2분할 그대로" — 폭·비율·storageKey 전부 무변경). 좌
// IncludedFilesPane | 우 ExtractTargetsPane, SplitPane 2분할(기본 50:50,
// 최소 폭 각 260px, 드래그 리사이즈, 비율 localStorage 영속).
// onOpenManualAdd 하나만 그대로 통과시킨다 — 실제 팝업은 WorkArea가
// 소유한 PopupHost가 렌더링한다(RT-43, 이 워크스페이스도 그 부모인
// DeployFilesPanel도 팝업 자체를 그리지 않는다).
export function DeployFilesWorkspace({
  onOpenManualAdd
}: DeployFilesWorkspaceProps): React.JSX.Element {
  return (
    <SplitPane
      className="deploy-files-panel__split"
      storageKey="gde:splitRatio:deployFiles"
      defaultRatio={0.5}
      minStartPx={SPLIT_MIN_PX}
      minEndPx={SPLIT_MIN_PX}
      start={<IncludedFilesPane onOpenManualAdd={onOpenManualAdd} />}
      end={<ExtractTargetsPane />}
    />
  )
}
