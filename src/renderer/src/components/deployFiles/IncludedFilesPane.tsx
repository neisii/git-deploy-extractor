import { useAppStore, selectIsAnalysisStale } from '../../store/appStore'
import { FilePane } from '../FilePane'
import { FilePaneCountTitle } from './FilePaneCountTitle'
import { PanelState } from '../PanelState'
import { FilterPatternBar } from './FilterPatternBar'
import { TreeList } from '../TreeList'
import type { TreeFolderInfo, TreeLeafInfo } from '../TreeList'
import { TriStateCheckbox } from '../TriStateCheckbox'
import { useIncludedFilesView } from '../../lib/useIncludedFilesView'
import type { IncludedFileItem } from '../../lib/useIncludedFilesView'
import { visibleMissingDependencies } from '../../lib/visibleMissingDependencies'
import { useTreeExpansion } from '../../lib/useTreeExpansion'

const MISSING_OVER_COUNT_THRESHOLD = 50
const ALWAYS_OPEN = (): boolean => true

export interface IncludedFilesPaneProps {
  // 실제 팝업은 WorkArea가 소유한 PopupHost가 렌더링한다(RT-43) — 이
  // 컴포넌트는 트리거만 갖고 "열어달라"고 부모(DeployFilesPanel)에게
  // 알린다(기존 FileListColumn의 onOpenManualAdd와 같은 이유).
  onOpenManualAdd: () => void
}

// RT-42 — DeployFilesPanel.tsx에 인라인으로 있던 좌측("포함된 파일") 조립을
// 뺐다. CommitListPanel 등 다른 *Panel과 같은 방식으로 스토어를 직접
// 구독하는 독립 컴포넌트다 — "좌측 전용 prop 없음"은 FilePane(순수 슬롯
// primitive) 얘기고, 이 컴포넌트 자체는 이름 그대로 좌측 전용이라 store
// 접근을 가져도 된다.
//
// RT-45(U-3·U-5) — 상태 Filter(all/added/modified) UI와 파일명 검색
// (REQ-025)을 삭제했다. `+ 파일 추가`를 toolbar 줄에서 제목 줄 우측으로
// 옮겼다.
//
// B안(2026-09-24, §7 M-46) — RT-45가 지운 파일명 검색을 다시 들였다.
// 이번엔 패턴과 완전히 분리된 순수 화면 필터라 "화면만" 같은 예외
// 플래그가 필요 없다(패턴은 다시 "항상 Export에 영향을 주는 영구
// 규칙"이라는 단일한 의미로 돌아간다). 매칭은 AddFilesPopup이 쓰던
// lib/matchesFileName.ts를 그대로 재사용(`*` 와일드카드, 대소문자 무시).
//
// RT-46 — 제외 패턴 입력·칩 UI를 FilterPatternBar로 뺐다(모드 선택
// (제외/포함)·쉼표 다중 입력·해석 오버레이·"활성 K개" 요약이 새로 생겨
// 이 파일에 인라인으로 두기엔 너무 커졌다).
//
// RT-53(§5.1 RT-53, M-20) — `FileList` 대신 `TreeList`. 폴더 체크박스 =
// 화면에 보이는(패턴 반영된) 하위 변경 파일 전체를 Extract로 이동
// (toggleAllDeployFiles 재사용 — 이 목록엔 항상 !included만 보이므로
// 자연히 단방향으로 동작). indeterminate(M-20 결정 — 필요)는 "이 폴더
// 아래 원래 변경 파일 개수(changedFiles, 패턴·이동 여부 무관)가 화면에
// 보이는 개수(TreeList가 세어주는 fileCount)보다 많다"로 판정한다 —
// 그 차이가 바로 "이미 Extract로 이동했거나 패턴에 걸려 안 보이는" 몫.
export function IncludedFilesPane({ onOpenManualAdd }: IncludedFilesPaneProps): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filePatterns = useAppStore((s) => s.filePatterns)
  const missingDependencies = useAppStore((s) => s.missingDependencies)
  const headTreeFiles = useAppStore((s) => s.headTreeFiles)
  const toggleIncluded = useAppStore((s) => s.toggleDeployFileIncluded)
  const toggleAll = useAppStore((s) => s.toggleAllDeployFiles)
  const isStale = useAppStore(selectIsAnalysisStale)
  const searchTerm = useAppStore((s) => s.includedSearchTerm)
  const setSearchTerm = useAppStore((s) => s.setIncludedSearchTerm)
  const expansion = useTreeExpansion(ALWAYS_OPEN)

  const { items, selectedCount, patternHiddenCount, includedSet, totalBeforeFilter, changedFiles } =
    useIncludedFilesView(deployFiles, filePatterns, searchTerm)

  // RT-52(§5.1 RT-52) — "+ 파일 추가" 버튼 배지 `누락 N`(분석 완료 +
  // N>0일 때만, 50 초과면 붉은색 — REQ-020 이월). AddFilesPopup이 아직
  // 안 보여줘도(팝업이 닫혀 있어도) 발견성을 위해 여기서 항상 계산한다.
  // includedSet은 useIncludedFilesView가 이미 lib/includedPathsSet.ts로
  // 구해둔 값이라 여기서 다시 계산하지 않는다.
  const missingCount = visibleMissingDependencies(missingDependencies, includedSet).length
  const missingOverThreshold = missingCount > MISSING_OVER_COUNT_THRESHOLD

  const title = (
    <>
      <FilePaneCountTitle
        label="포함된 파일"
        selectedCount={selectedCount}
        total={items.length}
        totalBeforeFilter={totalBeforeFilter}
      />
      <button
        type="button"
        className="add-file-button"
        onClick={onOpenManualAdd}
        disabled={headTreeFiles.length === 0}
        title={
          headTreeFiles.length === 0
            ? 'Preview를 먼저 실행하세요 — HEAD 트리를 아직 불러오지 않았습니다'
            : 'HEAD 트리의 임의 파일을 배포 대상에 직접 추가하거나, 누락된 의존성을 확인합니다'
        }
      >
        + 파일 추가
        {missingCount > 0 && (
          <span
            className={
              missingOverThreshold
                ? 'add-file-button__badge add-file-button__badge--over'
                : 'add-file-button__badge'
            }
            title={missingOverThreshold ? '50개를 초과했습니다' : undefined}
          >
            누락 {missingCount}
          </span>
        )}
      </button>
    </>
  )

  // M-58(2026-09-24) — "전체 선택"이 전용 헤더 행(파일 목록 스크롤 영역
  // 맨 위, sticky)에서 이 toolbar 줄 맨 왼쪽으로 옮겨왔다. 토글 로직은
  // 그대로(화면에 보이는 items 전부를 Extract로 이동), 위치만 바뀐다.
  const toolbar = (
    <div className="included-toolbar-row">
      <TriStateCheckbox
        checked={false}
        indeterminate={false}
        disabled={items.length === 0}
        onChange={() => toggleAll(items.map((item) => item.localPath))}
        aria-label="전체 선택"
        title="화면에 보이는 변경 파일을 모두 Extract 대상으로 이동"
      />
      <div className="included-search-bar">
        <input
          type="text"
          value={searchTerm}
          placeholder="파일명 검색 (예: *.java)"
          aria-label="포함된 파일 검색"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <FilterPatternBar hiddenCount={patternHiddenCount} />
    </div>
  )

  // RT-51(§5.1) — 빈 상태 문구: 전부 Extract로 이동했으면(패턴/검색과
  // 무관하게 원본이 0개) 그 사실을 알려준다. B안(M-46) — 검색어가 있으면
  // 그게 원인일 가능성이 높으니 우선 안내하고(패턴에도 걸렸을 수 있지만
  // 검색어를 지워서 먼저 확인하면 됨), 없으면 기존대로 패턴 탓으로 본다.
  const emptyMessage =
    totalBeforeFilter === 0
      ? '미선택 변경 파일이 없습니다 — 전부 Extract 대상으로 이동했습니다'
      : searchTerm.trim().length > 0
        ? '검색어와 일치하는 파일이 없습니다'
        : '패턴에 걸려 모든 변경 파일이 숨겨졌습니다'

  const renderLeaf = (item: IncludedFileItem, info: TreeLeafInfo): React.JSX.Element => {
    const isAdded = item.status === 'added'
    const textClassName = [
      'deploy-files-row__local',
      'deploy-files-row__local--clickable',
      isAdded && 'deploy-files-row__local--added'
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <label className="tree-row__leaf-label">
        <input type="checkbox" checked={false} onChange={() => toggleIncluded(item.localPath)} />
        <span className={textClassName}>
          {isAdded && (
            <span className="deploy-files-row__status-marker" aria-hidden="true">
              +{' '}
            </span>
          )}
          {info.name}
        </span>
      </label>
    )
  }

  const renderFolder = (info: TreeFolderInfo): React.JSX.Element => {
    const prefix = `${info.path}/`
    const totalUnderFolder = changedFiles.filter((f) => f.localPath.startsWith(prefix)).length
    const indeterminate = totalUnderFolder > info.fileCount
    const visiblePaths = items.filter((i) => i.localPath.startsWith(prefix)).map((i) => i.localPath)
    return (
      <label className="tree-row__leaf-label">
        <TriStateCheckbox
          checked={false}
          indeterminate={indeterminate}
          onChange={() => toggleAll(visiblePaths)}
          title={`폴더의 변경 파일 ${info.fileCount}개를 모두 Extract 대상으로 이동`}
        />
        <span className="tree-row__name tree-row__name--clickable" onClick={info.toggle}>
          📁 {info.name}
          <span className="tree-row__count"> {info.fileCount}</span>
        </span>
      </label>
    )
  }

  const body = isStale ? (
    <PanelState kind="stale" />
  ) : (
    <div className="file-list__scroll fill-scroll">
      <div className="file-list__body fill-scroll">
        <TreeList
          items={items}
          getPath={(item) => item.localPath}
          expansion={expansion}
          renderLeaf={renderLeaf}
          renderFolder={renderFolder}
          rowClassName="included-row"
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  )

  return <FilePane title={title} toolbar={toolbar} body={body} />
}
