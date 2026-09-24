import { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { useWorkAreaPopup } from '../../lib/workAreaPopupContext'

export interface FilterPatternBarProps {
  // RT-46 — 상태 Filter까지만 반영한 "포함된 파일" 중 패턴에 걸려 숨겨진
  // 개수. useIncludedFilesView가 이미 계산해서 갖고 있어(IncludedFilesPane)
  // 여기서 다시 계산하지 않고 그대로 받는다.
  hiddenCount: number
}

// M-51(2026-09-24) — 패턴 추가 입력(모드 선택·텍스트 입력·해석
// 오버레이)을 FilterPatternsPopup으로 옮겼다(§7 M-51). 이 컴포넌트는
// 이제 요약("포함 K개/제외 M개"·"N개 숨김")과 팝업을 여는 트리거 버튼
// 하나만 남은 얇은 툴바다 — "설정" 버튼이 이제 유일한 추가 경로이기도
// 해서(팝업 안에서 추가) filePatterns가 비어 있어도 항상 눌러야 한다
// (예전처럼 "등록된 패턴이 없으면 비활성화"하지 않는다). M-55(2026-09-24)
// — 요약 표기를 "활성 N개"(포함/제외 합산)에서 "포함 N개/제외 N개"로
// 나눴다(합산 개수만으론 어느 쪽이 몇 개인지 알 수 없다는 지적).
export function FilterPatternBar({ hiddenCount }: FilterPatternBarProps): React.JSX.Element {
  const filePatterns = useAppStore((s) => s.filePatterns)
  const { open } = useWorkAreaPopup()

  const activePatterns = useMemo(() => filePatterns.filter((p) => p.enabled), [filePatterns])
  const activeIncludeCount = useMemo(
    () => activePatterns.filter((p) => p.mode === 'include').length,
    [activePatterns]
  )
  const activeExcludeCount = useMemo(
    () => activePatterns.filter((p) => p.mode === 'exclude').length,
    [activePatterns]
  )

  const tooltipLines =
    activePatterns.length === 0
      ? '활성 패턴 없음'
      : [`활성 패턴 ${activePatterns.length}개`]
          .concat(activePatterns.map((p) => `${p.mode === 'exclude' ? '−' : '+'} ${p.pattern}`))
          .join('\n')

  return (
    <div className="filter-pattern-bar">
      <div className="filter-pattern-bar__summary">
        <span>패턴:</span>
        <span className="filter-pattern-bar__badge" title={tooltipLines}>
          포함 {activeIncludeCount}개/제외 {activeExcludeCount}개
        </span>
        <button type="button" onClick={() => open('patterns')}>
          설정
        </button>
        {hiddenCount > 0 && <span className="status-text">· {hiddenCount}개 숨김</span>}
      </div>
    </div>
  )
}
