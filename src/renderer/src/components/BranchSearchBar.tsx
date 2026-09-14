import { useAppStore } from '../store/appStore'
import type { CommitSearchMode } from '../../../shared/types'

export function BranchSearchBar(): React.JSX.Element {
  const branches = useAppStore((s) => s.branches)
  const selectedBranch = useAppStore((s) => s.selectedBranch)
  const setBranch = useAppStore((s) => s.setBranch)
  const searchTerm = useAppStore((s) => s.searchTerm)
  const setSearchTerm = useAppStore((s) => s.setSearchTerm)
  const searchMode = useAppStore((s) => s.searchMode)
  const setSearchMode = useAppStore((s) => s.setSearchMode)
  const triggerSearch = useAppStore((s) => s.triggerSearch)
  const startDate = useAppStore((s) => s.startDate)
  const endDate = useAppStore((s) => s.endDate)
  const setDateRange = useAppStore((s) => s.setDateRange)
  const maxCount = useAppStore((s) => s.maxCount)
  const setMaxCount = useAppStore((s) => s.setMaxCount)
  const authorFilter = useAppStore((s) => s.authorFilter)
  const setAuthorFilter = useAppStore((s) => s.setAuthorFilter)
  const excludeMerges = useAppStore((s) => s.excludeMerges)
  const setExcludeMerges = useAppStore((s) => s.setExcludeMerges)
  const hashFilterText = useAppStore((s) => s.hashFilterText)
  const setHashFilterText = useAppStore((s) => s.setHashFilterText)

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

        <span className="branch-search-bar__search-mode">
          검색 대상 :
          <label>
            <input
              type="radio"
              name="searchMode"
              checked={searchMode === 'message'}
              onChange={() => void setSearchMode('message' satisfies CommitSearchMode)}
            />
            메시지
          </label>
          <label>
            <input
              type="radio"
              name="searchMode"
              checked={searchMode === 'filename'}
              onChange={() => void setSearchMode('filename' satisfies CommitSearchMode)}
            />
            파일명
          </label>
        </span>

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

        <label>
          <input
            type="checkbox"
            checked={excludeMerges}
            onChange={(e) => void setExcludeMerges(e.target.checked)}
          />
          Merge 커밋 제외
        </label>
      </div>

      <div className="branch-search-bar__row branch-search-bar__row--split">
        <label className="branch-search-bar__multiline-field">
          작성자 (쉼표/공백/줄바꿈 구분, 여러 명이면 하나라도 일치 시 포함) :
          <textarea
            rows={2}
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
          />
        </label>

        <label className="branch-search-bar__multiline-field">
          해시 필터 (쉼표/공백/줄바꿈 구분, 입력 시 다른 조건 무시) :
          <textarea
            rows={2}
            value={hashFilterText}
            onChange={(e) => setHashFilterText(e.target.value)}
          />
        </label>
      </div>
    </section>
  )
}
