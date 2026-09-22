import type { KeyboardEvent } from 'react'
import { useAppStore } from '../store/appStore'
import type { CommitSearchMode } from '../../../shared/types'
import { useDebouncedAction } from '../lib/useDebouncedAction'
import { MaxCountField } from './MaxCountField'

const SEARCH_DEBOUNCE_MS = 300

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
  const invalidHashFilter = useAppStore((s) => s.invalidHashFilter)

  // RT-32(S3) — 예전엔 스토어 안 모듈 전역 타이머 하나를 이 네 필드가
  // 공유했다(한 필드를 편집하면 다른 필드의 대기 중이던 디바운스까지
  // 우연히 취소됨). 이제 각 필드가 useDebouncedAction 인스턴스를 하나씩
  // 따로 가져 독립적으로 디바운스한다.
  const debouncedSearchTerm = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)
  const debouncedAuthorFilter = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)
  const debouncedHashFilter = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)
  const debouncedDateRange = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)

  // "지금 바로 조회"(Search 버튼, Ctrl/Cmd+Enter, 즉시 반영되는 다른
  // 필드 변경)는 대기 중인 디바운스를 전부 정리한다 — 예전에 공유
  // 타이머 하나를 clearTimeout하던 것과 같은 효과를 네 인스턴스에
  // 나눠서 낸다.
  function cancelPendingSearches(): void {
    debouncedSearchTerm.cancel()
    debouncedAuthorFilter.cancel()
    debouncedHashFilter.cancel()
    debouncedDateRange.cancel()
  }

  function handleImmediateSearch(): void {
    cancelPendingSearches()
    void triggerSearch()
  }

  // RT-14(U4) — textarea에서는 Enter가 줄바꿈이라 검색 트리거로 못 쓴다.
  // Ctrl/Cmd+Enter는 디바운스(300ms)를 기다리지 않고 즉시 조회한다(그 외
  // 입력은 기존 300ms 디바운스 자동 조회 그대로 유지).
  function handleImmediateSearchShortcut(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleImmediateSearch()
    }
  }

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
              onChange={() => {
                cancelPendingSearches()
                void setSearchMode('message' satisfies CommitSearchMode)
              }}
            />
            메시지
          </label>
          <label>
            <input
              type="radio"
              name="searchMode"
              checked={searchMode === 'filename'}
              onChange={() => {
                cancelPendingSearches()
                void setSearchMode('filename' satisfies CommitSearchMode)
              }}
            />
            파일명
          </label>
        </span>

        <label>
          Search :
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              debouncedSearchTerm.run()
            }}
          />
        </label>
        <button onClick={handleImmediateSearch}>Search</button>
      </div>

      <div className="branch-search-bar__row">
        <label>
          조회 기간 :
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setDateRange(e.target.value, endDate)
              debouncedDateRange.run()
            }}
          />
          <span> ~ </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setDateRange(startDate, e.target.value)
              debouncedDateRange.run()
            }}
          />
        </label>

        <label>
          최대
          <MaxCountField
            value={maxCount}
            onCommit={(v) => {
              cancelPendingSearches()
              void setMaxCount(v)
            }}
          />
          개
        </label>

        <label>
          <input
            type="checkbox"
            checked={excludeMerges}
            onChange={(e) => {
              cancelPendingSearches()
              void setExcludeMerges(e.target.checked)
            }}
          />
          Merge 커밋 제외
        </label>
      </div>

      <div className="branch-search-bar__row branch-search-bar__row--split">
        <label className="branch-search-bar__multiline-field">
          작성자 :
          <textarea
            rows={2}
            placeholder="쉼표/공백/줄바꿈 구분, 여러 명이면 하나라도 일치 시 포함"
            title="Ctrl/Cmd+Enter로 즉시 조회"
            value={authorFilter}
            onChange={(e) => {
              setAuthorFilter(e.target.value)
              debouncedAuthorFilter.run()
            }}
            onKeyDown={handleImmediateSearchShortcut}
          />
        </label>

        <label className="branch-search-bar__multiline-field">
          해시 필터 :
          <textarea
            rows={2}
            placeholder="쉼표/공백/줄바꿈 구분, 입력 시 다른 조건 무시"
            title="Ctrl/Cmd+Enter로 즉시 조회"
            value={hashFilterText}
            onChange={(e) => {
              setHashFilterText(e.target.value)
              debouncedHashFilter.run()
            }}
            onKeyDown={handleImmediateSearchShortcut}
          />
          {invalidHashFilter.length > 0 && (
            <span className="status-text status-text--error" title={invalidHashFilter.join(', ')}>
              올바른 해시 형식이 아니라 무시됨: {invalidHashFilter.join(', ')}
            </span>
          )}
        </label>
      </div>
    </section>
  )
}
