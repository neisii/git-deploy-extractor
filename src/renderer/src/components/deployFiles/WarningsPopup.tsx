import { Popup } from '../Popup'
import { useAppStore } from '../../store/appStore'
import { TreeList } from '../TreeList'
import type { TreeLeafInfo } from '../TreeList'
import { useTreeExpansion } from '../../lib/useTreeExpansion'
import type { AnalysisWarning } from '../../../../shared/types'

export interface WarningsPopupProps {
  onClose: () => void
}

const ALWAYS_OPEN = (): boolean => true

const renderLeaf = (warning: AnalysisWarning, info: TreeLeafInfo): React.JSX.Element => (
  <span title={`${warning.path} — ${warning.reason}`}>{info.name}</span>
)

// RT-44(U-2) — 기존 "N개 파일이 HEAD에 없어 제외되었습니다" 배너(DR-009)를
// 대체. PreviewSummary의 `⚠ HEAD에 없음: N ▸`(N>0일 때만 표시)로만 열린다.
//
// RT-53(§5.1 RT-53) — 평탄한 목록(RT-44 임시 구현)을 TreeList로 교체.
// 리프에 개별 `title`(경로 — 사유)을 얹어 TreeList의 행 전체 title(경로만)
// 보다 더 구체적인 안내가 뜨게 한다(중첩 title은 더 안쪽 요소가 우선).
export function WarningsPopup({ onClose }: WarningsPopupProps): React.JSX.Element {
  const warnings = useAppStore((s) => s.warnings)
  const expansion = useTreeExpansion(ALWAYS_OPEN)

  return (
    <Popup title={`HEAD에 없어 제외된 파일 (${warnings.length}개)`} onClose={onClose}>
      <TreeList
        items={warnings}
        getPath={(w) => w.path}
        expansion={expansion}
        renderLeaf={renderLeaf}
        emptyMessage="없음"
      />
      <p className="status-text">
        선택한 커밋에서 변경됐지만 기준 Branch의 HEAD에는 존재하지 않아 배포 대상에서 제외된
        파일입니다(DR-009).
      </p>
    </Popup>
  )
}
