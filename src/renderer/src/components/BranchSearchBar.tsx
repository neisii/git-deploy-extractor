import { useAppStore } from '../store/appStore'

export function BranchSearchBar(): React.JSX.Element {
  const branches = useAppStore((s) => s.branches)
  const selectedBranch = useAppStore((s) => s.selectedBranch)
  const setBranch = useAppStore((s) => s.setBranch)
  const searchTerm = useAppStore((s) => s.searchTerm)
  const setSearchTerm = useAppStore((s) => s.setSearchTerm)
  const triggerSearch = useAppStore((s) => s.triggerSearch)
  const startDate = useAppStore((s) => s.startDate)
  const endDate = useAppStore((s) => s.endDate)
  const setDateRange = useAppStore((s) => s.setDateRange)
  const maxCount = useAppStore((s) => s.maxCount)
  const setMaxCount = useAppStore((s) => s.setMaxCount)

  return (
    <section className="panel branch-search-bar">
      <div className="branch-search-bar__row">
        <label>
          Branch :
          <select
            value={selectedBranch ?? ''}
            onChange={(e) => void setBranch(e.target.value)}
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

        <label>
          Search :
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </label>
        <button onClick={() => void triggerSearch()}>Search</button>
      </div>

      <div className="branch-search-bar__row">
        <label>
          조회 기간 :
          <input
            type="date"
            value={startDate}
            onChange={(e) => void setDateRange(e.target.value, endDate)}
          />
          <span> ~ </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => void setDateRange(startDate, e.target.value)}
          />
        </label>

        <label>
          최대
          <input
            type="number"
            min={1}
            value={maxCount}
            onChange={(e) => void setMaxCount(Number(e.target.value) || 1)}
          />
          개
        </label>
      </div>
    </section>
  )
}
