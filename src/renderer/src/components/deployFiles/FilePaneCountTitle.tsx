export interface FilePaneCountTitleProps {
  label: string
  selectedCount: number
  total: number
  totalBeforeFilter: number
  // "누락된 의존성"에만 넘어온다(50 초과 경고, "포함된 파일"은 전달 안
  // 함 → 경고 비활성).
  overCountThreshold?: number
}

// RT-42 — DeployFilesPanel.tsx의 buildCountTitle 지역 함수를 IncludedFilesPane·
// MissingDependenciesPane 둘 다 쓸 수 있게 컴포넌트로 뺐다(제목 문구는
// REQ-020 — 선택/전체/필터 전 전체 세 숫자). 동작은 그대로다.
export function FilePaneCountTitle({
  label,
  selectedCount,
  total,
  totalBeforeFilter,
  overCountThreshold
}: FilePaneCountTitleProps): React.JSX.Element {
  const isOverThreshold = overCountThreshold !== undefined && total > overCountThreshold
  return (
    <span className="file-pane__title-text">
      {label} (선택 {selectedCount}개/
      <span
        className={isOverThreshold ? 'status-text--error' : undefined}
        title={isOverThreshold ? `${overCountThreshold}개를 초과했습니다` : undefined}
      >
        전체 {total}개
      </span>
      (필터 전 전체 {totalBeforeFilter}개))
    </span>
  )
}
