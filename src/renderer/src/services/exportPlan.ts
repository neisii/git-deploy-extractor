import type { DeployPlanFile } from '../../../shared/types'
import type { FilePattern } from '../lib/filePattern'
import { hiddenByPatterns } from '../lib/filePattern'

// RT-33(S1) — exportSlice.ts의 runExport 안에 인라인으로 있던 "Export
// 대상 파일 계산"을 순수 함수로 뺐다.
//
// REQ-019/DR-018: included=true인 것 중, 활성 제외 패턴에 매치되지 않는
// 것만 Export 대상이다 — deployFiles[].included 자체는 건드리지 않고
// (파생 계산), 여기서 최종적으로 한 번 더 걸러낸다.
//
// RT-51(P4) 이후 기준: Extract 목록 모델이 도입되면 "무엇을 Export
// 대상으로 볼지"의 판정 기준이 `included` 불리언에서 "Extract 목록
// 소속 여부"로 바뀔 예정이다(§5.1 RT-51 명세: "Extract 목록 − 활성
// 패턴 해당 항목"). 그때는 이 함수 내부(그리고 ExportableDeployFile의
// 판정 필드)만 바뀌고, "deployFiles + filePatterns를 받아 Export
// 대상 files 배열을 반환한다"는 계약과 exportSlice 쪽 호출부는 그대로
// 유지될 수 있게, 판정 로직을 이 함수 하나로 모아뒀다.
export interface ExportableDeployFile extends DeployPlanFile {
  included: boolean
}

export function buildExportFiles(
  deployFiles: ExportableDeployFile[],
  filePatterns: FilePattern[]
): DeployPlanFile[] {
  return deployFiles
    .filter((f) => f.included && !hiddenByPatterns(f.localPath, filePatterns))
    .map((f) => ({ localPath: f.localPath, serverPath: f.serverPath, status: f.status }))
}
