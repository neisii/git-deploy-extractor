import type { DeployFileEntry } from '../store/appStore'

// RT-42 — useIncludedFilesView의 includedSet 계산(원본 deployFiles만
// 있으면 되고 filter/검색어/제외패턴과 무관)을 분리했다. IncludedFilesPane·
// ExtractTargetsPane·AddFilesPopup(RT-51/52)이 각자 독립된 컴포넌트로
// 나뉘어 있고 셋 다 이 값이 필요한데, 굳이 useIncludedFilesView 전체
// (필터링 파이프라인)를 반복 호출할 필요 없이 이 값만 저렴하게 따로
// 구할 수 있게 뺐다.
export function includedPathsSet(deployFiles: DeployFileEntry[]): Set<string> {
  return new Set(deployFiles.map((f) => f.localPath))
}
