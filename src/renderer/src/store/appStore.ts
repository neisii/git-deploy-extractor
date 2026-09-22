import { create } from 'zustand'
import { createRepositorySlice } from './slices/repositorySlice'
import type { RepositorySlice } from './slices/repositorySlice'
import { createCommitQuerySlice } from './slices/commitQuerySlice'
import type { CommitQuerySlice } from './slices/commitQuerySlice'
import { createCommitsSlice } from './slices/commitsSlice'
import type { CommitsSlice } from './slices/commitsSlice'
import { createAnalysisSlice } from './slices/analysisSlice'
import type { AnalysisSlice } from './slices/analysisSlice'
import { createDeployFilesSlice } from './slices/deployFilesSlice'
import type { DeployFilesSlice } from './slices/deployFilesSlice'
import { createExportSlice } from './slices/exportSlice'
import type { ExportSlice } from './slices/exportSlice'
import { createUpdateSlice } from './slices/updateSlice'
import type { UpdateSlice } from './slices/updateSlice'

// RT-31(S1) — 991줄이던 단일 appStore.ts(커밋 조회·분석 체이닝·Export
// 파일 계산·업데이트 확인이 모두 한 파일에 있었다)를 7개 슬라이스로
// 나눴다: repository · commitQuery · commits · analysis · deployFiles ·
// export · update(각 src/store/slices/*.ts). 이 파일은 그 슬라이스들을
// 합쳐 하나의 zustand 스토어로 조립하는 역할만 한다 — 컴포넌트가 보는
// `useAppStore`/`selectIsAnalysisStale`/`DeployFilesFilter` 등 공개 API는
// 예전과 동일한 경로(`./appStore`)로 그대로 재export한다.
//
// 슬라이스끼리 서로의 액션을 부를 때는 (예: repositorySlice가 Branch
// 전환 후 커밋을 다시 불러올 때) 파일을 직접 import하지 않고 zustand의
// 공유 get()을 통해서만 부른다(`get().loadCommitsFirstPage()`) — 그래야
// 슬라이스 파일들 사이에 순환 import가 생기지 않는다. 다만 여러 슬라이스가
// 함께 초기화해야 하는 리셋 상수(`emptyDependencyState`·`emptyManualAddState`·
// `idleExportState`)와 요청 가드(`analysisGuard`)처럼 "상태가 아니라
// 순수 값/유틸"인 것들은 그 값을 실제로 정의하는 슬라이스 파일에서
// export해 다른 슬라이스가 import한다.
export type AppState = RepositorySlice &
  CommitQuerySlice &
  CommitsSlice &
  AnalysisSlice &
  DeployFilesSlice &
  ExportSlice &
  UpdateSlice

export const useAppStore = create<AppState>()((...a) => ({
  ...createRepositorySlice(...a),
  ...createCommitQuerySlice(...a),
  ...createCommitsSlice(...a),
  ...createAnalysisSlice(...a),
  ...createDeployFilesSlice(...a),
  ...createExportSlice(...a),
  ...createUpdateSlice(...a)
}))

// 아래는 전부 슬라이스 분리 전 appStore.ts가 갖고 있던 공개 API를 그대로
// 유지하기 위한 재export다 — 실제 정의는 각 슬라이스로 옮겨졌다.
export { parseMultiValueFilter } from './slices/commitsSlice'
export { selectionMatches, selectIsAnalysisStale } from './slices/analysisSlice'
export type { AnalyzedSelection, SelectionSnapshot, DeleteEntry } from './slices/analysisSlice'
export type { DeployFileEntry, DeployFilesFilter } from './slices/deployFilesSlice'
