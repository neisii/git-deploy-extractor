import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from './appStore'
import type { DependencyAnalysisResult, DeployPlan } from '../../../shared/types'

// RT-17(R4·R5) — 분석(Preview + 의존성 분석) 요청 경쟁 상태 방지.
// window.api를 직접 제어 가능한 Promise로 목킹해 응답이 요청 순서와
// 다르게(늦게) 도착하는 상황을 재현한다.

function makePlan(fileName: string): DeployPlan {
  return {
    files: [{ localPath: fileName, serverPath: fileName, status: 'added' }],
    deletedServerPaths: [],
    warnings: [],
    summary: { files: 1, added: 1, modified: 0, deleted: 0 }
  }
}

const inapplicableDependencyResult: DependencyAnalysisResult = {
  applicable: false,
  reason: 'not applicable',
  missingDependencies: [],
  parseWarnings: []
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// 여러 단계의 await가 순차적으로 걸린 체인(preview → listTrackedFiles →
// dependencies)을 한 번에 await할 수 없을 때, predicate가 참이 될 때까지
// 마이크로태스크를 흘려보낸다.
async function flushUntil(predicate: () => boolean, maxTicks = 30): Promise<void> {
  for (let i = 0; i < maxTicks && !predicate(); i++) {
    await Promise.resolve()
  }
}

describe('분석 요청 경쟁 상태 방지 (RT-17/R4·R5)', () => {
  beforeEach(() => {
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      selectedBranch: 'main',
      selectedProfile: 'default',
      selectedHashes: new Set(['a1']),
      analyzing: false,
      dependencyAnalyzing: false,
      deployFiles: [],
      summary: null,
      analyzedSelection: null,
      manuallyAddedPaths: [],
      missingDependencies: []
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('선택이 잠깐 바뀌었다 되돌아온 사이 두 번 Preview하면 먼저 시작한 요청의 늦은 응답이 무시된다', async () => {
    const previewCalls: Array<{ resolve: (r: DeployPlan) => void }> = []
    vi.stubGlobal('window', {
      api: {
        analysis: {
          preview: (): Promise<DeployPlan> => {
            const d = deferred<DeployPlan>()
            previewCalls.push(d)
            return d.promise
          },
          dependencies: (): Promise<DependencyAnalysisResult> =>
            Promise.resolve(inapplicableDependencyResult)
        },
        git: { listTrackedFiles: (): Promise<string[]> => Promise.resolve([]) }
      }
    })

    const first = useAppStore.getState().runPreview()
    expect(previewCalls).toHaveLength(1)

    // 선택을 잠깐 비웠다 다시 채운다 — 최종 선택은 처음과 동일({a1})하므로
    // selectionMatches만으로는 request1을 stale로 판정할 수 없다(요청
    // 번호 가드가 필요한 이유). analyzing은 toggleCommit이 그 자리에서
    // 즉시 false로 되돌린다(RT-17).
    useAppStore.getState().toggleCommit('a1')
    useAppStore.getState().toggleCommit('a1')
    expect(useAppStore.getState().selectedHashes).toEqual(new Set(['a1']))
    expect(useAppStore.getState().analyzing).toBe(false)

    const second = useAppStore.getState().runPreview()
    expect(previewCalls).toHaveLength(2)

    // 두 번째(최신) 요청이 먼저 응답한다.
    previewCalls[1].resolve(makePlan('B.txt'))
    await second

    // 그 뒤에 첫 번째(오래된) 요청이 뒤늦게 응답해도 결과가 덮어써지면
    // 안 된다.
    previewCalls[0].resolve(makePlan('A.txt'))
    await first

    expect(useAppStore.getState().deployFiles.map((f) => f.localPath)).toEqual(['B.txt'])
  })

  it('무효화된 이전 요청의 의존성 분석 완료가 최신 요청의 dependencyAnalyzing을 끄지 않는다', async () => {
    const previewCalls: Array<{ resolve: (r: DeployPlan) => void }> = []
    const dependencyCalls: Array<{ resolve: (r: DependencyAnalysisResult) => void }> = []
    vi.stubGlobal('window', {
      api: {
        analysis: {
          preview: (): Promise<DeployPlan> => {
            const d = deferred<DeployPlan>()
            previewCalls.push(d)
            return d.promise
          },
          dependencies: (): Promise<DependencyAnalysisResult> => {
            const d = deferred<DependencyAnalysisResult>()
            dependencyCalls.push(d)
            return d.promise
          }
        },
        git: { listTrackedFiles: (): Promise<string[]> => Promise.resolve([]) }
      }
    })

    useAppStore.getState().runPreview() // request1 — {a1}
    await flushUntil(() => previewCalls.length === 1)
    previewCalls[0].resolve(makePlan('A.txt'))
    await flushUntil(() => dependencyCalls.length === 1)
    expect(useAppStore.getState().dependencyAnalyzing).toBe(true)

    // 선택 변경 — request1을 무효화하고 dependencyAnalyzing을 즉시 끈다.
    useAppStore.getState().toggleCommit('b2')
    expect(useAppStore.getState().dependencyAnalyzing).toBe(false)

    useAppStore.getState().runPreview() // request2 — {a1, b2}
    await flushUntil(() => previewCalls.length === 2)
    previewCalls[1].resolve(makePlan('B.txt'))
    await flushUntil(() => dependencyCalls.length === 2)
    expect(useAppStore.getState().dependencyAnalyzing).toBe(true)

    // request1의 지연된 의존성 분석 응답이 이제 도착한다 — 이미
    // 무효화됐으므로 request2가 켜 둔 dependencyAnalyzing:true를 꺼서는
    // 안 된다("이전 요청이 끝나며 플래그를 끄는 일이 없어야 함").
    dependencyCalls[0].resolve(inapplicableDependencyResult)
    await flushUntil(() => false, 5)
    expect(useAppStore.getState().dependencyAnalyzing).toBe(true)

    // request2가 정상적으로 끝나면 그때 꺼지고 그 결과가 반영된다.
    dependencyCalls[1].resolve({
      applicable: true,
      missingDependencies: [
        { localPath: 'C.java', serverPath: 'C.java', status: 'added', kind: 'class' }
      ],
      parseWarnings: []
    })
    await flushUntil(() => !useAppStore.getState().dependencyAnalyzing)
    expect(useAppStore.getState().missingDependencies.map((d) => d.localPath)).toEqual(['C.java'])
  })

  it('첫 페이지 재조회(Reload 등) 도중 도착한 분석 응답이 초기화된 상태를 되살리지 못한다', async () => {
    const previewCalls: Array<{ resolve: (r: DeployPlan) => void }> = []
    vi.stubGlobal('window', {
      api: {
        analysis: {
          preview: (): Promise<DeployPlan> => {
            const d = deferred<DeployPlan>()
            previewCalls.push(d)
            return d.promise
          },
          dependencies: (): Promise<DependencyAnalysisResult> =>
            Promise.resolve(inapplicableDependencyResult)
        },
        git: {
          listTrackedFiles: (): Promise<string[]> => Promise.resolve([]),
          listCommits: (): Promise<{ commits: never[]; hasMore: boolean }> =>
            Promise.resolve({ commits: [], hasMore: false })
        }
      }
    })
    useAppStore.setState({ branches: ['main'] })

    useAppStore.getState().runPreview()
    expect(previewCalls).toHaveLength(1)
    expect(useAppStore.getState().analyzing).toBe(true)

    // Reload/검색 조건 변경과 같은 경로(loadCommitsFirstPage)가 진행 중인
    // 분석을 무효화한다.
    await useAppStore.getState().triggerSearch()
    expect(useAppStore.getState().analyzing).toBe(false)
    expect(useAppStore.getState().deployFiles).toEqual([])

    // request1이 뒤늦게 응답해도 초기화된 상태를 되살리면 안 된다.
    previewCalls[0].resolve(makePlan('A.txt'))
    await flushUntil(() => false, 5)
    expect(useAppStore.getState().deployFiles).toEqual([])
    expect(useAppStore.getState().analyzing).toBe(false)
  })
})
