import { runGit } from './exec'
import type { CommitEntry } from './types'
import type { ListCommitsParams, ListCommitsResult } from '../../shared/types'
import { getDefaultDateRange } from '../../shared/dateRange'

export type { ListCommitsParams, ListCommitsResult }
export { getDefaultDateRange }

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
