import { useEffect, useMemo } from 'react'
import { Popup } from '../Popup'
import { Chip } from '../Chip'
import { useAppStore } from '../../store/appStore'
import { interpret, matchPattern } from '../../lib/filePattern'
import type { FilePattern, PatternKind } from '../../lib/filePattern'

export interface FilterPatternsPopupProps {
  onClose: () => void
}

const KIND_LABEL: Record<PatternKind, string> = {
  path: '경로',
  package: '패키지',
  name: '파일명'
}

// RT-46(§5.1) — 'patterns' 팝업: 제외/포함 두 구역으로 칩을 나열한다.
// 라벨 클릭 = 활성 토글, ×= 삭제(확인창 없음, REQ-024). 등록이 0개가
// 되면 자동으로 닫는다.
export function FilterPatternsPopup({ onClose }: FilterPatternsPopupProps): React.JSX.Element {
  const filePatterns = useAppStore((s) => s.filePatterns)
  const deployFiles = useAppStore((s) => s.deployFiles)
  const toggleFilePattern = useAppStore((s) => s.toggleFilePattern)
  const removeFilePattern = useAppStore((s) => s.removeFilePattern)

  useEffect(() => {
    if (filePatterns.length === 0) onClose()
  }, [filePatterns.length, onClose])

  const matchCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of filePatterns) {
      counts.set(
        `${p.mode}:${p.pattern}`,
        deployFiles.filter((f) => matchPattern(p.pattern, f.localPath)).length
      )
    }
    return counts
  }, [filePatterns, deployFiles])

  const excludes = filePatterns.filter((p) => p.mode === 'exclude')
  const includes = filePatterns.filter((p) => p.mode === 'include')
  const activeCount = filePatterns.filter((p) => p.enabled).length

  function renderGroup(patterns: FilePattern[]): React.JSX.Element {
    if (patterns.length === 0) return <div className="status-text">없음</div>
    return (
      <div className="filter-patterns-popup__chips">
        {patterns.map((p) => {
          const { kind, glob } = interpret(p.pattern)
          const count = matchCount.get(`${p.mode}:${p.pattern}`) ?? 0
          return (
            <Chip
              key={`${p.mode}:${p.pattern}`}
              label={p.pattern}
              variant={p.mode}
              on={p.enabled}
              onToggle={() => toggleFilePattern(p.pattern, p.mode)}
              onRemove={() => removeFilePattern(p.pattern, p.mode)}
              removeLabel={`${p.pattern} 삭제`}
              badge={KIND_LABEL[kind]}
              secondaryText={`·${count}`}
              title={`${p.mode === 'exclude' ? '제외' : '포함'} · ${KIND_LABEL[kind]} · ${glob} · 현재 ${count}개 매치 · 클릭하면 ${p.enabled ? '끕니다' : '켭니다'}`}
            />
          )
        })}
      </div>
    )
  }

  return (
    <Popup title={`파일 패턴 (활성 ${activeCount}개)`} onClose={onClose}>
      <div>
        <div className="filter-patterns-popup__section-title">
          제외 — 매치되는 파일을 뺌 (항상 우선)
        </div>
        {renderGroup(excludes)}
      </div>
      <div>
        <div className="filter-patterns-popup__section-title">
          포함 — 활성 포함 패턴이 있으면 그중 하나 이상에 매치되는 파일만 남김
        </div>
        {renderGroup(includes)}
      </div>
      <p className="status-text">
        패키지 표기 a.b.c.**는 경로 **/a/b/c/**로 변환되어 .java 한정이 아닙니다.
      </p>
    </Popup>
  )
}
