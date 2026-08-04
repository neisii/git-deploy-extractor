export interface GitCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export type { CommitEntry } from '../../shared/types'
