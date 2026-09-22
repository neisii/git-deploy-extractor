import type { DeployPlanSummary } from '../../../shared/types'
import { useAppStore, selectIsAnalysisStale } from '../store/appStore'

export type AnalysisPhase = 'empty' | 'stale' | 'loading' | 'ready' | 'error'

export interface AnalysisPhaseView {
  phase: AnalysisPhase
  // 원시값도 그대로 반환한다 — FooterActionBar처럼 "의존성 확인 중" 메시지를
  // analyzing과 구분해서 따로 보여줘야 하는 컴포넌트는 phase 하나로 뭉뚱그리지
  // 않고 이 값으로 자기 로직을 그대로 유지한다.
  analyzing: boolean
  dependencyAnalyzing: boolean
  isStale: boolean
  summary: DeployPlanSummary | null
  analysisError: string | null
}

// RT-34(S1) — DeploymentPreviewPanel.tsx가 갖고 있던 "empty/stale/loading/
// ready/error" 우선순위 판정을 한 곳으로 모았다(§1 목업의 "분석 단계"
// 다섯 상태와 대응). loading은 analyzing만 본다 — dependencyAnalyzing은
// Preview 요약(summary)과는 무관한 후속 단계라 DeploymentPreviewPanel도
// 원래 안 봤다(§7.2, 우측 "누락된 의존성" 패널 전용 상태).
//
// FooterActionBar·CommitListPanel은 각자 다른 조합(예: 의존성 확인 중
// 메시지, exportStatus까지 포함한 disabled 판정)이 필요해 이 훅으로
// 옮기지 않았다 — 옮기면 그 컴포넌트들이 지금 구독하지 않는 summary/
// analysisError까지 구독하게 돼 불필요한 재렌더링이 생긴다. 그 두
// 컴포넌트는 지금처럼 필요한 원시 필드만 개별 selector로 읽는다.
export function useAnalysisPhase(): AnalysisPhaseView {
  const selectedHashes = useAppStore((s) => s.selectedHashes)
  const analyzing = useAppStore((s) => s.analyzing)
  const dependencyAnalyzing = useAppStore((s) => s.dependencyAnalyzing)
  const analysisError = useAppStore((s) => s.analysisError)
  const summary = useAppStore((s) => s.summary)
  const isStale = useAppStore(selectIsAnalysisStale)

  let phase: AnalysisPhase
  if (analysisError) {
    phase = 'error'
  } else if (selectedHashes.size === 0) {
    phase = 'empty'
  } else if (analyzing) {
    phase = 'loading'
  } else if (isStale || !summary) {
    phase = 'stale'
  } else {
    phase = 'ready'
  }

  return { phase, analyzing, dependencyAnalyzing, isStale, summary, analysisError }
}
