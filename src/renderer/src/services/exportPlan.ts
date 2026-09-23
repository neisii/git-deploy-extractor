import type { DeployPlanFile } from '../../../shared/types'
import type { FilePattern } from '../lib/filePattern'
import { hiddenByPatterns } from '../lib/filePattern'

// RT-33(S1) — exportSlice.ts의 runExport 안에 인라인으로 있던 "Export
// 대상 파일 계산"을 순수 함수로 뺐다.
//
// REQ-019/DR-018 + RT-51: Export 대상 = "Extract 목록 − 활성(비 screenOnly)
// 패턴 해당 항목"(§5.1 RT-51 명세). RT-51에서 `included`이 "Extract 목록
// 소속 여부"로 재정의됐지만(deployFilesSlice.ts 주석 참고) 그 의미가 바로
// 이 함수가 이미 하던 "included=true 중 패턴 미매치"와 정확히 일치해서,
// RT-33이 미리 설계해둔 대로 이 함수·ExportableDeployFile은 실제로
// 손대지 않고 그대로 유지됐다.
export interface ExportableDeployFile extends DeployPlanFile {
  included: boolean
}

export function buildExportFiles(
  deployFiles: ExportableDeployFile[],
  filePatterns: FilePattern[]
): DeployPlanFile[] {
  // RT-45(M-1) — screenOnly 패턴은 화면 필터링(검색 대용)에만 쓰이고
  // Export 대상 계산에는 적용하지 않는다(useIncludedFilesView의
  // selectedCount와 동일 기준).
  const exportRelevantPatterns = filePatterns.filter((p) => !p.screenOnly)
  return deployFiles
    .filter((f) => f.included && !hiddenByPatterns(f.localPath, exportRelevantPatterns))
    .map((f) => ({ localPath: f.localPath, serverPath: f.serverPath, status: f.status }))
}
