import { describe, expect, it } from 'vitest'
import { buildTree, compressChains, flatten } from './tree'

interface Item {
  path: string
}
const item = (path: string): Item => ({ path })
const getPath = (i: Item): string => i.path

describe('buildTree', () => {
  it('단일 파일(루트 파일) — 폴더 없이 files에 바로 들어간다', () => {
    const tree = buildTree([item('README.md')], getPath)
    expect(tree.dirs.size).toBe(0)
    expect(tree.files).toEqual([{ name: 'README.md', path: 'README.md', item: item('README.md') }])
  })

  it('중첩 경로 — 세그먼트마다 폴더 노드가 생긴다(압축 전)', () => {
    const tree = buildTree([item('src/main/App.java')], getPath)
    expect(tree.dirs.has('src')).toBe(true)
    const src = tree.dirs.get('src')!
    expect(src.dirs.has('main')).toBe(true)
    const main = src.dirs.get('main')!
    expect(main.files.map((f) => f.name)).toEqual(['App.java'])
  })

  it('같은 이름의 다른 폴더 — 형제 트리로 분리된다', () => {
    const tree = buildTree([item('a/File.java'), item('b/File.java')], getPath)
    expect(tree.dirs.get('a')!.files[0].path).toBe('a/File.java')
    expect(tree.dirs.get('b')!.files[0].path).toBe('b/File.java')
  })

  it('한글 경로도 그대로 다룬다', () => {
    const tree = buildTree([item('문서/계획.txt')], getPath)
    expect(tree.dirs.has('문서')).toBe(true)
    expect(tree.dirs.get('문서')!.files[0].name).toBe('계획.txt')
  })
})

describe('compressChains', () => {
  it('파일이 없고 자식이 하나뿐인 체인을 한 줄로 합친다', () => {
    const tree = buildTree([item('src/main/java/com/acme/App.java')], getPath)
    const compressed = compressChains(tree, 1)
    const [only] = [...compressed.dirs.values()]
    expect(only.name).toBe('src/main/java/com/acme')
    expect(only.path).toBe('src/main/java/com/acme')
    expect(only.files.map((f) => f.name)).toEqual(['App.java'])
  })

  it('중간에 파일이 있으면 그 지점에서 체인이 끊긴다', () => {
    const tree = buildTree([item('src/main/App.java'), item('src/main/java/Impl.java')], getPath)
    const compressed = compressChains(tree, 1)
    // src는 파일이 없고 자식(main)이 하나뿐이라 src/main까지는 합쳐지지만,
    // main 자체엔 파일(App.java)이 있어 거기서 멈춘다 — 합쳐진 노드는
    // 이름이 바뀌므로 dirs 맵의 키도 "src/main"이 된다.
    const src = compressed.dirs.get('src/main')!
    expect(src).toBeDefined()
    expect(src.files.map((f) => f.name)).toEqual(['App.java'])
    expect(src.dirs.has('java')).toBe(true)
  })

  it('compactFromDepth 미만인 얕은 노드는 병합을 시작하지 않는다(AddFilesPopup 탐색 트리)', () => {
    const tree = buildTree([item('src/main/java/com/acme/App.java')], getPath)
    const compressed = compressChains(tree, 3)
    // src(깊이1)는 그대로, main(깊이2)도 그대로 — java(깊이3)부터 병합 가능.
    expect(compressed.dirs.has('src')).toBe(true)
    const src = compressed.dirs.get('src')!
    expect(src.name).toBe('src')
    const main = src.dirs.get('main')!
    expect(main.name).toBe('main')
    const [merged] = [...main.dirs.values()]
    expect(merged.name).toBe('java/com/acme')
  })
})

describe('flatten', () => {
  const alwaysOpen = (): boolean => true

  it('같은 레벨에서는 폴더가 파일보다 먼저(알파벳 순서와 무관)', () => {
    // 'adir'가 알파벳상 'z.txt'보다 앞서지만, 이 테스트의 핵심은 폴더
    // 'zdir'조차도 파일 'a.txt'보다 먼저 온다는 것(폴더 우선 규칙).
    const tree = compressChains(buildTree([item('a.txt'), item('zdir/inside.txt')], getPath), 1)
    const rows = flatten(tree, alwaysOpen)
    expect(rows.map((r) => `${r.kind}:${r.name}`)).toEqual([
      'folder:zdir',
      'file:inside.txt',
      'file:a.txt'
    ])
  })

  it('같은 레벨의 폴더끼리는 이름순', () => {
    const tree = compressChains(buildTree([item('zdir/x.txt'), item('adir/y.txt')], getPath), 1)
    const rows = flatten(tree, alwaysOpen)
    const folderNames = rows.filter((r) => r.kind === 'folder').map((r) => r.name)
    expect(folderNames).toEqual(['adir', 'zdir'])
  })

  it('접힌 폴더는 그 아래 행이 결과에서 빠진다', () => {
    const tree = compressChains(buildTree([item('dir/a.txt'), item('dir/b.txt')], getPath), 1)
    const rows = flatten(tree, () => false)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'folder', name: 'dir', fileCount: 2 })
  })

  it('폴더별로 펼침 상태를 다르게 줄 수 있다', () => {
    const tree = compressChains(buildTree([item('open/a.txt'), item('closed/b.txt')], getPath), 1)
    const rows = flatten(tree, (path) => path === 'open')
    const paths = rows.map((r) => r.path)
    expect(paths).toContain('open/a.txt')
    expect(paths).not.toContain('closed/b.txt')
  })

  it('depth가 중첩 깊이를 반영한다', () => {
    const tree = compressChains(buildTree([item('a/b.txt')], getPath), Infinity) // 병합 안 함
    const rows = flatten(tree, alwaysOpen)
    const folder = rows.find((r) => r.kind === 'folder')!
    const file = rows.find((r) => r.kind === 'file')!
    expect(folder.depth).toBe(0)
    expect(file.depth).toBe(1)
  })
})
