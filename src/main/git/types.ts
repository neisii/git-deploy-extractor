export interface GitCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface CommitEntry {
  hash: string
  author: string
  date: string
  message: string
}
