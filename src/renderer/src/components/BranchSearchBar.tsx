import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useAppStore } from '../store/appStore'
import type { CommitSearchMode } from '../../../shared/types'
import { useDebouncedAction } from '../lib/useDebouncedAction'
import { parseKeywordText } from '../services/commitQueryParams'
import { CollapsibleSection } from './CollapsibleSection'
import { SplitPane } from './SplitPane'
import { SearchConditionGroup } from './SearchConditionGroup'
import { QueryFilterGroup } from './QueryFilterGroup'

const SEARCH_DEBOUNCE_MS = 300

// RT-49(§5.1 RT-49) — 메시지/파일명 + 포함 키워드(", "로 연결) + 제외
// 개수를 하나의 요약 조각으로 합친다(RT-48 명세 예시: `메시지 "guarantee,
// payment" · 제외 1`). 둘 다 없으면 모드 라벨만(기존 searchTerm 없을 때
// searchModeLabel만 보이던 동작과 동일).
function buildKeywordSummary(mode: CommitSearchMode, keywordText: string): string {
  const label = mode === 'filename' ? '파일명' : '메시지'
  const { include, exclude } = parseKeywordText(keywordText)
  const parts = [include.length > 0 ? `${label} "${include.join(', ')}"` : label]
  if (exclude.length > 0) parts.push(`제외 ${exclude.length}`)
  return parts.join(' · ')
}

export function BranchSearchBar(): React.JSX.Element {
  const branches = useAppStore((s) => s.branches)
  const selectedBranch = useAppStore((s) => s.selectedBranch)
  const setBranch = useAppStore((s) => s.setBranch)
  const keywordText = useAppStore((s) => s.keywordText)
  const setKeywordText = useAppStore((s) => s.setKeywordText)
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

  // RT-47(§5.1 RT-47) — CommitQueryBar(이 컴포넌트)의 접힘은 "자기 로컬
  // 상태"다(WorkArea가 아니라 여기서 소유). 미영속(M-7) — 새로고침하면
  // 항상 펼침.
  const [collapsed, setCollapsed] = useState(false)

  // RT-32(S3) — 예전엔 스토어 안 모듈 전역 타이머 하나를 이 네 필드가
  // 공유했다(한 필드를 편집하면 다른 필드의 대기 중이던 디바운스까지
  // 우연히 취소됨). 이제 각 필드가 useDebouncedAction 인스턴스를 하나씩
  // 따로 가져 독립적으로 디바운스한다.
  const debouncedKeyword = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)
  const debouncedAuthorFilter = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)
  const debouncedHashFilter = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)
  const debouncedDateRange = useDebouncedAction(triggerSearch, SEARCH_DEBOUNCE_MS)

  // "지금 바로 조회"(Search 버튼, Ctrl/Cmd+Enter, 즉시 반영되는 다른
  // 필드 변경)는 대기 중인 디바운스를 전부 정리한다 — 예전에 공유
  // 타이머 하나를 clearTimeout하던 것과 같은 효과를 네 인스턴스에
  // 나눠서 낸다.
  function cancelPendingSearches(): void {
    debouncedKeyword.cancel()
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

  // RT-47(§5.1 RT-47), RT-48(U-8) — 접힌 요약: "<브랜치> · <메시지|파일명>
  // ["<포함 키워드>"] [· 제외 N] · <시작>~<종료> · Merge 제외|포함
  // [· 작성자 필터] [· 해시 필터]".
  const summaryParts = [
    selectedBranch ?? '—',
    buildKeywordSummary(searchMode, keywordText),
    `${startDate}~${endDate}`,
    excludeMerges ? 'Merge 제외' : 'Merge 포함',
    authorFilter.trim() ? '작성자 필터' : null,
    hashFilterText.trim() ? '해시 필터' : null
  ].filter((part): part is string => part != null)

  return (
    <CollapsibleSection
      sectionKey="commitQuery"
      owner="local"
      title="조회 조건"
      collapsed={collapsed}
      onToggle={() => setCollapsed((v) => !v)}
      summary={summaryParts.join(' · ')}
    >
      <SplitPane
        className="commit-query-bar__groups"
        storageKey="gde:splitRatio:queryGroups"
        defaultRatio={0.5}
        minStartPx={320}
        minEndPx={330}
        start={
          <SearchConditionGroup
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={(branch) => void setBranch(branch)}
            onImmediateSearch={handleImmediateSearch}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(nextStart, nextEnd) => {
              setDateRange(nextStart, nextEnd)
              debouncedDateRange.run()
            }}
            maxCount={maxCount}
            onMaxCountCommit={(v) => {
              cancelPendingSearches()
              void setMaxCount(v)
            }}
            excludeMerges={excludeMerges}
            onExcludeMergesChange={(v) => {
              cancelPendingSearches()
              void setExcludeMerges(v)
            }}
          />
        }
        end={
          <QueryFilterGroup
            keywordText={keywordText}
            onKeywordChange={(text) => {
              setKeywordText(text)
              debouncedKeyword.run()
            }}
            searchMode={searchMode}
            onSearchModeChange={(mode) => {
              cancelPendingSearches()
              void setSearchMode(mode)
            }}
            authorFilter={authorFilter}
            onAuthorChange={(text) => {
              setAuthorFilter(text)
              debouncedAuthorFilter.run()
            }}
            hashFilterText={hashFilterText}
            onHashChange={(text) => {
              setHashFilterText(text)
              debouncedHashFilter.run()
            }}
            invalidHashFilter={invalidHashFilter}
            onImmediateSearchShortcut={handleImmediateSearchShortcut}
          />
        }
      />
    </CollapsibleSection>
  )
}
