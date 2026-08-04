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

  if (commitListError) {
    return (
      <div className="panel commit-list-panel commit-list-panel--error">
        커밋 조회 실패: {commitListError}
      </div>
    )
  }

  if (commits.length === 0 && pagination.loading) {
    return <div className="panel commit-list-panel">불러오는 중...</div>
  }

  if (commits.length === 0) {
    return <div className="panel commit-list-panel">커밋이 없습니다</div>
  }

  return (
    <div className="panel commit-list-panel">
      <div className="commit-list-panel__header">
        <label>
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => toggleAllCommits()}
          />
          전체 선택
        </label>
        <button disabled={selectedHashes.size === 0} onClick={() => void runPreview()}>
          Preview
        </button>
      </div>
      <div className="commit-list-panel__body">
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
      </div>
      {pagination.loading && <div className="status-text">다음 페이지 불러오는 중...</div>}
    </div>
  )
}
