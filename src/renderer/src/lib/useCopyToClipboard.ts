import { useCallback, useEffect, useRef, useState } from 'react'

export type CopyStatus = 'idle' | 'success' | 'error'

// RT-16(U7) — Export 완료 경로를 클릭해 복사해도 성공/실패 피드백이
// 전혀 없었다(조용히 navigator.clipboard.writeText만 호출). 성공하면
// 약 1.5초간 'success' 상태를 보여주고 idle로 되돌리고, 실패하면 재시도
// 전까지 'error' 상태를 유지한다(조용히 무시하지 않는다).
// RT-53(P4)의 파일 트리 경로 복사 버튼도 이 훅을 재사용할 예정이다
// (§5.1 RT-53 명세).
const SUCCESS_RESET_MS = 1500

export function useCopyToClipboard(): {
  status: CopyStatus
  copy: (text: string) => Promise<void>
} {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  const copy = useCallback(async (text: string): Promise<void> => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
    try {
      await navigator.clipboard.writeText(text)
      setStatus('success')
      resetTimer.current = setTimeout(() => setStatus('idle'), SUCCESS_RESET_MS)
    } catch {
      setStatus('error')
    }
  }, [])

  return { status, copy }
}
