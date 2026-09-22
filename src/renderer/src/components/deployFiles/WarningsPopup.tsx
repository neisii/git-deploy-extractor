import { Popup } from '../Popup'
import { useAppStore } from '../../store/appStore'

export interface WarningsPopupProps {
  onClose: () => void
}

// RT-44(U-2) — 기존 "N개 파일이 HEAD에 없어 제외되었습니다" 배너(DR-009)를
// 대체. PreviewSummary의 `⚠ HEAD에 없음: N ▸`(N>0일 때만 표시)로만 열린다.
//
// 본문은 평탄한 목록으로 우선 구현한다(2026-09-22 사용자 결정, DeletedFilesPopup과
// 동일한 이유 — TreeList는 RT-53 미착수).
export function WarningsPopup({ onClose }: WarningsPopupProps): React.JSX.Element {
  const warnings = useAppStore((s) => s.warnings)

  return (
    <Popup title={`HEAD에 없어 제외된 파일 (${warnings.length}개)`} onClose={onClose}>
      {warnings.length === 0 ? (
        <div className="status-text">없음</div>
      ) : (
        <ul className="popup-plain-list">
          {warnings.map((w) => (
            <li key={w.path} title={`${w.path} — ${w.reason}`}>
              {w.path}
            </li>
          ))}
        </ul>
      )}
      <p className="status-text">
        선택한 커밋에서 변경됐지만 기준 Branch의 HEAD에는 존재하지 않아 배포 대상에서 제외된
        파일입니다(DR-009).
      </p>
    </Popup>
  )
}
