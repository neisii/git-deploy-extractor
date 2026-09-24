import { useEffect, useMemo, useRef, useState } from 'react'
import { Popup } from '../Popup'
import { Chip } from '../Chip'
import { useAppStore } from '../../store/appStore'
import { interpret, matchPattern, parsePatternList } from '../../lib/filePattern'
import type { FilePattern, PatternKind } from '../../lib/filePattern'

export interface FilterPatternsPopupProps {
  onClose: () => void
}

const KIND_LABEL: Record<PatternKind, string> = {
  path: '경로',
  package: '패키지',
  name: '파일명'
}

// 식별자.식별자... 형태(끝에 .** 없음) — 패키지 표기를 의도했을 가능성이
// 높은 파일명 패턴에 안내를 보여주기 위한 휴리스틱(§3.1 해석 오버레이).
const LOOKS_LIKE_PACKAGE_WITHOUT_STAR = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)+$/

function buildFeedback(added: number, activated: number): string {
  if (added > 0 && activated > 0) return `${added}개 추가됨 · ${activated}개는 이미 있어 활성화`
  if (added > 0) return `${added}개 추가됨`
  if (activated > 0) return `${activated}개는 이미 있어 활성화`
  return '이미 등록되어 있습니다'
}

// RT-46(§5.1) — 'patterns' 팝업: 제외/포함 두 구역으로 칩을 나열한다.
// 라벨 클릭 = 활성 토글, ×= 삭제(확인창 없음, REQ-024).
//
// M-51(2026-09-24) — 패턴 추가 입력을 FilterPatternBar(툴바)에서 이
// 팝업으로 옮겼다. 툴바에는 이제 요약과 트리거 버튼만 남는다
// (FilterPatternBar.tsx 참고 — 버튼 텍스트는 M-55(2026-09-24)에서
// "보기+추가"→"설정"으로 바뀌었다). 그래서 "등록이 0개가 되면 자동으로
// 닫는다"던 예전 동작은 없앴다 — 팝업이 이제 "0개인 상태에서 첫 패턴을
// 추가하는" 진입점이기도 해서, 열리자마자 자동으로 닫히면 그 흐름
// 자체가 막힌다.
export function FilterPatternsPopup({ onClose }: FilterPatternsPopupProps): React.JSX.Element {
  const filePatterns = useAppStore((s) => s.filePatterns)
  const deployFiles = useAppStore((s) => s.deployFiles)
  const addFilePatterns = useAppStore((s) => s.addFilePatterns)
  const toggleFilePattern = useAppStore((s) => s.toggleFilePattern)
  const removeFilePattern = useAppStore((s) => s.removeFilePattern)

  const [mode, setMode] = useState<FilePattern['mode']>('exclude')
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
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

  // 한 줄 입력창은 기본적으로 붙여넣은 줄바꿈을 지워버린다 — 줄바꿈을
  // 쉼표로 바꿔 직접 삽입한다(§3.1, 선택 구간을 고려해 커서 위치에 삽입).
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

  const parsedInputs = useMemo(() => parsePatternList(input), [input])
  const showOverlay = focused && parsedInputs.length > 0

  const matchCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of filePatterns) {
      counts.set(
        `${p.mode}:${p.pattern}`,
        deployFiles.filter((f) => matchPattern(p.pattern, f.localPath)).length
      )
    }
    return counts
  }, [filePatterns, deployFiles])

  const excludes = filePatterns.filter((p) => p.mode === 'exclude')
  const includes = filePatterns.filter((p) => p.mode === 'include')
  const activeCount = filePatterns.filter((p) => p.enabled).length

  function renderGroup(patterns: FilePattern[]): React.JSX.Element {
    if (patterns.length === 0) return <div className="status-text">없음</div>
    return (
      <div className="filter-patterns-popup__chips">
        {patterns.map((p) => {
          const { kind, glob } = interpret(p.pattern)
          const count = matchCount.get(`${p.mode}:${p.pattern}`) ?? 0
          return (
            <Chip
              key={`${p.mode}:${p.pattern}`}
              label={p.pattern}
              variant={p.mode}
              on={p.enabled}
              onToggle={() => toggleFilePattern(p.pattern, p.mode)}
              onRemove={() => removeFilePattern(p.pattern, p.mode)}
              removeLabel={`${p.pattern} 삭제`}
              badge={KIND_LABEL[kind]}
              secondaryText={`·${count}`}
              title={`${p.mode === 'exclude' ? '제외' : '포함'} · ${KIND_LABEL[kind]} · ${glob} · 현재 ${count}개 매치 · 클릭하면 ${p.enabled ? '끕니다' : '켭니다'}`}
            />
          )
        })}
      </div>
    )
  }

  return (
    <Popup title={`파일 패턴 (활성 ${activeCount}개)`} onClose={onClose}>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
      {showOverlay && (
        <div className="filter-pattern-bar__overlay" role="status" aria-live="polite">
          {parsedInputs.length === 1 ? (
            <PatternPreviewLine pattern={parsedInputs[0]} deployFiles={deployFiles} />
          ) : (
            <>
              <div>
                {parsedInputs.length}개 패턴 (모두 {mode === 'exclude' ? '제외' : '포함'}로 추가)
              </div>
              {parsedInputs.map((p) => (
                <PatternPreviewLine key={p} pattern={p} deployFiles={deployFiles} prefixed />
              ))}
            </>
          )}
        </div>
      )}
      <div>
        <div className="filter-patterns-popup__section-title">
          제외 — 매치되는 파일을 뺌 (항상 우선)
        </div>
        {renderGroup(excludes)}
      </div>
      <div>
        <div className="filter-patterns-popup__section-title">
          포함 — 활성 포함 패턴이 있으면 그중 하나 이상에 매치되는 파일만 남김
        </div>
        {renderGroup(includes)}
      </div>
      <p className="status-text">
        패키지 표기 a.b.c.**는 경로 **/a/b/c/**로 변환되어 .java 한정이 아닙니다.
      </p>
    </Popup>
  )
}

function PatternPreviewLine({
  pattern,
  deployFiles,
  prefixed
}: {
  pattern: string
  deployFiles: { localPath: string }[]
  prefixed?: boolean
}): React.JSX.Element {
  const { kind, glob } = interpret(pattern)
  const count = deployFiles.filter((f) => matchPattern(pattern, f.localPath)).length
  const looksLikePackage = kind === 'name' && LOOKS_LIKE_PACKAGE_WITHOUT_STAR.test(pattern.trim())
  return (
    <div>
      {prefixed ? `• ${pattern} → ` : '해석: '}[{KIND_LABEL[kind]}] {glob} · 현재 {count}개 파일
      매치
      {count === 0 && ' ⚠'}
      {looksLikePackage && ' — 패키지라면 끝에 .**를 붙이세요'}
    </div>
  )
}
