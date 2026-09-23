import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import { setApiForTesting, resetApiForTesting } from '../api'
import type { Api } from '../api'
import type { DeployFileEntry } from './appStore'
import type { DependencyCandidate } from '../../../shared/types'

// RT-51(§3.2·§5.1 RT-51) — Extract 대상 목록 모델. addManualFile은
// 기존 REQ-021 동작(IPC 왕복) 그대로이므로 여기서는 API를 목킹해 source
// 태그만 검증한다. 나머지(addDependencyToExtract/addAllVisibleDependencies/
// removeFromExtract/returnAllExtractItems)는 순수 상태 조작이라 직접
// setState/getState로 검증한다.

function changed(localPath: string, included: boolean): DeployFileEntry {
  return { localPath, serverPath: localPath, status: 'modified', included, source: 'changed' }
}

function dependencyCandidate(
  localPath: string,
  kind: DependencyCandidate['kind'] = 'class'
): DependencyCandidate {
  return { localPath, serverPath: localPath, status: 'added', kind }
}

describe('addManualFile (RT-51)', () => {
  afterEach(() => resetApiForTesting())

  it('추가된 항목에 source:"manual"을 태그한다', async () => {
    useAppStore.setState({
      repository: { path: '/repo', status: 'valid' },
      selectedBranch: 'main',
      deployFiles: [],
      manuallyAddedPaths: []
    })
    setApiForTesting({
      analysis: {
        resolveManualFile: async () => ({
          localPath: 'src/Foo.java',
          serverPath: 'src/Foo.java',
          status: 'added'
        })
      }
    } as unknown as Api)

    await useAppStore.getState().addManualFile('src/Foo.java')

    expect(useAppStore.getState().deployFiles).toEqual([
      {
        localPath: 'src/Foo.java',
        serverPath: 'src/Foo.java',
        status: 'added',
        included: true,
        source: 'manual'
      }
    ])
    expect(useAppStore.getState().manuallyAddedPaths).toEqual(['src/Foo.java'])
  })
})

describe('addDependencyToExtract / addAllVisibleDependencies (RT-51)', () => {
  beforeEach(() => {
    useAppStore.setState({
      deployFiles: [],
      missingDependencies: [
        dependencyCandidate('src/FooImpl.java', 'class'),
        dependencyCandidate('src/Bar.java', 'interface')
      ]
    })
  })

  it('후보를 찾아 source/kind를 채운 채로 추가한다', () => {
    useAppStore.getState().addDependencyToExtract('src/FooImpl.java')
    expect(useAppStore.getState().deployFiles).toEqual([
      {
        localPath: 'src/FooImpl.java',
        serverPath: 'src/FooImpl.java',
        status: 'added',
        included: true,
        source: 'dependency',
        kind: 'class'
      }
    ])
  })

  it('이미 deployFiles에 있으면 아무 것도 하지 않는다', () => {
    useAppStore.getState().addDependencyToExtract('src/FooImpl.java')
    useAppStore.getState().addDependencyToExtract('src/FooImpl.java')
    expect(useAppStore.getState().deployFiles).toHaveLength(1)
  })

  it('add-only — 보이는 경로 중 아직 없는 것만 전부 추가한다', () => {
    useAppStore.getState().addAllVisibleDependencies(['src/FooImpl.java', 'src/Bar.java'])
    expect(
      useAppStore
        .getState()
        .deployFiles.map((f) => f.localPath)
        .sort()
    ).toEqual(['src/Bar.java', 'src/FooImpl.java'])
  })
})

describe('removeFromExtract (RT-51)', () => {
  it('source==="changed"는 included:false로 되돌린다(배열엔 남음)', () => {
    useAppStore.setState({ deployFiles: [changed('src/A.txt', true)] })
    useAppStore.getState().removeFromExtract('src/A.txt')
    expect(useAppStore.getState().deployFiles).toEqual([changed('src/A.txt', false)])
  })

  it('source==="dependency"는 배열에서 완전히 제거한다(HEAD 트리로 복귀)', () => {
    useAppStore.setState({
      deployFiles: [
        {
          localPath: 'src/FooImpl.java',
          serverPath: 'src/FooImpl.java',
          status: 'added',
          included: true,
          source: 'dependency',
          kind: 'class'
        }
      ]
    })
    useAppStore.getState().removeFromExtract('src/FooImpl.java')
    expect(useAppStore.getState().deployFiles).toEqual([])
  })

  it('source==="manual"은 제거하고 manuallyAddedPaths에서도 뺀다(철회)', () => {
    useAppStore.setState({
      deployFiles: [
        {
          localPath: 'src/Manual.java',
          serverPath: 'src/Manual.java',
          status: 'added',
          included: true,
          source: 'manual'
        }
      ],
      manuallyAddedPaths: ['src/Manual.java']
    })
    useAppStore.getState().removeFromExtract('src/Manual.java')
    expect(useAppStore.getState().deployFiles).toEqual([])
    expect(useAppStore.getState().manuallyAddedPaths).toEqual([])
  })
})

describe('returnFolderFromExtract (RT-53, 폴더 ×)', () => {
  it('폴더 경로 아래만 되돌리고 다른 폴더는 그대로 둔다', () => {
    useAppStore.setState({
      deployFiles: [
        changed('src/a/A.txt', true),
        changed('src/b/B.txt', true),
        {
          localPath: 'src/a/Dep.java',
          serverPath: 'src/a/Dep.java',
          status: 'added',
          included: true,
          source: 'dependency',
          kind: 'class'
        },
        {
          localPath: 'src/a/Manual.java',
          serverPath: 'src/a/Manual.java',
          status: 'added',
          included: true,
          source: 'manual'
        }
      ],
      manuallyAddedPaths: ['src/a/Manual.java']
    })

    useAppStore.getState().returnFolderFromExtract('src/a')

    const paths = useAppStore
      .getState()
      .deployFiles.map((f) => f.localPath)
      .sort()
    expect(paths).toEqual(['src/a/A.txt', 'src/b/B.txt'])
    expect(
      useAppStore.getState().deployFiles.find((f) => f.localPath === 'src/a/A.txt')
    ).toMatchObject({ included: false })
    expect(
      useAppStore.getState().deployFiles.find((f) => f.localPath === 'src/b/B.txt')
    ).toMatchObject({ included: true })
    expect(useAppStore.getState().manuallyAddedPaths).toEqual([])
  })
})

describe('returnAllExtractItems (RT-51, "모두 되돌리기")', () => {
  it('변경 파일은 전부 included:false, 의존성·수동은 전부 제거한다', () => {
    useAppStore.setState({
      deployFiles: [
        changed('src/A.txt', true),
        changed('src/B.txt', false), // 이미 미선택인 것도 안전하게 그대로 유지
        {
          localPath: 'src/Dep.java',
          serverPath: 'src/Dep.java',
          status: 'added',
          included: true,
          source: 'dependency',
          kind: 'class'
        },
        {
          localPath: 'src/Manual.java',
          serverPath: 'src/Manual.java',
          status: 'added',
          included: true,
          source: 'manual'
        }
      ],
      manuallyAddedPaths: ['src/Manual.java']
    })

    useAppStore.getState().returnAllExtractItems()

    expect(useAppStore.getState().deployFiles).toEqual([
      changed('src/A.txt', false),
      changed('src/B.txt', false)
    ])
    expect(useAppStore.getState().manuallyAddedPaths).toEqual([])
  })
})
