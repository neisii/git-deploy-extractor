import type { StateCreator } from 'zustand'
import type { DeployFileStatus, JavaDependencyKind } from '../../../../shared/types'
import { loadFilePatterns, saveFilePatterns } from '../../lib/filePatterns'
import { parsePatternList } from '../../lib/filePattern'
import type { FilePattern } from '../../lib/filePattern'
import { api } from '../../api'
import type { AppState } from '../appStore'

// RT-51(§3.2·§5.1 RT-51) — Extract 대상 목록 모델의 출처. `included`은
// 이제 "소속 목록"(true=Extract 대상, false=미선택 변경 파일) 의미로
// 재정의됐다 — 필드 이름은 바꾸지 않았다(exportPlan.buildExportFiles의
// 기존 계약 "included=true가 Export 대상"이 그대로 성립하므로, RT-33이
// 미리 설계해둔 대로 판정 로직을 건드릴 필요가 없었다). `source==='changed'`
// 만 `included:false`(미선택 변경 파일)로 존재할 수 있다 — dependency/
// manual은 추가되는 순간 항상 included:true이고, "되돌리기"는 배열에서
// 완전히 제거하는 것으로 표현한다(원래 목록이 없거나(수동) HEAD 트리로
// 돌아가야 하므로(의존성), included:false로 남겨두면 안 된다).
export type DeployFileSource = 'changed' | 'dependency' | 'manual'

export interface DeployFileEntry {
  localPath: string
  serverPath: string
  status: DeployFileStatus
  included: boolean
  source: DeployFileSource
  // source === 'dependency'일 때만 채워진다(Extract 행의 Impl/I 배지용).
  kind?: JavaDependencyKind
}

// REQ-021/DR-019 — deployFiles가 통째로 교체/초기화되는 지점(새 Preview
// 결과 반영, 선택 비움 등)마다 같이 초기화한다. 별도 영속 상태를 두지
// 않기로 한 결정(DETAILED_DESIGN.md §13.5)에 따라 analysisSlice의
// emptyDependencyState와 동일한 성격의 리셋 묶음이다. commitsSlice·
// analysisSlice도 같은 초기화가 필요해 여기서 export한다.
export const emptyManualAddState = {
  headTreeFiles: [] as string[],
  manuallyAddedPaths: [] as string[]
}

// RT-31(S1) — appStore.ts에서 "포함된 파일"(좌측) + "누락된 의존성"(우측)을
// deployFiles 배열로 옮기는 액션들을 분리한 슬라이스. missingDependencies
// 자체(계산 결과)는 analysisSlice가 소유하고, 여기서는 get()으로 읽어서
// deployFiles로 옮기는 토글만 담당한다(전체 선택 indeterminate 판정과
// 같은 이유로 두 배열 사이에 상태를 중복 저장하지 않는다).
export interface DeployFilesSlice {
  deployFiles: DeployFileEntry[]
  // REQ-019/DR-018 + RT-46(§3.1) — "포함된 파일"에만 적용(누락된 의존성은
  // 항상 .java만 나와 무의미). localStorage(gde:excludePatterns)로 동기
  // 초기화. 제외/포함 두 모드를 갖는다(예전 ExcludePatternEntry는 제외
  // 전용이었음). RT-45 — 좌측 파일명 검색(REQ-025) 삭제로 상태 Filter/검색
  // 상태는 없어지고, 그 대체 안전장치로 screenOnly 플래그가 추가됐다.
  filePatterns: FilePattern[]
  // REQ-021/DR-019 — 배포 대상 파일 수동 추가. headTreeFiles는 팝업
  // 자동완성 후보 풀(선택된 Branch의 HEAD 트리 전체, Preview 성공 시
  // best-effort로 갱신), manuallyAddedPaths는 팝업 안 칩 이력 표시 전용이다.
  // 둘 다 localStorage에 저장하지 않는다 — `[Preview]` 재실행 시(deployFiles
  // 전체 교체와 같은 시점) 함께 초기화된다(DR-019 "생명주기").
  headTreeFiles: string[]
  manuallyAddedPaths: string[]

  // RT-46 — 쉼표·줄바꿈으로 구분한 여러 패턴을 한 번에 추가한다(모드는
  // 입력 전체에 동일 적용). 이미 있는 (pattern, mode)는 새로 만들지 않고
  // enabled만 켠다(screenOnly는 새로 추가되는 항목에만 적용 — 이미 있는
  // 항목의 screenOnly는 togglePatternScreenOnly로 따로 바꾼다). 피드백
  // 문구용으로 추가/활성화 개수를 반환한다.
  addFilePatterns: (
    rawInput: string,
    mode: FilePattern['mode'],
    screenOnly: boolean
  ) => { added: number; activated: number }
  toggleFilePattern: (pattern: string, mode: FilePattern['mode']) => void
  // RT-45(M-1) — 화면 필터링에만 적용되고 Export 대상 계산에는 영향을
  // 주지 않는 패턴으로 전환/복귀한다.
  togglePatternScreenOnly: (pattern: string, mode: FilePattern['mode']) => void
  removeFilePattern: (pattern: string, mode: FilePattern['mode']) => void
  addManualFile: (localPath: string) => Promise<void>
  removeManualFile: (localPath: string) => void
  // 왼쪽 "포함된 파일"(미선택 변경 파일) 체크박스 — 체크하면 Extract로
  // 이동한다(included:false→true). source==='changed'인 항목에만 의미가
  // 있다(왼쪽 목록엔 그것만 나타나므로).
  toggleDeployFileIncluded: (localPath: string) => void
  toggleAllDeployFiles: (visibleLocalPaths: string[]) => void
  // RT-51 — AddFilesPopup의 "추가" 버튼(누락된 의존성 한 개). missingDependencies
  // 에서 후보를 찾아 source:'dependency'로 deployFiles에 추가한다.
  addDependencyToExtract: (localPath: string) => void
  // RT-51/52 — "보이는 항목 모두 추가"(누락된 의존성 한정, add-only).
  addAllVisibleDependencies: (visibleLocalPaths: string[]) => void
  // RT-51 — Extract 행의 × 버튼(출처에 따라 분기: 변경→미선택으로 복귀,
  // 의존성→제거(HEAD 트리로 복귀), 수동→철회).
  removeFromExtract: (localPath: string) => void
  // RT-51 — Extract 목록 헤더 "모두 되돌리기".
  returnAllExtractItems: () => void
  // RT-53(§5.1 RT-53) — Extract 트리의 폴더 × — folderPath 아래 전체를
  // 출처별로 되돌린다(removeFromExtract를 경로마다 반복 적용한 것과
  // 동일 — component-playground.html의 data-fret 핸들러와 같은 방식,
  // `folderPath + '/'`로 시작하는 항목만 대상).
  returnFolderFromExtract: (folderPath: string) => void
}

export const createDeployFilesSlice: StateCreator<AppState, [], [], DeployFilesSlice> = (
  set,
  get
) => ({
  deployFiles: [],
  filePatterns: loadFilePatterns(),
  ...emptyManualAddState,

  // RT-46(§3.1) — 빈 입력·빈 항목은 무시. 같은 (pattern, mode)가 이미
  // 있으면 새로 추가하지 않고 enabled만 켠다(중복 방지 — 예전에 껐던
  // 패턴을 다시 입력했을 때 자연스럽게 "다시 켜기"로 동작). 모드는 입력
  // 전체(쉼표·줄바꿈으로 나뉜 여러 패턴)에 동일하게 적용된다.
  addFilePatterns: (rawInput, mode, screenOnly) => {
    const inputs = parsePatternList(rawInput)
    if (inputs.length === 0) return { added: 0, activated: 0 }

    let added = 0
    let activated = 0
    set((state) => {
      let next = state.filePatterns
      for (const pattern of inputs) {
        const existing = next.find((p) => p.pattern === pattern && p.mode === mode)
        if (existing) {
          if (!existing.enabled) {
            activated += 1
            next = next.map((p) => (p === existing ? { ...p, enabled: true } : p))
          }
        } else {
          added += 1
          next = [...next, { pattern, mode, enabled: true, screenOnly }]
        }
      }
      saveFilePatterns(next)
      return { filePatterns: next }
    })
    return { added, activated }
  },

  toggleFilePattern: (pattern, mode) => {
    set((state) => {
      const next = state.filePatterns.map((p) =>
        p.pattern === pattern && p.mode === mode ? { ...p, enabled: !p.enabled } : p
      )
      saveFilePatterns(next)
      return { filePatterns: next }
    })
  },

  togglePatternScreenOnly: (pattern, mode) => {
    set((state) => {
      const next = state.filePatterns.map((p) =>
        p.pattern === pattern && p.mode === mode ? { ...p, screenOnly: !p.screenOnly } : p
      )
      saveFilePatterns(next)
      return { filePatterns: next }
    })
  },

  // REQ-024 — 토글과 달리 이력 자체에서 빠진다(확인 다이얼로그 없이 즉시
  // 처리 — 토글/removeManualFile과 동일한 관례).
  removeFilePattern: (pattern, mode) => {
    set((state) => {
      const next = state.filePatterns.filter((p) => !(p.pattern === pattern && p.mode === mode))
      saveFilePatterns(next)
      return { filePatterns: next }
    })
  },

  // REQ-021/DR-019: 팝업(AddFilesPopup)에서 후보를 선택했을 때. Server
  // Path는 §7.2 의존성 후보와 동일하게 Main에서 Mapping Rule로 계산한다
  // (Renderer는 MappingProfile 전체를 갖고 있지 않다). 이미 deployFiles에
  // 있으면(다른 경로로 이미 들어와 있거나 중복 클릭) 아무 것도 하지 않는다.
  addManualFile: async (localPath) => {
    const { repository, selectedBranch, selectedProfile, deployFiles } = get()
    if (!repository.path || !selectedBranch) return
    if (deployFiles.some((f) => f.localPath === localPath)) return

    const entry = await api.analysis.resolveManualFile({
      repoPath: repository.path,
      branch: selectedBranch,
      profileName: selectedProfile,
      localPath
    })

    set((state) => {
      // IPC 왕복 중 이미 추가됐을 수 있다(연속 클릭) — 다시 한번 확인.
      if (state.deployFiles.some((f) => f.localPath === localPath)) return {}
      return {
        deployFiles: [...state.deployFiles, { ...entry, included: true, source: 'manual' }],
        manuallyAddedPaths: [...state.manuallyAddedPaths, localPath]
      }
    })
  },

  // 팝업 칩의 × — 제외 패턴 칩과 달리 토글이 아니라 철회다(이력성 데이터가
  // 아니라 그 자리에서 추가/철회하는 1회성 액션 — RISK_ISSUES.md 결정
  // 이력 #48). RT-51 — Extract 행의 ×(source==='manual')도 이 액션을
  // 그대로 재사용한다(원래 목록이 없어 "철회"뿐이므로 removeFromExtract가
  // 위임한다).
  removeManualFile: (localPath) => {
    set((state) => ({
      deployFiles: state.deployFiles.filter((f) => f.localPath !== localPath),
      manuallyAddedPaths: state.manuallyAddedPaths.filter((p) => p !== localPath)
    }))
  },

  // 왼쪽 "포함된 파일" 체크박스 — included를 뒤집는다. 왼쪽 목록엔
  // source==='changed' && !included인 행만 나타나므로 실질적으로는 항상
  // false→true(Extract로 이동)로만 호출된다.
  toggleDeployFileIncluded: (localPath) => {
    set((state) => ({
      deployFiles: state.deployFiles.map((f) =>
        f.localPath === localPath ? { ...f, included: !f.included } : f
      )
    }))
  },

  // 정정(RISK_ISSUES.md 결정 이력 #33): 필터 로직을 여기서 다시 계산하지
  // 않고, 화면에 실제로 표시 중인 목록(RT-45 이후: 파일 패턴만 반영됨,
  // 상태 Filter·검색은 삭제됨)의 경로를 그대로 파라미터로 받는다(단일
  // 진실 공급원). RT-51 — 왼쪽 목록은 이제 항상 !included만 보여주므로
  // "전부 included"인 경우가 나타나지 않아, 이 액션은 사실상 "화면에
  // 보이는 변경 파일을 전부 Extract로 이동"(단방향)으로 동작한다(§5.1
  // RT-51 명세와 일치) — 로직 자체는 그대로 두되(재사용 가능한 일반
  // 토글이라 굳이 단순화하지 않음) 실질 동작만 바뀐다.
  toggleAllDeployFiles: (visibleLocalPaths) => {
    set((state) => {
      const visibleSet = new Set(visibleLocalPaths)
      const visible = state.deployFiles.filter((f) => visibleSet.has(f.localPath))
      const allIncluded = visible.length > 0 && visible.every((f) => f.included)
      const nextIncluded = !allIncluded
      return {
        deployFiles: state.deployFiles.map((f) =>
          visibleSet.has(f.localPath) ? { ...f, included: nextIncluded } : f
        )
      }
    })
  },

  // RT-51 — AddFilesPopup의 "추가"(누락된 의존성 한 개). 이미 deployFiles에
  // 있으면(연속 클릭 등) 아무 것도 하지 않는다.
  addDependencyToExtract: (localPath) => {
    set((state) => {
      if (state.deployFiles.some((f) => f.localPath === localPath)) return {}
      const candidate = state.missingDependencies.find((d) => d.localPath === localPath)
      if (!candidate) return {}
      return {
        deployFiles: [
          ...state.deployFiles,
          {
            localPath: candidate.localPath,
            serverPath: candidate.serverPath,
            status: candidate.status,
            included: true,
            source: 'dependency',
            kind: candidate.kind
          }
        ]
      }
    })
  },

  // RT-51/52 — "보이는 항목 모두 추가"(누락된 의존성 한정, add-only —
  // 이미 추가된 건 건드리지 않는다. 받은 경로는 팝업이 현재 화면에 보여준
  // 누락된 의존성 경로만 넘긴다).
  addAllVisibleDependencies: (visibleLocalPaths) => {
    set((state) => {
      const visibleSet = new Set(visibleLocalPaths)
      const existing = new Set(state.deployFiles.map((f) => f.localPath))
      const toAdd = state.missingDependencies.filter(
        (d) => visibleSet.has(d.localPath) && !existing.has(d.localPath)
      )
      if (toAdd.length === 0) return {}
      return {
        deployFiles: [
          ...state.deployFiles,
          ...toAdd.map((d) => ({
            localPath: d.localPath,
            serverPath: d.serverPath,
            status: d.status,
            included: true,
            source: 'dependency' as const,
            kind: d.kind
          }))
        ]
      }
    })
  },

  // RT-51 — Extract 행의 × 하나. 출처별로 되돌아갈 곳이 다르다: 변경 파일은
  // included:false(왼쪽 목록으로 복귀), 의존성은 배열에서 제거(AddFilesPopup
  // HEAD 트리에 다시 붉은색으로 나타남), 수동은 제거+이력에서도 제거(철회,
  // removeManualFile과 동일).
  removeFromExtract: (localPath) => {
    const entry = get().deployFiles.find((f) => f.localPath === localPath)
    if (!entry) return
    if (entry.source === 'changed') {
      set((state) => ({
        deployFiles: state.deployFiles.map((f) =>
          f.localPath === localPath ? { ...f, included: false } : f
        )
      }))
      return
    }
    if (entry.source === 'manual') {
      get().removeManualFile(localPath)
      return
    }
    // source === 'dependency'
    set((state) => ({
      deployFiles: state.deployFiles.filter((f) => f.localPath !== localPath)
    }))
  },

  // RT-51 — Extract 목록 헤더 "모두 되돌리기". 변경 파일은 전부
  // included:false, 의존성·수동은 전부 제거(수동은 이력도 함께 비움).
  returnAllExtractItems: () => {
    set((state) => ({
      deployFiles: state.deployFiles
        .filter((f) => f.source !== 'dependency' && f.source !== 'manual')
        .map((f) => (f.included ? { ...f, included: false } : f)),
      manuallyAddedPaths: []
    }))
  },

  // RT-53 — 위 returnAllExtractItems와 같은 로직을 prefix로 좁혔을
  // 뿐이다(전체 대신 `folderPath/`로 시작하는 것만). 의존성/수동은
  // 제거, 변경은 included:false.
  returnFolderFromExtract: (folderPath) => {
    const prefix = `${folderPath}/`
    set((state) => ({
      deployFiles: state.deployFiles
        .filter(
          (f) =>
            !(
              f.included &&
              (f.source === 'dependency' || f.source === 'manual') &&
              f.localPath.startsWith(prefix)
            )
        )
        .map((f) =>
          f.included && f.source === 'changed' && f.localPath.startsWith(prefix)
            ? { ...f, included: false }
            : f
        ),
      manuallyAddedPaths: state.manuallyAddedPaths.filter((p) => !p.startsWith(prefix))
    }))
  }
})
