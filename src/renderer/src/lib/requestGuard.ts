// RT-11(R2)/RT-17(R4·R5) 공용 유틸 — "이 비동기 요청이 아직도 최신
// 요청인가"를 판정하는 단조 증가 카운터. 값 자체는 UI에 표시되지 않는
// 순수 가드용이라 store state로 만들 이유가 없다(searchDebounceTimer·
// updateDialogOpen과 같은 모듈 레벨 변수 관례).
//
// 사용법: 요청을 시작할 때 start()로 새 id를 받아 클로저에 담아두고,
// 응답·실패 처리에서 isCurrent(id)가 false면 그 결과를 버린다. 같은
// 흐름의 후속 요청(예: 다음 페이지)은 새로 시작하지 않고 current()로
// "지금 유효한 세대"만 캡처한다. Reload처럼 진행 중인 요청을 전부
// 무효화하고 싶을 때는 반환값을 쓰지 않고 start()만 호출한다.
export interface RequestGuard {
  start: () => number
  current: () => number
  isCurrent: (id: number) => boolean
}

export function createRequestGuard(): RequestGuard {
  let latest = 0
  return {
    start: () => ++latest,
    current: () => latest,
    isCurrent: (id: number) => id === latest
  }
}
