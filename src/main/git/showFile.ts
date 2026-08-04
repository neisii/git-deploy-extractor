import { runGitBuffer } from './exec'

// Package Builder가 실제로 복사할 원본 바이트를 가져온다. 존재 여부는
// Commit 분석 엔진(headFileExists, DR-009)이 이미 확인했다는 전제이므로,
// 이 함수는 실패를 예외로 그대로 전파한다(전체 Export 중단 원칙, ARCHITECTURE.md §6).
export async function getHeadFileContent(
  repoPath: string,
  branch: string,
  path: string
): Promise<Buffer> {
  const result = await runGitBuffer(repoPath, ['show', `${branch}:${path}`])
  if (result.exitCode !== 0) {
    throw new Error(`HEAD 파일 조회 실패 (${branch}:${path}): ${result.stderr.trim()}`)
  }
  return result.stdout
}
