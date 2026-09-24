import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useAppStore } from '../store/appStore'
import { useDebouncedAction } from '../lib/useDebouncedAction'
import { parseKeywordText } from '../services/commitQueryParams'
import { CollapsibleSection } from './CollapsibleSection'
import { SplitPane } from './SplitPane'
import { SearchConditionGroup } from './SearchConditionGroup'
import { QueryFilterGroup } from './QueryFilterGroup'

const SEARCH_DEBOUNCE_MS = 300

// 키워드(메시지 대상, 2026-09-23부터 파일명 모드 제거) 포함 키워드(", "로
// 연결) + 제외 개수를 하나의 요약 조각으로 합친다(예: `"guarantee, payment"
// · 제외 1`). 작성자/해시 필터와 같은 방식으로, 값이 없으면 요약에서
// 아예 빠진다(null).
function buildKeywordSummary(keywordText: string): string | null {
  const { include, exclude } = parseKeywordText(keywordText)
  if (include.length === 0 && exclude.length === 0) return null
  const parts = include.length > 0 ? [`"${include.join(', ')}"`] : []
  if (exclude.length > 0) parts.push(`제외 ${exclude.length}`)
  return parts.join(' · ')
}

export function BranchSearchBar(): React.JSX.Element {
  const branches = useAppStore((s) => s.branches)
  const selectedBranch = useAppStore((s) => s.selectedBranch)
  const setBranch = useAppStore((s) => s.setBranch)
  const keywordText = useAppStore((s) => s.keywordText)
  const setKeywordText = useAppStore((s) => s.setKeywordText)
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

  // RT-47(§5.1 RT-47), RT-48(U-8) — 접힌 요약: "<브랜치> [· "<포함 키워드>"
  // [· 제외 N]] · <시작>~<종료> · Merge 제외|포함 [· 작성자 필터]
  // [· 해시 필터]". 키워드가 비어있으면 그 조각은 통째로 빠진다(작성자/
  // 해시 필터와 같은 방식).
  const summaryParts = [
    selectedBranch ?? '—',
    buildKeywordSummary(keywordText),
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
        // 조회 조건 왼쪽(검색 조건)·오른쪽(필터) 패널 높이를 맞추기 위한
        // 조정(2026-09-23 후속, commitQueryBar.css의 날짜 입력창/필터
        // 필드 폭 축소와 함께 적용) — 50:50이면 "조회 기간" 행이 줄바꿈돼
        // 왼쪽이 더 높아진다. 상세 근거는 commitQueryBar.css 주석 참고.
        storageKey="gde:splitRatio:queryGroups"
        defaultRatio={0.58}
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
