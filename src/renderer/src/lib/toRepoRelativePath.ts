// RT-53(§5.1 RT-53, M-34) — 경로 복사 값 정규화. 이 앱의 경로는 이미
// 저장소 루트 기준 상대경로(git 출력)라 대부분 그대로 두지만, 구분자는
// `/`로 고정한다(M-34 — Windows `\` 설정 제공은 후속). 이미 상대경로인
// 값은 그대로 둔다(선행 `./`·`/`만 제거).
export function toRepoRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\/+/, '')
}
