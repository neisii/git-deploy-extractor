import type { PanelStateKind } from '../lib/panelStateMessage'
import { panelStateMessage } from '../lib/panelStateMessage'

export type { PanelStateKind }

export interface PanelStateProps {
  kind: PanelStateKind
  detail?: string
}

// 패널 본문 슬롯(PanelBody 안)에만 들어간다 — 패널 자체(Panel/PanelHeader)를
// 교체·언마운트하지 않는다(U1 — stale이어도 헤더·입력 중인 값은 유지).
export function PanelState({ kind, detail }: PanelStateProps): React.JSX.Element {
  return (
    <div className="status-text panel-state" data-panel-state={kind}>
      {panelStateMessage(kind, detail)}
    </div>
  )
}
