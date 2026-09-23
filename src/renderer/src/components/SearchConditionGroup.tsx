import { MaxCountField } from './MaxCountField'

export interface SearchConditionGroupProps {
  branches: string[]
  selectedBranch: string | null
  onBranchChange: (branch: string) => void
  onImmediateSearch: () => void
  startDate: string
  endDate: string
  onDateRangeChange: (startDate: string, endDate: string) => void
  maxCount: number
  onMaxCountCommit: (maxCount: number) => void
  excludeMerges: boolean
  onExcludeMergesChange: (excludeMerges: boolean) => void
}

// RT-49(§5.1 RT-49) — 조회 조건 검색 조건 그룹(왼쪽): (1) Branch · Search
// 버튼, (2) 조회 기간 · 최대 개수 · Merge 제외. 기본 폭(50%)에서 두 줄에
// 들어가고, 좁히면 줄바꿈될 수 있다(기존 branch-search-bar__row의
// flex-wrap 그대로).
export function SearchConditionGroup({
  branches,
  selectedBranch,
  onBranchChange,
  onImmediateSearch,
  startDate,
  endDate,
  onDateRangeChange,
  maxCount,
  onMaxCountCommit,
  excludeMerges,
  onExcludeMergesChange
}: SearchConditionGroupProps): React.JSX.Element {
  return (
    <div className="panel search-condition-group">
      <div className="search-condition-group__row">
        <label>
          Branch :
          <select
            value={selectedBranch ?? ''}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={branches.length === 0}
          >
            {branches.length === 0 && <option value="">—</option>}
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>
        <button onClick={onImmediateSearch}>Search</button>
      </div>

      <div className="search-condition-group__row">
        <label>
          조회 기간 :
          <input
            type="date"
            value={startDate}
            onChange={(e) => onDateRangeChange(e.target.value, endDate)}
          />
          <span> ~ </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onDateRangeChange(startDate, e.target.value)}
          />
        </label>

        <label>
          최대
          <MaxCountField value={maxCount} onCommit={onMaxCountCommit} />개
        </label>

        <label>
          <input
            type="checkbox"
            checked={excludeMerges}
            onChange={(e) => onExcludeMergesChange(e.target.checked)}
          />
          Merge 커밋 제외
        </label>
      </div>
    </div>
  )
}
