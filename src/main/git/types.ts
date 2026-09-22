// RT-23(L1) — CommitEntry는 예전엔 여기서 shared/types를 재export만
// 했다(호출부가 이 파일이 직접 정의한 타입인지 재export인지 구분할 수
// 없는 껍데기). 이제 CommitEntry가 필요한 곳(commits.ts)은 shared/types를
// 직접 import한다 — 이 파일엔 main 프로세스 전용 타입만 남긴다.
export interface GitCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}
