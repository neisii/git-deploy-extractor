import { useEffect, useRef } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import type { CommitEntry } from '../../../shared/types'
import { useAppStore } from '../store/appStore'

interface CommitRowProps {
  commits: CommitEntry[]
  selectedHashes: Set<string>
  onToggle: (hash: string) => void
}

function CommitRow({
  index,
  style,
  commits,
  selectedHashes,
  onToggle
}: RowComponentProps<CommitRowProps>): React.JSX.Element {
  const commit = commits[index]
  const checked = selectedHashes.has(commit.hash)
  return (
    <div style={style} className="commit-row">
      <label>
        <input type="checkbox" checked={checked} onChange={() => onToggle(commit.hash)} />
        <span className="commit-row__hash">{commit.hash.slice(0, 7)}</span>
        <span className="commit-row__author">{commit.author}</span>
        <span className="commit-row__date">{commit.date}</span>
        <span className="commit-row__message">{commit.message}</span>
      </label>
    </div>
  )
}

export function CommitListPanel(): React.JSX.Element {
  const commits = useAppStore((s) => s.commits)
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const toggleCommit = useAppStore((s) => s.toggleCommit)
  const toggleAllCommits = useAppStore((s) => s.toggleAllCommits)
  const pagination = useAppStore((s) => s.commitPagination)
  const loadNextPage = useAppStore((s) => s.loadNextPage)
  const commitListError = useAppStore((s) => s.commitListError)
  const runPreview = useAppStore((s) => s.runPreview)

  const allChecked = commits.length > 0 && commits.every((c) => selectedHashes.has(c.hash))
  const someChecked = commits.some((c) => selectedHashes.has(c.hash))
  const indeterminate = someChecked && !allChecked

  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  // RISK_ISSUES.md §6.1 케이스 D — 헤더(전체 선택 체크박스 + 선택 개수
  // 카운터)는 목록이 비어있거나(검색 결과 0건) 로딩/에러 상태여도 항상
  // 렌더링돼야 한다. 예전에는 이 상태들에서 패널 전체를 다른 텍스트로
  // 대체했는데, 그러면 검색 결과가 0건일 때 카운터까지 같이 사라져서
  // "화면에 체크 표시가 하나도 안 보이는" 문제가 오히려 더 심해진다
  // (본문뿐 아니라 카운터도 안 보임). 그래서 body만 상태별로 갈아끼운다.
  let body: React.JSX.Element
  if (commitListError) {
    body = <div className="status-text status-text--error">커밋 조회 실패: {commitListError}</div>
  } else if (commits.length === 0 && pagination.loading) {
    body = <div className="status-text">불러오는 중...</div>
  } else if (commits.length === 0) {
    body = <div className="status-text">커밋이 없습니다</div>
  } else {
    body = (
      <List
        rowComponent={CommitRow}
        rowCount={commits.length}
        rowHeight={32}
        rowProps={{ commits, selectedHashes, onToggle: toggleCommit }}
        onRowsRendered={({ stopIndex }) => {
          if (stopIndex >= commits.length - 5) {
            void loadNextPage()
          }
        }}
        style={{ height: '100%', width: '100%' }}
      />
    )
  }

  return (
    <div className="panel commit-list-panel">
      <div className="commit-list-panel__header">
        <div className="commit-list-panel__header-left">
          <label>
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={allChecked}
              disabled={commits.length === 0}
              onChange={() => toggleAllCommits()}
            />
            전체 선택
          </label>
          {/* RISK_ISSUES.md §6.1 케이스 D — REQ-015로 선택이 검색 조건과
              무관하게 유지되면서, 지금 화면엔 체크 표시가 하나도 안 보여도
              실제로는 선택이 남아있을 수 있다(다른 검색에서 체크한 커밋).
              전체 선택 여부와 무관하게 항상 실제 총 개수를 보여준다. */}
          <span className="status-text commit-list-panel__selected-count">
            {selectedHashes.size}개 선택됨
          </span>
        </div>
        <button disabled={selectedHashes.size === 0} onClick={() => void runPreview()}>
          Preview
        </button>
      </div>
      <div className="commit-list-panel__body">{body}</div>
      {pagination.loading && commits.length > 0 && (
        <div className="status-text">다음 페이지 불러오는 중...</div>
      )}
    </div>
  )
}
