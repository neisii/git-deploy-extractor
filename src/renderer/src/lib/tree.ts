// RT-53(§5.1 RT-53, U-13) — 경로 목록 → 트리 순수 함수 3개(`buildTree`·
// `compressChains`·`flatten`). 상태·렌더링과 완전히 분리해 vitest로
// 직접 테스트한다. 알고리즘은 `docs/refactoring/component-playground.html`
// 의 `buildTree`/`treeHtml`을 그대로 이식했다(이미 목업 검증 완료 —
// §3.4 "목업 검증: 10개 시나리오 통과").

export interface RawFolderNode<T> {
  name: string
  path: string
  dirs: Map<string, RawFolderNode<T>>
  files: LeafRef<T>[]
}

export interface LeafRef<T> {
  name: string
  path: string
  item: T
}

function emptyFolder<T>(name: string, path: string): RawFolderNode<T> {
  return { name, path, dirs: new Map(), files: [] }
}

// items를 경로(getPath)로 쪼개 디렉터리 트리를 만든다. 아직 compact 병합
// 전(디렉터리 세그먼트 하나당 노드 하나)이라 compressChains와 분리했다.
export function buildTree<T>(items: T[], getPath: (item: T) => string): RawFolderNode<T> {
  const root = emptyFolder<T>('', '')
  for (const item of items) {
    const path = getPath(item)
    const parts = path.split('/')
    const name = parts.pop() ?? path
    let node = root
    let acc = ''
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg
      let next = node.dirs.get(seg)
      if (!next) {
        next = emptyFolder<T>(seg, acc)
        node.dirs.set(seg, next)
      }
      node = next
    }
    node.files.push({ name, path, item })
  }
  return root
}

// 하위가 디렉터리 하나뿐이고 자기 파일이 없는 체인을 한 줄로 합친다
// (`src/main/java/com/acme`). compactFromDepth: 이 값보다 얕은(세그먼트
// 수가 작은) 노드는 병합을 시작하지 않는다 — 기본 1(전 구간 compact),
// AddFilesPopup 탐색 트리는 3(1~2단계는 병합 안 함, §5.1 RT-52).
export function compressChains<T>(node: RawFolderNode<T>, compactFromDepth = 1): RawFolderNode<T> {
  const dirs = new Map<string, RawFolderNode<T>>()
  for (const child of node.dirs.values()) {
    let cur = child
    while (
      cur.files.length === 0 &&
      cur.dirs.size === 1 &&
      cur.path.split('/').length >= compactFromDepth
    ) {
      const only = [...cur.dirs.values()][0]
      cur = { ...only, name: `${cur.name}/${only.name}` }
    }
    const compressed = compressChains(cur, compactFromDepth)
    dirs.set(compressed.name, compressed)
  }
  return { ...node, dirs }
}

export type FlatTreeRow<T> =
  | { kind: 'folder'; depth: number; path: string; name: string; fileCount: number }
  | { kind: 'file'; depth: number; path: string; name: string; item: T }

function countFiles<T>(node: RawFolderNode<T>): number {
  let count = node.files.length
  for (const dir of node.dirs.values()) count += countFiles(dir)
  return count
}

// 압축된 트리를 "폴더 먼저(이름순) → 파일(이름순)" 규칙으로 평탄화한다.
// 접힌 폴더(isOpen(path)===false)는 그 아래로 내려가지 않는다 — 접힌
// 폴더 안의 행은 결과 배열 자체에 없다(가상 스크롤 길이가 그만큼 줄어듦).
export function flatten<T>(
  root: RawFolderNode<T>,
  isOpen: (path: string) => boolean
): FlatTreeRow<T>[] {
  const rows: FlatTreeRow<T>[] = []

  function walk(node: RawFolderNode<T>, depth: number): void {
    const dirs = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))
    for (const dir of dirs) {
      rows.push({
        kind: 'folder',
        depth,
        path: dir.path,
        name: dir.name,
        fileCount: countFiles(dir)
      })
      if (isOpen(dir.path)) walk(dir, depth + 1)
    }
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name))
    for (const file of files) {
      rows.push({ kind: 'file', depth, path: file.path, name: file.name, item: file.item })
    }
  }

  walk(root, 0)
  return rows
}
