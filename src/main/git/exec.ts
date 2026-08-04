import { execFile } from 'node:child_process'
import type { GitCommandResult } from './types'

const MAX_BUFFER = 20 * 1024 * 1024

export function runGit(repoPath: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', repoPath, '-c', 'core.quotepath=false', ...args],
      { cwd: repoPath, encoding: 'buffer', maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        const stdoutText = stdout.toString('utf8')
        const stderrText = stderr.toString('utf8')

        if (error) {
          // execFile reports a numeric error.code for a normal nonzero git
          // exit (e.g. rev-parse on a non-repo). Anything else (string code
          // like ENOENT) means git itself couldn't be spawned.
          if (typeof error.code === 'number') {
            resolve({ stdout: stdoutText, stderr: stderrText, exitCode: error.code })
            return
          }
          reject(error)
          return
        }

        resolve({ stdout: stdoutText, stderr: stderrText, exitCode: 0 })
      }
    )
  })
}
