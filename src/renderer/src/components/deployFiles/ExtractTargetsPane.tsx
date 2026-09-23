import { useAppStore, selectIsAnalysisStale } from '../../store/appStore'
import { FilePane } from '../FilePane'
import { PanelState } from '../PanelState'
import { TreeList } from '../TreeList'
import type { TreeFolderInfo, TreeLeafInfo } from '../TreeList'
import { CopyPathButton } from '../CopyPathButton'
import { useExtractTargetsView } from '../../lib/useExtractTargetsView'
import type { ExtractItem } from '../../lib/useExtractTargetsView'
import { useTreeExpansion } from '../../lib/useTreeExpansion'
import type { DeployFileSource } from '../../store/appStore'
import type { JavaDependencyKind } from '../../../../shared/types'

const ALWAYS_OPEN = (): boolean => true

const SOURCE_LABEL: Record<'changed' | 'manual', string> = { changed: '변경', manual: '수동' }
const REMOVE_TITLE: Record<DeployFileSource, string> = {
  changed: '원래 목록으로 되돌림',
  dependency: '누락된 의존성 목록(파일 추가 팝업)으로 되돌림',
  manual: '수동 추가 철회'
}
const KIND_LABEL: Record<JavaDependencyKind, string> = { class: 'Impl', interface: 'I' }
const KIND_TITLE: Record<JavaDependencyKind, string> = { class: '구현체', interface: '인터페이스' }

// RT-51(§3.2·§5.1 RT-51)/RT-53(§5.1 RT-53) — MissingDependenciesPane을
// 대체한다. deployFiles 중 included===true 전부(출처 무관: 변경·의존성·
// 수동)를 트리로 보여준다. 경로 복사 버튼(RT-53)은 TreeList의 자동
// 배치를 끄고(`copyable={false}`) ×와의 16px 간격 규칙을 지키기 위해
// renderLeaf/renderFolder 안에서 직접 배치한다.
export function ExtractTargetsPane(): React.JSX.Element {
  const deployFiles = useAppStore((s) => s.deployFiles)
  const filePatterns = useAppStore((s) => s.filePatterns)
  const removeFromExtract = useAppStore((s) => s.removeFromExtract)
  const returnAllExtractItems = useAppStore((s) => s.returnAllExtractItems)
  const returnFolderFromExtract = useAppStore((s) => s.returnFolderFromExtract)
  const isStale = useAppStore(selectIsAnalysisStale)
  const expansion = useTreeExpansion(ALWAYS_OPEN)

  const { items, patternExcludedCount } = useExtractTargetsView(deployFiles, filePatterns)

  const title = (
    <span className="file-pane__title-text">
      Extract 대상 ({items.length}개
      {patternExcludedCount > 0 && ` · 패턴 제외 ${patternExcludedCount}개`})
    </span>
  )

  const renderLeaf = (item: ExtractItem, info: TreeLeafInfo): React.JSX.Element => {
    const isAdded = item.status === 'added'
    const textClassName = [
      'deploy-files-row__local',
      isAdded && 'deploy-files-row__local--added',
      item.patternExcluded && 'deploy-files-row__local--pattern-excluded'
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <>
        <span className="extract-row__name">
          <span className={textClassName}>
            {isAdded && (
              <span className="deploy-files-row__status-marker" aria-hidden="true">
                +{' '}
              </span>
            )}
            {info.name}
          </span>
          {item.kind && (
            <span className="kind-badge" title={KIND_TITLE[item.kind]}>
              {KIND_LABEL[item.kind]}
            </span>
          )}
          {item.patternExcluded && (
            <span
              className="extract-row__pattern-tag"
              title="활성 파일 패턴에 걸려 Export되지 않음"
            >
              패턴 제외
            </span>
          )}
        </span>
        <span className="extract-row__actions">
          <CopyPathButton path={item.localPath} />
          <button
            type="button"
            className="extract-row__remove"
            onClick={() => removeFromExtract(item.localPath)}
            title={REMOVE_TITLE[item.source]}
            aria-label={`되돌리기: ${item.localPath}`}
          >
            ×
          </button>
          {item.source !== 'dependency' && (
            <span className="extract-row__source-badge">{SOURCE_LABEL[item.source]}</span>
          )}
        </span>
      </>
    )
  }

  const renderFolder = (info: TreeFolderInfo): React.JSX.Element => (
    <>
      <span className="tree-row__name tree-row__name--clickable" onClick={info.toggle}>
        📁 {info.name}
        <span className="tree-row__count"> {info.fileCount}</span>
      </span>
      <span className="extract-row__actions">
        <CopyPathButton path={info.path} />
        <button
          type="button"
          className="extract-row__remove"
          onClick={() => returnFolderFromExtract(info.path)}
          title={`폴더의 ${info.fileCount}개를 모두 원래 목록으로 되돌림(수동 추가는 철회)`}
          aria-label={`폴더 되돌리기: ${info.path}`}
        >
          ×
        </button>
      </span>
    </>
  )

  const body = isStale ? (
    <PanelState kind="stale" />
  ) : (
    <div className="file-list__scroll fill-scroll">
      <div className="file-list__header-row">
        <button type="button" disabled={items.length === 0} onClick={returnAllExtractItems}>
          모두 되돌리기
        </button>
      </div>
      <div className="file-list__body fill-scroll">
        <TreeList
          items={items}
          getPath={(item) => item.localPath}
          expansion={expansion}
          renderLeaf={renderLeaf}
          renderFolder={renderFolder}
          copyable={false}
          rowClassName="extract-row"
          emptyMessage="Extract 대상이 없습니다 — 왼쪽 목록에서 체크하세요"
        />
      </div>
    </div>
  )

  return <FilePane title={title} body={body} />
}
