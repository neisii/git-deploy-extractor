import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { parsePatternList } from '../../lib/filePattern'
import type { FilePattern } from '../../lib/filePattern'

function buildFeedback(added: number, activated: number): string {
  if (added > 0 && activated > 0) return `${added}개 추가됨 · ${activated}개는 이미 있어 활성화`
  if (added > 0) return `${added}개 추가됨`
  if (activated > 0) return `${activated}개는 이미 있어 활성화`
  return '이미 등록되어 있습니다'
}

// 정정(2026-09-28, §8.2 결정 이력) — AddFilesPopup에서 나가지 않고
// 패턴을 빠르게 추가하기 위한 추가 전용(add-only) 입력 행. 로직(모드
// 선택·붙여넣은 줄바꿈→쉼표 변환·3초 피드백)은 FilterPatternsPopup의
// 추가 입력과 같지만, 해석 미리보기 오버레이·기존 패턴 칩 목록(토글/
// 삭제)은 없다 — 그건 여전히 "패턴 설정" 버튼으로 여는 FilterPatternsPopup
// 몫이다. 의도적으로 별도 컴포넌트로 둔다(작고 독립적이라 공유 추출의
// 이득보다 FilterPatternsPopup의 오버레이 상태와 얽히는 비용이 크다).
export function PatternQuickAddRow(): React.JSX.Element {
  const addFilePatterns = useAppStore((s) => s.addFilePatterns)
  const [mode, setMode] = useState<FilePattern['mode']>('exclude')
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  const submit = (): void => {
    const inputs = parsePatternList(input)
    if (inputs.length === 0) return
    const { added, activated } = addFilePatterns(input, mode)
    setInput('')
    setFeedback(buildFeedback(added, activated))
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000)
  }

  // 한 줄 입력창은 붙여넣은 줄바꿈을 지워버린다 — FilterPatternsPopup과
  // 동일하게 쉼표로 바꿔 커서 위치에 직접 삽입한다.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n') && !text.includes('\r')) return
    e.preventDefault()
    const converted = text.replace(/\r\n|\r|\n/g, ',')
    const target = e.currentTarget
    const start = target.selectionStart ?? target.value.length
    const end = target.selectionEnd ?? target.value.length
    setInput(target.value.slice(0, start) + converted + target.value.slice(end))
  }

  return (
    <div className="filter-patterns-popup__add-row">
      <span>패턴:</span>
      <select value={mode} onChange={(e) => setMode(e.target.value as FilePattern['mode'])}>
        <option value="exclude">제외</option>
        <option value="include">포함</option>
      </select>
      <input
        type="text"
        autoFocus
        value={input}
        placeholder="*.png, src/test/**, com.acme.legacy.**"
        title="파일명: *.png · 경로: src/test/** · 패키지: com.acme.legacy.**(경로로 변환) · 여러 개는 쉼표(,)로 구분"
        onChange={(e) => setInput(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          submit()
        }}
      />
      <button type="button" onClick={submit}>
        +추가
      </button>
      {feedback && (
        <span className="status-text" role="status" aria-live="polite">
          {feedback}
        </span>
      )}
    </div>
  )
}
