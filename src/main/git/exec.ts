import { execFile } from 'node:child_process'
import type { GitCommandResult } from './types'

const MAX_BUFFER = 20 * 1024 * 1024

interface RawGitResult {
  stdout: Buffer
  stderr: string
  exitCode: number
}

function execGit(repoPath: string, args: string[]): Promise<RawGitResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', repoPath, '-c', 'core.quotepath=false', ...args],
      { cwd: repoPath, encoding: 'buffer', maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        const stderrText = stderr.toString('utf8')

        if (error) {
          // execFile reports a numeric error.code for a normal nonzero git
          // exit (e.g. rev-parse on a non-repo). Anything else (string code
          // like ENOENT) means git itself couldn't be spawned.
          if (typeof error.code === 'number') {
            resolve({ stdout, stderr: stderrText, exitCode: error.code })
            return
          }
          reject(error)
          return
        }

        resolve({ stdout, stderr: stderrText, exitCode: 0 })
      }
    )
  })
}

// 커밋 메시지/브랜치명 등 텍스트 출력을 다루는 대부분의 git 호출에 사용한다.
export async function runGit(repoPath: string, args: string[]): Promise<GitCommandResult> {
  const result = await execGit(repoPath, args)
  return {
    stdout: result.stdout.toString('utf8'),
    stderr: result.stderr,
    exitCode: result.exitCode
  }
}

// RT-24 — 사용자 입력이 git 인자로 들어가는 자리의 옵션 인젝션 방지
// 규약. 이 코드베이스는 두 가지 성격의 자리를 구분한다.
//
//  1) pathspec(파일 경로): 항상 `--` 뒤에 둔다 — git이 `--` 이후는 전부
//     pathspec으로 취급하므로 값이 `-`로 시작해도 옵션으로 오인될 수
//     없다(lsTree.ts/grep.ts/commits.ts의 pathspecArgs가 이미 이렇게
//     한다).
//  2) revision(브랜치명·커밋 해시 등): `--` 뒤에 두면 안 된다 — git이
//     `--` 이후를 pathspec으로 재해석해 아무 것도 안 걸리거나 엉뚱한
//     결과를 낸다(재현 확인, `commits.ts`의 해시 필터 주석 참고). 대신
//     값이 `-`로 시작하지 않는지 여기서 미리 막는다.
//
// 진짜 브랜치명·커밋 해시는 git 자체 규칙상 `-`로 시작할 수 없으므로
// (`git check-ref-format`이 거부, 해시는 16진수) 이 검증은 정상 입력의
// 동작을 절대 바꾸지 않는다. `-`로 시작하는 값을 검증 없이 넘기면 git이
// `--output=<path>` 같은 옵션으로 오인해 임의 경로에 파일을 쓸 수 있다
// (R1, RT-10에서 해시 필터 경로로 실제 확인된 것과 같은 유형의 사고).
export class GitArgumentError extends Error {}

export function assertSafeRevisionArg(value: string, label: string): void {
  if (value.startsWith('-')) {
    throw new GitArgumentError(`${label} 값이 '-'로 시작할 수 없습니다: ${value}`)
  }
}

// `git show`로 파일 내용을 읽어올 때 전용 — stdout을 절대 문자열로 변환하지
// 않는다. utf8 디코딩을 거치면 바이너리/비-UTF8 바이트가 손실될 수 있어
// §4.2(원본 바이트 그대로 보존)를 어길 수 있기 때문이다.
export interface GitBufferResult {
  stdout: Buffer
  stderr: string
  exitCode: number
}

export function runGitBuffer(repoPath: string, args: string[]): Promise<GitBufferResult> {
  return execGit(repoPath, args)
}
