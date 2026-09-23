import { useMemo } from 'react'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import type { CommitEntry } from '../../../shared/types'
import { useAppStore } from '../store/appStore'
import { TriStateCheckbox } from './TriStateCheckbox'

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
  const analyzing = useAppStore((s) => s.analyzing)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)

  const allChecked = commits.length > 0 && commits.every((c) => selectedHashes.has(c.hash))
  const someChecked = commits.some((c) => selectedHashes.has(c.hash))
  const indeterminate = someChecked && !allChecked

  // RT-48(U-8) 수용 기준 — REQ-015로 선택은 검색 조건과 무관하게
  // 유지되므로, 키워드/작성자/해시 등을 바꿔 다시 찾으면 선택된 커밋
  // 일부가 지금 로드된 목록엔 없을 수 있다(git 쪽 필터가 걸러낸 개수는
  // 알 수 없으므로 "숨김 M개"까지는 표시하지 않는다, §5.1). 아직 스크롤로
  // 안 불러온 다음 페이지에 있을 뿐인 선택도 여기선 "안 보임"으로 잡힌다
  // — 로드된 commits 기준의 근사치다.
  const loadedHashes = useMemo(() => new Set(commits.map((c) => c.hash)), [commits])
  const hiddenSelectedCount = Array.from(selectedHashes).filter((h) => !loadedHashes.has(h)).length

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
            {/* RT-40(S5) — CommitListPanel·FileListColumn이 각자 들고
                있던 checked+indeterminate ref/effect 코드를 공용
                primitive로 합쳤다(TriStateCheckbox). */}
            <TriStateCheckbox
              checked={allChecked}
              indeterminate={indeterminate}
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
            {hiddenSelectedCount > 0 && ` (선택 중 ${hiddenSelectedCount}개는 화면에 안 보임)`}
          </span>
        </div>
        <button
          disabled={selectedHashes.size === 0 || analyzing || dependencyAnalyzing}
          title={
            analyzing || dependencyAnalyzing
              ? '분석 중입니다 — 완료 후 다시 실행할 수 있습니다'
              : undefined
          }
          onClick={() => void runPreview()}
        >
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
