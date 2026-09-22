import { isAbsolute, join, relative } from 'node:path'

// RT-12(R3) — main/ipc/handlers/*.ts(RT-21로 채널 그룹별 분리)로 들어오는
// IPC 파라미터 중, 검증 없이
// 파일시스템 쓰기/삭제나 git 조회에 쓰이면 위험한 것들을 한곳에서
// 검증한다. 여기서 던지는 에러는 핸들러가 그대로 렌더러에 돌려준다
// (IPC 호출은 실패하면 Promise가 reject되므로 별도 처리가 필요 없다).

export class IpcValidationError extends Error {}

// exportParentDir(package:export)처럼 "이 디렉터리 아래에 만든다" 용도로
// 쓰이는 경로를 검증한다. 빈 문자열이면 안 된다 — getDeployDir이
// `join('', 'git-deploy-extracted')`로 `git-deploy-extracted`라는 상대
// 경로를 만들고, 그걸 그대로 fs.rm(recursive)/fs.mkdir에 넘기면 Electron
// 메인 프로세스의 현재 작업 디렉터리(예상하기 어려운 값) 기준으로
// 해석되어 엉뚱한 곳을 지우거나 만들 수 있다. 절대 경로가 아니어도 같은
// 이유로 거부한다.
export function assertNonEmptyAbsolutePath(path: string, label: string): void {
  if (!path || path.trim().length === 0) {
    throw new IpcValidationError(`${label}이(가) 비어 있습니다.`)
  }
  if (!isAbsolute(path)) {
    throw new IpcValidationError(`${label}이(가) 절대 경로가 아닙니다: ${path}`)
  }
}

// files[].serverPath는 Mapping Profile의 override(`to`)가 그대로 반영된
// 값이다 — 프로필 JSON이 손상되거나 `../../etc/passwd` 같은 값을 담고
// 있으면 join(deployDir, serverPath)가 deployDir 밖으로 나갈 수 있다
// (zip-slip과 같은 패턴). 하나라도 벗어나면 아무 파일도 쓰지 않고 즉시
// 거부한다(buildPackage의 대소문자 충돌 검사와 같은 "전부 쓰기 전에
// 먼저 전부 검사" 원칙).
export function assertServerPathsWithinDir(deployDir: string, serverPaths: string[]): void {
  for (const serverPath of serverPaths) {
    const targetPath = join(deployDir, serverPath)
    const rel = relative(deployDir, targetPath)
    if (rel === '..' || rel.startsWith(`..${'/'}`) || isAbsolute(rel)) {
      throw new IpcValidationError(`Export 대상 폴더를 벗어나는 경로입니다: ${serverPath}`)
    }
  }
}

// REQ-021 수동 추가: 렌더러가 보낸 localPath가 실제로 그 브랜치의 HEAD
// 트리에 있는 파일인지 확인한다. 팝업 후보 목록(headTreeFiles) 자체가
// HEAD 트리 조회 결과라 정상 경로면 항상 통과하지만, 렌더러 상태가
// 오래됐거나(트리 조회 이후 커밋이 바뀜) 임의로 조작된 값이 와도 존재하지
// 않는 파일을 "added"로 조용히 만들어버리지 않도록 막는다.
export function assertManualFileInHeadTree(localPath: string, headTreeFiles: string[]): void {
  if (!headTreeFiles.includes(localPath)) {
    throw new IpcValidationError(`HEAD 트리에 없는 파일입니다: ${localPath}`)
  }
}
