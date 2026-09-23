import { useMemo } from 'react'
import type { DeployFileEntry, DeployFileSource } from '../store/appStore'
import type { DeployFileStatus, JavaDependencyKind } from '../../../shared/types'
import type { FilePattern } from './filePattern'
import { hiddenByPatterns } from './filePattern'

export interface ExtractItem {
  localPath: string
  status: DeployFileStatus
  source: DeployFileSource
  kind?: JavaDependencyKind
  // RT-51(§5.1) — 활성(비 screenOnly) 패턴에 걸려 Export 대상에서 빠진
  // 항목. 숨기지 않고 흐림+취소선+"패턴 제외" 태그로 표시한다.
  patternExcluded: boolean
}

export interface ExtractTargetsView {
  items: ExtractItem[]
  patternExcludedCount: number
}

// RT-51(§3.2·§5.1 RT-51) — Extract 대상 목록(오른쪽) 파생 계산. deployFiles
// 중 included===true인 전부(출처 무관 — 변경·의존성·수동)가 Extract 대상이다.
// screenOnly 패턴은 화면 표시에만 쓰이고 Export/패턴 제외 판정에는 영향을
// 주지 않는다(useIncludedFilesView.selectedCount·exportPlan과 동일 기준).
export function useExtractTargetsView(
  deployFiles: DeployFileEntry[],
  filePatterns: FilePattern[]
): ExtractTargetsView {
  const exportRelevantPatterns = useMemo(
    () => filePatterns.filter((p) => !p.screenOnly),
    [filePatterns]
  )

  const items = useMemo((): ExtractItem[] => {
    return deployFiles
      .filter((f) => f.included)
      .map((f) => ({
        localPath: f.localPath,
        status: f.status,
        source: f.source,
        kind: f.kind,
        patternExcluded: hiddenByPatterns(f.localPath, exportRelevantPatterns)
      }))
  }, [deployFiles, exportRelevantPatterns])

  const patternExcludedCount = useMemo(() => items.filter((i) => i.patternExcluded).length, [items])

  return { items, patternExcludedCount }
}
