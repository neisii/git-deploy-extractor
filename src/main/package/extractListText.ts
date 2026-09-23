import type { CommitEntry } from '../../shared/types'

// §5.1 RT-57 — `extract-list.txt` 본문 생성 순수 함수. Main 전용(Renderer의
// TreeList용 트리 구조체(renderer/src/lib/tree.ts)와는 별개 — 이쪽은 텍스트
// 한 뭉치를 만드는 게 목적이라 얕은 노드 구조를 그때그때 만들고 버린다.
// 알고리즘은 docs/refactoring/component-playground.html의 buildTree/treeText를
// 그대로 이식했다(이미 목업 검증 완료).

interface TreeNode {
  name: string
  path: string
  dirs: Map<string, TreeNode>
  files: { name: string; path: string }[]
}

function emptyNode(name: string, path: string): TreeNode {
  return { name, path, dirs: new Map(), files: [] }
}

function buildTree(paths: string[]): TreeNode {
  const root = emptyNode('', '')
  for (const path of paths) {
    const parts = path.split('/')
    const name = parts.pop() ?? path
    let node = root
    let acc = ''
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg
      let next = node.dirs.get(seg)
      if (!next) {
        next = emptyNode(seg, acc)
        node.dirs.set(seg, next)
      }
      node = next
    }
    node.files.push({ name, path })
  }
  return root
}

// 하위가 디렉터리 하나뿐이고 자기 파일이 없는 체인을 한 줄로 합친다
// (예: `src/main/java`) — 화면 TreeList(RT-53)와 동일한 규칙, M-30 확정.
function compressChains(node: TreeNode): TreeNode {
  const dirs = new Map<string, TreeNode>()
  for (const child of node.dirs.values()) {
    let cur = child
    while (cur.files.length === 0 && cur.dirs.size === 1) {
      const only = [...cur.dirs.values()][0]
      cur = { ...only, name: `${cur.name}/${only.name}` }
    }
    const compressed = compressChains(cur)
    dirs.set(compressed.name, compressed)
  }
  return { ...node, dirs }
}

export function treeText(paths: string[]): string {
  if (paths.length === 0) return '  (없음)'

  const root = compressChains(buildTree(paths))
  const lines: string[] = []

  const walk = (node: TreeNode, prefix: string): void => {
    const dirs = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name))
    const entries: Array<{ dir?: TreeNode; file?: { name: string } }> = [
      ...dirs.map((d) => ({ dir: d })),
      ...files.map((f) => ({ file: f }))
    ]
    entries.forEach((entry, i) => {
      const last = i === entries.length - 1
      const connector = last ? '└── ' : '├── '
      if (entry.dir) {
        lines.push(`${prefix}${connector}${entry.dir.name}/`)
        walk(entry.dir, prefix + (last ? '    ' : '│   '))
      } else if (entry.file) {
        lines.push(`${prefix}${connector}${entry.file.name}`)
      }
    })
  }
  walk(root, '')
  return lines.join('\n')
}

// M-31 확정: BOM 없는 UTF-8. 생성 시각은 로컬 시각 + 오프셋
// (`YYYY-MM-DD HH:mm:ss ±HH:MM`) — buildPackage.ts가 쓰던
// formatIsoWithOffset과 달리 'T' 구분자를 쓰지 않는다(머리말 표기 형식).
function formatGeneratedAt(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60))
  const offsetMins = pad(Math.abs(offsetMinutes) % 60)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    `${sign}${offsetHours}:${offsetMins}`
  )
}

// M-32 확정: 최대 10줄, 초과분은 "… 외 K개" 한 줄로 요약. 작성자 열은
// 표시되는 줄(최대 10개) 중 가장 긴 이름에 맞춰 정렬한다.
const COMMIT_LIST_LIMIT = 10

function formatCommitLines(commits: CommitEntry[]): string[] {
  const shown = commits.slice(0, COMMIT_LIST_LIMIT)
  const authorWidth = shown.reduce((max, c) => Math.max(max, c.author.length), 0)
  const lines = shown.map((c) => {
    const shortHash = c.hash.slice(0, 7)
    const date = c.date.slice(0, 10) // --date=iso-strict → YYYY-MM-DDTHH:mm:ss±HH:MM
    return `   ${shortHash}  ${date}  ${c.author.padEnd(authorWidth)}  ${c.message}`
  })
  if (commits.length > COMMIT_LIST_LIMIT) {
    lines.push(`   … 외 ${commits.length - COMMIT_LIST_LIMIT}개`)
  }
  return lines
}

export interface ExtractListTextParams {
  branch: string
  generatedAt: Date
  commits: CommitEntry[] // 선택한 커밋 전체, 표시 순서(최신순) 그대로
  files: string[] // 배포 대상 서버 경로 (Extract 목록 − 활성 패턴 해당 항목, 이미 필터링됨)
  deleted: string[] // 삭제 대상 서버 경로
}

export function buildExtractListText(params: ExtractListTextParams): string {
  const { branch, generatedAt, commits, files, deleted } = params
  const bar = '='.repeat(64)

  const lines = [
    bar,
    ' Extract 목록',
    ` 생성 시각   : ${formatGeneratedAt(generatedAt)}`,
    ` 기준 브랜치 : ${branch}`,
    ` 원본 커밋 (${commits.length}개)`,
    ...formatCommitLines(commits),
    bar,
    '',
    bar,
    ` 배포 대상 파일 (${files.length}개)`,
    bar,
    treeText(files),
    '',
    bar,
    ` 삭제 대상 파일 (${deleted.length}개)`,
    bar,
    treeText(deleted)
  ]
  return lines.join('\n') + '\n'
}
