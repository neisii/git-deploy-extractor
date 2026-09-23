import { afterEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import { setApiForTesting, resetApiForTesting } from '../api'
import type { Api } from '../api'

// RT-55(U-15, §5.1 RT-55) — Reload 전체 초기화 회귀 테스트. 조회 조건·
// 선택·분석 결과가 전부 기본값으로 되돌아가고, M-22가 "유지"로 확정한
// 필드(Export 경로 등)는 손대지 않는지 확인한다.

function mockApi(overrides: Partial<Api['git']> = {}): Api {
  return {
    repository: {
      validate: async () => ({ valid: true })
    },
    git: {
      listBranches: async () => ['main', 'dev'],
      getRemoteProjectName: async () => 'my-project',
      listCommits: async () => ({ commits: [], hasMore: false, invalidHashes: [] }),
      ...overrides
    }
  } as unknown as Api
}

describe('reloadRepository (RT-55)', () => {
  afterEach(() => resetApiForTesting())

  it('Reload 후 조회 조건·선택·분석 결과가 모두 초기값이 된다', async () => {
    setApiForTesting(mockApi())
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      selectedBranch: 'dev', // main도 존재하지만 예전 선택("dev")로 시작 — 기본 브랜치로 되돌아가야 함
      startDate: '2020-01-01',
      endDate: '2020-01-02',
      maxCount: 5,
      keywordText: 'foo',
      searchMode: 'filename',
      authorFilter: 'alice',
      excludeMerges: false,
      hashFilterText: 'deadbeef',
      invalidHashFilter: ['zz'],
      selectedHashes: new Set(['a1', 'b2']),
      analyzing: false,
      analysisError: 'old error',
      analyzedSelection: { hashes: ['a1'], branch: 'dev', profileName: 'default' },
      summary: { totalFiles: 1, deletedFiles: 0, warningCount: 0 } as never,
      deployFiles: [
        { localPath: 'x', serverPath: 'x', status: 'modified', included: true, source: 'changed' }
      ],
      deleteList: [{ path: 'y' }],
      warnings: [{ message: 'w', level: 'error' } as never],
      dependencyApplicable: true,
      missingDependencies: [{ localPath: 'z', serverPath: 'z', status: 'added', kind: 'class' }],
      headTreeFiles: ['a', 'b'],
      manuallyAddedPaths: ['c']
    })

    await useAppStore.getState().reloadRepository()

    const state = useAppStore.getState()
    expect(state.selectedBranch).toBe('main')
    expect(state.startDate).not.toBe('2020-01-01')
    expect(state.endDate).not.toBe('2020-01-02')
    expect(state.maxCount).toBe(100)
    expect(state.keywordText).toBe('')
    expect(state.searchMode).toBe('message')
    expect(state.authorFilter).toBe('')
    expect(state.excludeMerges).toBe(true)
    expect(state.hashFilterText).toBe('')
    expect(state.invalidHashFilter).toEqual([])
    expect(state.selectedHashes).toEqual(new Set())
    expect(state.analysisError).toBeNull()
    expect(state.analyzedSelection).toBeNull()
    expect(state.summary).toBeNull()
    expect(state.deployFiles).toEqual([])
    expect(state.deleteList).toEqual([])
    expect(state.warnings).toEqual([])
    expect(state.dependencyApplicable).toBe(false)
    expect(state.missingDependencies).toEqual([])
    expect(state.headTreeFiles).toEqual([])
    expect(state.manuallyAddedPaths).toEqual([])
  })

  it('기간이 "지금" 기준으로 다시 계산된다', async () => {
    setApiForTesting(mockApi())
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      startDate: '2020-01-01',
      endDate: '2020-01-02'
    })

    await useAppStore.getState().reloadRepository()

    const today = new Date().toISOString().slice(0, 10)
    expect(useAppStore.getState().endDate).toBe(today)
  })

  it('M-22 — 유지 필드(Export 경로 등)는 Reload로 바뀌지 않는다', async () => {
    setApiForTesting(mockApi())
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      exportParentDir: '/some/export/dir'
    })

    await useAppStore.getState().reloadRepository()

    expect(useAppStore.getState().exportParentDir).toBe('/some/export/dir')
  })

  it('저장소 검증 실패 시 초기화하지 않고 오류만 표시한다', async () => {
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      startDate: '2020-01-01',
      endDate: '2020-01-02',
      keywordText: 'foo',
      selectedHashes: new Set(['a1'])
    })
    setApiForTesting({
      repository: { validate: async () => ({ valid: false, error: '깨진 저장소' }) },
      git: {
        listBranches: async () => [],
        getRemoteProjectName: async () => null,
        listCommits: async () => ({ commits: [], hasMore: false })
      }
    } as unknown as Api)

    await useAppStore.getState().reloadRepository()

    const state = useAppStore.getState()
    expect(state.repository.status).toBe('invalid')
    expect(state.repository.error).toBe('깨진 저장소')
    // 초기화되지 않아야 함 — 검증 실패는 재시도를 위해 조건을 그대로 둔다.
    expect(state.startDate).toBe('2020-01-01')
    expect(state.endDate).toBe('2020-01-02')
    expect(state.keywordText).toBe('foo')
    expect(state.selectedHashes).toEqual(new Set(['a1']))
  })
})
