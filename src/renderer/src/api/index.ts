// RT-30(S6·L6) — appStore.ts가 지금까지 Electron preload가 노출하는
// 전역 `window.api`를 직접 참조해서, 스토어 단위 테스트가 IPC 응답을
// 흉내내려면 매번 전역 `window` 자체를 `vi.stubGlobal`로 통째로
// 바꿔치기해야 했다(analysisGuard.test.ts·commitQueryGuard.test.ts).
// 이 모듈이 그 사이에 끼어들어, 스토어는 `window.api` 대신 이 모듈의
// `api`만 참조하고, 테스트는 전역을 건드리지 않고 `setApiForTesting`으로
// 내부 구현만 교체할 수 있다.

export type Api = Window['api']

function realApi(): Api {
  return window.api
}

let resolveApi: () => Api = realApi

// `api`는 앱 전체에서 공유하는 하나의 안정된 객체 참조다 — 실제 구현은
// `resolveApi()`가 가리키는 쪽으로 매 호출마다 위임한다(Proxy). 이렇게
// 지연시키는 이유: 모듈 최상단에서 바로 `window.api`를 읽어버리면,
// `window`를 세팅하지 않고 순수 함수만 테스트하는 다른 스토어 테스트
// (appStore.test.ts)가 이 모듈을 import하는 순간 곧바로 throw한다.
export const api: Api = new Proxy({} as Api, {
  get(_target, prop) {
    return Reflect.get(resolveApi(), prop)
  }
})

// 테스트 전용 — 프로덕션 코드에서는 호출하지 않는다. `it()`/`beforeEach`
// 안에서 필요한 메서드만 채운 부분 객체를 넘겨도 된다(실제로 호출되지
// 않는 나머지 메서드는 비어 있어도 무방 — 기존 vi.stubGlobal 방식과 동일).
export function setApiForTesting(mockApi: Api): void {
  resolveApi = () => mockApi
}

export function resetApiForTesting(): void {
  resolveApi = realApi
}
