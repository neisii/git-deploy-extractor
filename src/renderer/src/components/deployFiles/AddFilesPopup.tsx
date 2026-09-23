import { useCallback, useMemo, useState } from 'react'
import { Popup } from '../Popup'
import { useAppStore } from '../../store/appStore'
import { includedPathsSet } from '../../lib/includedPathsSet'
import {
  buildBrowseCandidates,
  buildSearchCandidates,
  visibleDependencyPaths,
  missingDependencyAncestorPaths
} from '../../lib/addFilesCandidates'
import type { AddFilesCandidate } from '../../lib/addFilesCandidates'
import { useTreeExpansion } from '../../lib/useTreeExpansion'
import { TreeList } from '../TreeList'
import type { TreeLeafInfo } from '../TreeList'
import type { JavaDependencyKind } from '../../../../shared/types'

const RESULT_LIMIT = 50
// RT-53(§5.1 RT-52) — 탐색 트리는 1~2단계(src/main류)를 병합하지 않는다
// (compactFromDepth 3). 결과 트리는 나머지 목록과 동일한 기본값(1).
const BROWSE_COMPACT_FROM_DEPTH = 3
const SEARCH_COMPACT_FROM_DEPTH = 1
// 탐색 트리 기본 펼침: 경로 세그먼트 1단계(§5.1 "1단계 펼침 → 2단계까지 보임").
const BROWSE_DEFAULT_EXPAND_DEPTH = 1
const ALWAYS_OPEN = (): boolean => true

const KIND_LABEL: Record<JavaDependencyKind, string> = { class: 'Impl', interface: 'I' }
const KIND_TITLE: Record<JavaDependencyKind, string> = { class: '구현체', interface: '인터페이스' }

export interface AddFilesPopupProps {
  onClose: () => void
}

// RT-52(§5.1 RT-52, U-12·U-19·U-20)/RT-53(§5.1 RT-53) — ManualAddPopup을
// 대체한다. RT-52에서는 평탄한 목록으로 임시 구현했다가(2026-09-23
// AskUserQuestion), RT-53(TreeList)이 들어오면서 원래 명세대로 진짜 HEAD
// 트리 탐색으로 바뀌었다. 검색어가 없으면 "탐색 모드"(HEAD 트리 전체,
// 누락된 의존성의 모든 조상 폴더는 기본 펼침 ∪ 1단계), 검색어가 있으면
// "결과 모드"(매칭 50개, 전부 펼침) — 펼침 상태를 완전히 분리하기 위해
// useTreeExpansion을 두 번 호출한다(§5.1 "탐색/결과는 펼침 id를 분리").
export function AddFilesPopup({ onClose }: AddFilesPopupProps): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const headTreeFiles = useAppStore((s) => s.headTreeFiles)
  const manuallyAddedPaths = useAppStore((s) => s.manuallyAddedPaths)
  const missingDependencies = useAppStore((s) => s.missingDependencies)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const dependencyApplicable = useAppStore((s) => s.dependencyApplicable)
  const dependencyReason = useAppStore((s) => s.dependencyReason)
  const dependencyParseWarnings = useAppStore((s) => s.dependencyParseWarnings)
  const addManualFile = useAppStore((s) => s.addManualFile)
  const removeManualFile = useAppStore((s) => s.removeManualFile)
  const addDependencyToExtract = useAppStore((s) => s.addDependencyToExtract)
  const addAllVisibleDependencies = useAppStore((s) => s.addAllVisibleDependencies)

  const [query, setQuery] = useState('')

  // REQ-021/DR-019 + RT-17(M-36a) — 이미 deployFiles에 있는(출처 무관)
  // 경로는 후보에서 미리 제외한다(숨김, 비활성 표시 아님).
  const includedSet = useMemo(() => includedPathsSet(deployFiles), [deployFiles])

  const ancestorPaths = useMemo(
    () => missingDependencyAncestorPaths(missingDependencies, includedSet),
    [missingDependencies, includedSet]
  )
  const browseDefaultOpen = useCallback(
    (path: string) =>
      path.split('/').length <= BROWSE_DEFAULT_EXPAND_DEPTH || ancestorPaths.has(path),
    [ancestorPaths]
  )
  const browseExpansion = useTreeExpansion(browseDefaultOpen)
  const searchExpansion = useTreeExpansion(ALWAYS_OPEN)

  const browseCandidates = useMemo(
    () => buildBrowseCandidates(headTreeFiles, missingDependencies, includedSet),
    [headTreeFiles, missingDependencies, includedSet]
  )
  const searchResult = useMemo(
    () =>
      buildSearchCandidates(headTreeFiles, missingDependencies, includedSet, query, RESULT_LIMIT),
    [headTreeFiles, missingDependencies, includedSet, query]
  )

  const isSearching = query.trim().length > 0
  const activeCandidates = isSearching ? searchResult.candidates : browseCandidates
  const visibleDependencies = useMemo(
    () => visibleDependencyPaths(activeCandidates),
    [activeCandidates]
  )

  // RT-52 — 분석 상태 안내 한 줄(파싱 실패 · 확인 중 · 적용 불가). 트리는
  // 계속 사용 가능하고, 적용 불가/확인 중일 때는 붉은 표시(kind)만 없다
  // (missingDependencies가 비어 있어 자연히 그렇게 된다).
  let statusLine: string | null = null
  if (dependencyParseWarnings.length > 0) {
    statusLine = `⚠ ${dependencyParseWarnings.length}개 파일을 파싱하지 못해 의존성 검사에서 제외했습니다`
  } else if (dependencyAnalyzing) {
    statusLine = '의존성 확인 중...'
  } else if (!dependencyApplicable && dependencyReason) {
    statusLine = `이 저장소에는 적용할 수 없습니다 (${dependencyReason})`
  }

  const renderLeaf = (candidate: AddFilesCandidate, info: TreeLeafInfo): React.JSX.Element => (
    <span className={candidate.kind ? 'add-files-row add-files-row--missing' : 'add-files-row'}>
      <span className="add-files-row__name">
        {info.name}
        {candidate.kind && (
          <span className="kind-badge" title={KIND_TITLE[candidate.kind]}>
            {KIND_LABEL[candidate.kind]}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() =>
          candidate.kind
            ? addDependencyToExtract(candidate.localPath)
            : void addManualFile(candidate.localPath)
        }
      >
        추가
      </button>
    </span>
  )

  // RT-52 — Preview 결과가 없거나 headTreeFiles를 못 받은 경우 트리
  // 자리에 안내만 표시한다(트리 자체를 그릴 데이터가 없으므로).
  const treeBody =
    headTreeFiles.length === 0 ? (
      <div className="status-text">Preview 후 사용할 수 있습니다</div>
    ) : isSearching ? (
      <>
        <TreeList
          items={searchResult.candidates}
          getPath={(c) => c.localPath}
          expansion={searchExpansion}
          compactFromDepth={SEARCH_COMPACT_FROM_DEPTH}
          renderLeaf={renderLeaf}
          emptyMessage="일치하는 파일이 없습니다"
        />
        {searchResult.truncated && (
          <p className="status-text">상위 50개만 표시합니다 — 검색어를 더 구체적으로 입력하세요</p>
        )}
      </>
    ) : (
      <TreeList
        items={browseCandidates}
        getPath={(c) => c.localPath}
        expansion={browseExpansion}
        compactFromDepth={BROWSE_COMPACT_FROM_DEPTH}
        renderLeaf={renderLeaf}
        emptyMessage="추가할 수 있는 파일이 없습니다"
      />
    )

  return (
    <Popup title="파일 추가" onClose={onClose}>
      {statusLine && <div className="warning-banner">{statusLine}</div>}
      <div className="add-files-popup__toolbar">
        <input
          type="text"
          autoFocus
          value={query}
          placeholder="파일명 입력... (* 와일드카드 가능, 비우면 HEAD 트리 전체)"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          disabled={visibleDependencies.length === 0}
          onClick={() => addAllVisibleDependencies(visibleDependencies)}
          title="화면에 보이는 누락된 의존성을 모두 Extract 대상에 추가"
        >
          보이는 항목 모두 추가 ({visibleDependencies.length})
        </button>
      </div>
      <div className="add-files-popup__tree fill-scroll">{treeBody}</div>
      {manuallyAddedPaths.length > 0 && (
        <div className="manual-add-popup__chips">
          {manuallyAddedPaths.map((path) => (
            <button
              key={path}
              type="button"
              className="manual-add-popup__chip"
              onClick={() => removeManualFile(path)}
              title="클릭하면 배포 대상에서 뺍니다"
            >
              {path} ×
            </button>
          ))}
        </div>
      )}
    </Popup>
  )
}
