import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import { setApiForTesting, resetApiForTesting } from '../api'
import type { Api } from '../api'
import type { CommitEntry, ListCommitsResult } from '../../../shared/types'

// RT-11(R2) — 커밋 조회 요청 순서 가드. api.git.listCommits를 직접 제어
// 가능한 Promise로 목킹해(RT-30, setApiForTesting), 응답이 요청 순서와
// 다르게(늦게) 도착하는 상황을 재현한다.

function makeCommit(hash: string): CommitEntry {
  return { hash, author: 'Tester', date: '2026-01-01T00:00:00+09:00', message: hash }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('커밋 조회 요청 순서 가드 (RT-11/R2)', () => {
  beforeEach(() => {
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      selectedBranch: 'main',
      branches: ['main'],
      commits: [],
      commitPagination: { hasMore: false, loading: false },
      commitListError: null
    })
  })

  afterEach(() => {
    resetApiForTesting()
  })

  it('늦게 도착한 이전 첫 페이지 응답이 최신 결과를 덮어쓰지 않는다', async () => {
    const calls: Array<{ resolve: (result: ListCommitsResult) => void }> = []
    const listCommits = (): Promise<ListCommitsResult> => {
      const d = deferred<ListCommitsResult>()
      calls.push(d)
      return d.promise
    }
    setApiForTesting({ git: { listCommits } } as unknown as Api)

    const first = useAppStore.getState().triggerSearch()
    // 검색 조건을 바꿔 첫 조회가 끝나기 전에 두 번째 조회를 시작(레이스 재현).
    const second = useAppStore.getState().triggerSearch()
    expect(calls).toHaveLength(2)

    // 두 번째(최신) 요청이 먼저 응답한다.
    calls[1].resolve({ commits: [makeCommit('B')], hasMore: false })
    await second
    // 그 뒤에 첫 번째(오래된) 요청이 뒤늦게 응답한다.
    calls[0].resolve({ commits: [makeCommit('A')], hasMore: false })
    await first

    expect(useAppStore.getState().commits.map((c) => c.hash)).toEqual(['B'])
  })

  it('첫 페이지 재조회가 진행 중인 다음 페이지 요청의 응답을 무효화한다', async () => {
    useAppStore.setState({
      commits: [makeCommit('X')],
      commitPagination: { hasMore: true, loading: false }
    })

    const calls: Array<{ resolve: (result: ListCommitsResult) => void }> = []
    const listCommits = (): Promise<ListCommitsResult> => {
      const d = deferred<ListCommitsResult>()
      calls.push(d)
      return d.promise
    }
    setApiForTesting({ git: { listCommits } } as unknown as Api)

    const nextPage = useAppStore.getState().loadNextPage()
    // 다음 페이지 응답이 오기 전에 재조회(Reload/검색 조건 변경 등)가 시작된다.
    const reload = useAppStore.getState().triggerSearch()
    expect(calls).toHaveLength(2)

    // 다음 페이지 응답이 뒤늦게 도착 — 이미 무효화된 요청이라 버려져야 한다.
    calls[0].resolve({ commits: [makeCommit('Y')], hasMore: false })
    await nextPage
    calls[1].resolve({ commits: [makeCommit('Z')], hasMore: false })
    await reload

    // 재조회 결과만 반영되고, 무효화된 다음 페이지 응답이 그 위에 이어
    // 붙거나 초기화된 목록을 되살리지 않아야 한다.
    expect(useAppStore.getState().commits.map((c) => c.hash)).toEqual(['Z'])
  })
})
