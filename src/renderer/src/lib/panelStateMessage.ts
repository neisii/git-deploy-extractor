export type PanelStateKind = 'empty' | 'loading' | 'stale' | 'error' | 'na'

const FIXED_MESSAGE: Record<'empty' | 'loading' | 'stale', string> = {
  empty: '커밋을 선택하세요',
  loading: '계산 중...',
  stale: '선택이 변경되었습니다 — Preview를 눌러 계산하세요'
}

// RT-40 — §5.1 RT-40 명세의 다섯 상태 메시지. error/na는 동적 부분
// (<메시지>/<사유>)이 있어 detail로 받는다. components/PanelState.tsx가
// 이 함수를 쓴다 — 같은 파일에 두면 컴포넌트 파일이 컴포넌트 외의 값을
// export하게 돼 Fast Refresh가 깨진다(react-refresh/only-export-components)
// 그래서 lib로 분리했다.
export function panelStateMessage(kind: PanelStateKind, detail?: string): string {
  switch (kind) {
    case 'error':
      return detail ? `계산 실패: ${detail}` : '계산 실패'
    case 'na':
      return detail
        ? `이 저장소에는 적용할 수 없습니다 (${detail})`
        : '이 저장소에는 적용할 수 없습니다'
    default:
      return FIXED_MESSAGE[kind]
  }
}
