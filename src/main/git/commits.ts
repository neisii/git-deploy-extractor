import { runGit, assertSafeRevisionArg } from './exec'
import type { CommitEntry, ListCommitsParams, ListCommitsResult } from '../../shared/types'
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

// RT-48(U-8) — 대소문자 무관 부분 일치, 글자 그대로(정규식 아님).
function messageContainsAny(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase()
  return keywords.some((k) => lower.includes(k.toLowerCase()))
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

  // RT-24(exec.ts 규약) — partitionHashFilter의 16진수 전용 검증(`-`로
  // 시작 불가)만으로 이미 안전하지만, git에 넘기기 직전 지점에서 한 번 더
  // 막아 "revision 인자는 여기를 반드시 거친다"는 불변 조건을 명시적으로
  // 만든다.
  for (const hash of unique) assertSafeRevisionArg(hash, '해시 필터')

  const pretty = `--pretty=format:%H${FIELD_SEP}%an${FIELD_SEP}%ad${FIELD_SEP}%s${RECORD_SEP}`
  // 여기서는 `--`(pathspec 구분자)를 넣지 않는다 — 이 해시들은 revision
  // 인자라 `--` 뒤에 두면 git이 경로로 재해석해 아무 것도 안 걸린다(재현
  // 확인됨, git이 pathspec 매치로 취급). 옵션 주입 방지는 위
  // partitionHashFilter의 16진수 전용 검증 + assertSafeRevisionArg로 충분하다.
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
    includeKeywords,
    excludeKeywords,
    authors,
    excludeMerges,
    hashFilter
  } = params

  if (hashFilter && hashFilter.length > 0) {
    return listCommitsByHash(repoPath, hashFilter, skip, pageSize, maxCount)
  }

  // RT-24(exec.ts 규약) — branch는 revision 인자라 `--` 뒤에 못 두므로
  // (아래 pathspecArgs와 달리) 여기서 '-' 시작 여부만 미리 막는다.
  assertSafeRevisionArg(branch, '브랜치')

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

  const include = includeKeywords ?? []
  const exclude = excludeKeywords ?? []

  if (include.length > 0) {
    // RT-48(M-4) — `-F`(고정 문자열) + `--grep`을 여러 번(git이 기본
    // OR로 묶음, authors와 동일한 관례) 넘긴다. 애초에 정규식으로 해석하지
    // 않으므로 기존 `--grep=<검색어>`(BRE)의 `[skip ci]`가 문자 클래스로
    // 오인되던 결함(재현 확인, DETAILED_DESIGN.md §0.1)도 함께 해소한다.
    args.push('-F', '-i')
    for (const k of include) args.push(`--grep=${k}`)
  }

  if (exclude.length > 0) {
    // RT-48(M-4) — 원래 가정("-P PCRE + `\Q…\E`로 포함·제외를 패턴 하나에
    // 결합")은 실제 git(2.53)으로 재현한 결과 무효였다: `-P --grep`에
    // negative lookahead가 들어가면(예 `\A(?!fix)`) 그 커밋이 실제로는
    // 일치하지 않는데도 결과에 포함되는 버그를 재현했다(같은 저장소에서
    // `--invert-grep`은 정상 동작하지만, "포함 조건과 동시에 AND로 결합"할
    // 방법이 없다 — 전체 --grep 결과를 통째로 뒤집을 뿐이라서). 그래서
    // 제외 키워드가 하나라도 있으면 이 경로 전체를 클라이언트 필터로
    // 전환한다. git의 --skip/-n을 그대로 쓰면 클라이언트 필터로 걸러진
    // "이후" 개수를 다음 페이지의 --skip으로 넘기게 돼(실제로 git 쪽에서
    // 몇 개를 이미 건너뛰었는지와 어긋남) 이미 보여준 커밋이 다음
    // 페이지에 중복 재등장하는 버그가 생긴다(재현 확인) — 그래서 이
    // 검색의 전체 상한인 maxCount만큼을 한 번에 가져와 걸러낸 뒤,
    // [skip, skip+limit) 구간을 여기서 직접 슬라이스한다(git 쪽
    // --skip/-n은 쓰지 않는다). maxCount가 이미 이 조회 전체의 상한이라
    // (사용자가 조정하는 "최대 개수" 필드) 한 번에 가져와도 비용이 늘지
    // 않는다 — 예전에도 여러 페이지로 나눠서든 결국 maxCount까지 훑었다.
    args.push('--skip=0', '-n', String(maxCount))
    const result = await runGit(repoPath, args)
    if (result.exitCode !== 0) {
      throw new Error(`Commit 목록 조회 실패: ${result.stderr.trim()}`)
    }
    const all = parseCommitRecords(result.stdout).filter(
      (c) => !messageContainsAny(c.message, exclude)
    )
    const commits = all.slice(skip, skip + limit)
    const hasMore = skip + commits.length < all.length
    return { commits, hasMore }
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
