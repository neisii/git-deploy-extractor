import { runGit } from './exec'
import { listTrackedFiles } from './lsTree'
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

// RISK_ISSUES.md §7.3 — 파일 경로의 마지막 조각(파일명)에 대한 부분 일치.
// §7.2의 좌우 검색 필드와 매칭 기준을 통일했다.
function matchesFileName(path: string, term: string): boolean {
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  return fileName.toLowerCase().includes(term.toLowerCase())
}

// RT-10(R1/M-5) — 해시 필터는 git이 인정하는 축약 해시를 포함한 16진수
// 문자열만 허용한다(git 최소 축약 길이 4자 ~ SHA-1 40자, 여유를 둬
// SHA-256 저장소의 64자까지 받는다). 이 형식을 벗어나는 입력(예:
// `--output=<path>`)은 git 인자로 절대 넘기지 않는다 — 검증 없이 넘기면
// git이 `--output`을 실제 옵션으로 해석해 임의 경로에 파일을 쓴다(재현
// 확인됨).
const HASH_TOKEN_RE = /^[0-9a-f]{4,64}$/i

export interface PartitionedHashFilter {
  valid: string[]
  invalid: string[]
}

export function partitionHashFilter(hashes: string[]): PartitionedHashFilter {
  const valid: string[] = []
  const invalid: string[] = []
  for (const hash of hashes) {
    if (HASH_TOKEN_RE.test(hash)) {
      valid.push(hash)
    } else {
      invalid.push(hash)
    }
  }
  return { valid, invalid }
}

// REQ-023 — 붙여넣은 해시 목록과 정확히 일치(git이 인정하는 축약 해시 포함)
// 하는 커밋만 조회한다. branch/기간 등 다른 모든 조건을 무시하는 별도
// 경로다 — `--no-walk`로 각 해시가 가리키는 커밋 자체만 가져오고(조상까지
// 안 훑음), 페이지네이션은 git이 아니라 이 함수가 결과 배열을 슬라이스해서
// 처리한다(해시 개수가 보통 적어 git 쪽 --skip/-n을 쓸 이유가 없음).
async function listCommitsByHash(
  repoPath: string,
  hashes: string[],
  skip: number,
  pageSize: number,
  maxCount: number
): Promise<ListCommitsResult> {
  const { valid: unique, invalid } = partitionHashFilter(Array.from(new Set(hashes)))
  const invalidHashes = invalid.length > 0 ? invalid : undefined

  if (unique.length === 0) {
    return { commits: [], hasMore: false, invalidHashes }
  }
  if (skip >= maxCount) {
    return { commits: [], hasMore: false, invalidHashes }
  }

  const pretty = `--pretty=format:%H${FIELD_SEP}%an${FIELD_SEP}%ad${FIELD_SEP}%s${RECORD_SEP}`
  // 여기서는 `--`(pathspec 구분자)를 넣지 않는다 — 이 해시들은 revision
  // 인자라 `--` 뒤에 두면 git이 경로로 재해석해 아무 것도 안 걸린다(재현
  // 확인됨, git이 pathspec 매치로 취급). 옵션 주입 방지는 위
  // partitionHashFilter의 16진수 전용 검증만으로 충분하다 — 그 형식은
  // `-`로 시작할 수 없다.
  const baseArgs = ['log', '--no-walk', '--encoding=UTF-8', '--date=iso-strict', pretty]

  let result = await runGit(repoPath, [...baseArgs, ...unique])
  if (result.exitCode !== 0) {
    // 목록 중 일부(또는 전부)가 존재하지 않는 해시일 수 있다 — 하나씩 존재
    // 여부를 확인해 유효한 것만 걸러 재시도한다. 오타 하나 때문에 전체가
    // 실패해 "붙여넣은 나머지는 다 맞는데 결과가 0건"이 되는 걸 피하기
    // 위함이다.
    const checks = await Promise.all(
      unique.map(async (hash) => {
        const check = await runGit(repoPath, ['cat-file', '-e', `${hash}^{commit}`])
        return check.exitCode === 0 ? hash : null
      })
    )
    const existing = checks.filter((hash): hash is string => hash !== null)
    if (existing.length === 0) {
      return { commits: [], hasMore: false, invalidHashes }
    }
    result = await runGit(repoPath, [...baseArgs, ...existing])
    if (result.exitCode !== 0) {
      throw new Error(`Commit 목록 조회 실패: ${result.stderr.trim()}`)
    }
  }

  const all = parseCommitRecords(result.stdout)
  const limit = Math.min(pageSize, maxCount - skip)
  const commits = all.slice(skip, skip + limit)
  const hasMore = skip + commits.length < Math.min(all.length, maxCount)
  return { commits, hasMore, invalidHashes }
}

export async function listCommits(params: ListCommitsParams): Promise<ListCommitsResult> {
  const {
    repoPath,
    branch,
    startDate,
    endDate,
    maxCount,
    skip,
    pageSize,
    searchTerm,
    authors,
    excludeMerges,
    hashFilter
  } = params
  const searchMode = params.searchMode ?? 'message'

  if (hashFilter && hashFilter.length > 0) {
    return listCommitsByHash(repoPath, hashFilter, skip, pageSize, maxCount)
  }

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

  // REQ-022 — 작성자 부분 일치(대소문자 무관). git --author는 정규식이지만
  // 특수문자 이스케이프 없이 그대로 넘긴다(§7.3 searchTerm --grep과 동일한
  // 기존 관례 — 사용자 이름에 정규식 메타문자가 흔하지 않아 실용적으로 충분).
  // --author를 여러 번 주면 git이 기본적으로 OR로 묶는다(--all-match를
  // 안 줬으므로) — "여러 작성자 중 하나라도 일치하면 포함"을 그냥
  // 반복해서 넘기는 것만으로 얻는다.
  if (authors && authors.length > 0) {
    for (const a of authors) {
      args.push(`--author=${a}`)
    }
    args.push('-i')
  }
  if (excludeMerges) {
    args.push('--no-merges')
  }

  let pathspecArgs: string[] = []
  if (searchTerm && searchMode === 'filename') {
    // 2단계 구현(RISK_ISSUES.md §7.3): ① HEAD 트리 전체 파일 목록 조회
    // ② 파일명이 매치하는 경로만 pathspec으로 좁혀 git log에 전달.
    const allPaths = await listTrackedFiles(repoPath, branch)
    const matched = allPaths.filter((path) => matchesFileName(path, searchTerm))
    // `git log ... --`처럼 `--` 뒤에 경로를 하나도 안 주면 "필터 없음"으로
    // 해석되어 오히려 전체 커밋을 돌려준다(재현 테스트로 확인,
    // DETAILED_DESIGN.md §0.1) — 매치가 0건이면 git을 호출하지 않고
    // 바로 빈 결과를 반환해 이 함정을 피한다.
    if (matched.length === 0) {
      return { commits: [], hasMore: false }
    }
    pathspecArgs = ['--', ...matched]
  } else if (searchTerm) {
    args.push(`--grep=${searchTerm}`, '-i')
  }

  args.push(`--skip=${skip}`, '-n', String(limit), ...pathspecArgs)

  const result = await runGit(repoPath, args)
  if (result.exitCode !== 0) {
    throw new Error(`Commit 목록 조회 실패: ${result.stderr.trim()}`)
  }

  const commits = parseCommitRecords(result.stdout)
  const hasMore = commits.length === limit && skip + commits.length < maxCount
  return { commits, hasMore }
}
