import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { CommitSearchMode } from '../../../shared/types'
import { parseKeywordText } from '../services/commitQueryParams'
import { FieldHint } from './FieldHint'

export interface QueryFilterGroupProps {
  keywordText: string
  onKeywordChange: (text: string) => void
  searchMode: CommitSearchMode
  onSearchModeChange: (mode: CommitSearchMode) => void
  authorFilter: string
  onAuthorChange: (text: string) => void
  hashFilterText: string
  onHashChange: (text: string) => void
  invalidHashFilter: string[]
  onImmediateSearchShortcut: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}

const KEYWORD_HINT =
  '한 줄에 하나 · 앞에 -를 붙이면 제외 · 글자 그대로 검색(대소문자 무시, *·정규식 아님)'
const AUTHOR_HINT = '한 줄에 하나 · 이름 일부 일치(대소문자 무시) · 이름에 공백이 있어도 됨'
const HASH_HINT =
  '한 줄에 하나 · 입력하면 다른 모든 조건 무시 · 해시가 정확히 일치하는 커밋만(축약 해시 가능)'

// RT-49(§5.1 RT-49) — 조회 조건 필터 그룹(오른쪽). 키워드(RT-48) · 작성자
// · 해시 필터 텍스트 영역 세 개를 같은 줄에 나란히(키워드가 왼쪽, flex
// 1.5:1:1, 최소 폭 100px) 배치한다. 디바운스/즉시조회 취소 조율은
// BranchSearchBar가 그대로 소유하고(RT-32 — 필드마다 독립 훅이지만
// "지금 바로 조회"는 넷을 한꺼번에 취소해야 함), 이 컴포넌트는 그
// onChange/onImmediateSearchShortcut을 그대로 통과시키는 순수 레이아웃 +
// 힌트 툴팁 담당이다.
export function QueryFilterGroup({
  keywordText,
  onKeywordChange,
  searchMode,
  onSearchModeChange,
  authorFilter,
  onAuthorChange,
  hashFilterText,
  onHashChange,
  invalidHashFilter,
  onImmediateSearchShortcut
}: QueryFilterGroupProps): React.JSX.Element {
  const keywordRef = useRef<HTMLTextAreaElement>(null)
  const authorRef = useRef<HTMLTextAreaElement>(null)
  const hashRef = useRef<HTMLTextAreaElement>(null)

  const [keywordFocused, setKeywordFocused] = useState(false)
  const [authorFocused, setAuthorFocused] = useState(false)
  const [hashFocused, setHashFocused] = useState(false)

  const showKeywordHint = keywordFocused && keywordText.length > 0
  const showAuthorHint = authorFocused && authorFilter.length > 0
  const showHashHint = hashFocused && hashFilterText.length > 0

  // RT-48(§5.1) — 파일명 모드에서는 제외(`-`) 줄이 무시되므로, 지금
  // 입력에 그런 줄이 있으면 같은 힌트 툴팁 안에 경고 한 줄을 덧붙인다.
  const hasIgnoredExcludeLines =
    searchMode === 'filename' && parseKeywordText(keywordText).exclude.length > 0

  return (
    <div className="panel query-filter-group">
      <div className="query-filter-group__fields">
        {/* 헤더 안에 라디오(그 자체가 <label>)가 있어, 필드 전체를
            <label>로 감싸면 중첩 label이 되어 무효할 뿐 아니라 헤더
            클릭이 textarea 대신 첫 라디오를 토글해버린다(암묵적 label
            연결은 DOM 순서상 첫 labelable descendant를 집는다) — 이
            필드만 <div>로 감싸고 textarea는 aria-label로 대신 연결한다. */}
        <div className="query-filter-group__field query-filter-group__field--keyword">
          <div className="query-filter-group__field-header">
            <span>키워드</span>
            <span className="query-filter-group__mode-radios">
              <label>
                <input
                  type="radio"
                  name="searchMode"
                  checked={searchMode === 'message'}
                  onChange={() => onSearchModeChange('message')}
                />
                메시지
              </label>
              <label>
                <input
                  type="radio"
                  name="searchMode"
                  checked={searchMode === 'filename'}
                  onChange={() => onSearchModeChange('filename')}
                />
                파일명
              </label>
            </span>
          </div>
          <textarea
            aria-label="키워드"
            ref={keywordRef}
            rows={2}
            placeholder={'한 줄에 하나\n앞에 - 를 붙이면 제외\n예) guarantee\n-Revert'}
            value={keywordText}
            onChange={(e) => onKeywordChange(e.target.value)}
            onFocus={() => setKeywordFocused(true)}
            onBlur={() => setKeywordFocused(false)}
            onKeyDown={onImmediateSearchShortcut}
            aria-describedby={showKeywordHint ? 'query-filter-keyword-hint' : undefined}
          />
          <FieldHint
            id="query-filter-keyword-hint"
            anchorRef={keywordRef}
            visible={showKeywordHint}
          >
            <div>{KEYWORD_HINT}</div>
            {hasIgnoredExcludeLines && (
              <div>⚠ 파일명 검색에서는 제외(-) 줄을 쓸 수 없습니다 — 무시됩니다</div>
            )}
          </FieldHint>
        </div>

        <label className="query-filter-group__field">
          <div className="query-filter-group__field-header">작성자</div>
          <textarea
            ref={authorRef}
            rows={2}
            placeholder="쉼표/공백/줄바꿈 구분, 여러 명이면 하나라도 일치 시 포함"
            value={authorFilter}
            onChange={(e) => onAuthorChange(e.target.value)}
            onFocus={() => setAuthorFocused(true)}
            onBlur={() => setAuthorFocused(false)}
            onKeyDown={onImmediateSearchShortcut}
            aria-describedby={showAuthorHint ? 'query-filter-author-hint' : undefined}
          />
          <FieldHint id="query-filter-author-hint" anchorRef={authorRef} visible={showAuthorHint}>
            {AUTHOR_HINT}
          </FieldHint>
        </label>

        <label className="query-filter-group__field">
          <div className="query-filter-group__field-header">해시 필터</div>
          <textarea
            ref={hashRef}
            rows={2}
            placeholder="쉼표/공백/줄바꿈 구분, 입력 시 다른 조건 무시"
            value={hashFilterText}
            onChange={(e) => onHashChange(e.target.value)}
            onFocus={() => setHashFocused(true)}
            onBlur={() => setHashFocused(false)}
            onKeyDown={onImmediateSearchShortcut}
            aria-describedby={showHashHint ? 'query-filter-hash-hint' : undefined}
          />
          {invalidHashFilter.length > 0 && (
            <span className="status-text status-text--error" title={invalidHashFilter.join(', ')}>
              올바른 해시 형식이 아니라 무시됨: {invalidHashFilter.join(', ')}
            </span>
          )}
          <FieldHint id="query-filter-hash-hint" anchorRef={hashRef} visible={showHashHint}>
            {HASH_HINT}
          </FieldHint>
        </label>
      </div>
    </div>
  )
}
