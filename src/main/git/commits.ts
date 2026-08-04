import { runGit } from './exec'
import type { CommitEntry } from './types'

export interface ListCommitsParams {
  repoPath: string
  branch: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  maxCount: number
  skip: number
  pageSize: number
  searchTerm?: string
}

export interface ListCommitsResult {
  commits: CommitEntry[]
  hasMore: boolean
}

const FIELD_SEP = '\x1f'
const RECORD_SEP = '\x1e'

function parseCommitRecords(stdout: string): CommitEntry[] {
  return stdout
    .split(RECORD_SEP)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash, author, date, message] = record.split(FIELD_SEP)
      return { hash, author, date, message }
    })
}

export async function listCommits(params: ListCommitsParams): Promise<ListCommitsResult> {
  const { repoPath, branch, startDate, endDate, maxCount, skip, pageSize, searchTerm } = params

  if (skip >= maxCount) {
    return { commits: [], hasMore: false }
  }

  const limit = Math.min(pageSize, maxCount - skip)
  const args = [
    'log',
    branch,
    `--since=${startDate}T00:00:00`,
    `--until=${endDate}T23:59:59`,
    '--encoding=UTF-8',
    '--date=iso-strict',
    `--pretty=format:%H${FIELD_SEP}%an${FIELD_SEP}%ad${FIELD_SEP}%s${RECORD_SEP}`
  ]
  if (searchTerm) {
    args.push(`--grep=${searchTerm}`, '-i')
  }
  args.push(`--skip=${skip}`, '-n', String(limit))

  const result = await runGit(repoPath, args)
  if (result.exitCode !== 0) {
    throw new Error(`Commit 목록 조회 실패: ${result.stderr.trim()}`)
  }

  const commits = parseCommitRecords(result.stdout)
  const hasMore = commits.length === limit && skip + commits.length < maxCount
  return { commits, hasMore }
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDefaultDateRange(today: Date = new Date()): {
  startDate: string
  endDate: string
} {
  const start = new Date(today)
  start.setDate(start.getDate() - 7)
  return { startDate: formatDate(start), endDate: formatDate(today) }
}
