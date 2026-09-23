import { isAbsolute, relative } from 'node:path'

// RT-56(U-16) §5.1 — 순수 함수. 호출부(validateExportTarget)가 이미
// fs.realpath + 플랫폼별 대소문자 정책까지 적용해 넘긴 두 절대 경로를
// 비교만 한다(fs 접근 없음 → vitest로 결정적 테스트).
//
// 문자열 접두사 비교(startsWith)는 쓰지 않는다 — `D:\work\proj-old`가
// `D:\work\proj`의 하위로 오판되는 함정이 있다(§5.1 RT-56). path.relative가
// 반환하는 값이 ''(같음)이거나 '..'로 시작하지 않고 절대 경로가 아니면
// 진짜 하위 경로라는 것만으로 판정한다.
function isSameOrWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export type ExportTargetClassification = 'INSIDE_REPO' | 'CONTAINS_REPO' | 'OK'

// repoPath(R)·deployDir(F)를 비교해 겹침을 판정한다.
//  - INSIDE_REPO: F가 R과 같거나 R의 하위(저장소 안에 추출) — 사용자
//    요구(동일 금지) + M-33(하위 폴더까지 차단).
//  - CONTAINS_REPO: R이 F의 하위(F가 저장소를 포함) — sub 모드는 F를
//    fs.rm(recursive)로 통째로 지우므로 저장소가 삭제될 수 있다.
//  - OK: 그 외(형제 폴더, 접두사만 같은 형제, F가 저장소를 포함하지
//    않는 상위 폴더 등).
export function classifyExportTarget(
  repoPath: string,
  deployDir: string
): ExportTargetClassification {
  if (isSameOrWithin(repoPath, deployDir)) return 'INSIDE_REPO'
  if (isSameOrWithin(deployDir, repoPath)) return 'CONTAINS_REPO'
  return 'OK'
}
