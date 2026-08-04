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
