import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { useWorkAreaPopup } from '../../lib/workAreaPopupContext'
import { interpret, matchPattern, parsePatternList } from '../../lib/filePattern'
import type { FilePattern, PatternKind } from '../../lib/filePattern'

export interface FilterPatternBarProps {
  // RT-46 — 상태 Filter까지만 반영한 "포함된 파일" 중 패턴에 걸려 숨겨진
  // 개수. useIncludedFilesView가 이미 계산해서 갖고 있어(IncludedFilesPane)
  // 여기서 다시 계산하지 않고 그대로 받는다.
  hiddenCount: number
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

// RT-46(§3.1·§5.1) — 파일 패턴(제외/포함) 입력 줄. 한 번에 여러 패턴을
// 쉼표(줄바꿈도 구분자)로 입력할 수 있고, 모드는 입력 전체에 동일 적용.
// 팝업 자체(FilterPatternsPopup)는 PopupHost가 렌더링한다 — 여기서는
// "보기" 트리거만 WorkArea 컨텍스트로 올린다.
export function FilterPatternBar({ hiddenCount }: FilterPatternBarProps): React.JSX.Element {
  const filePatterns = useAppStore((s) => s.filePatterns)
  const deployFiles = useAppStore((s) => s.deployFiles)
  const addFilePatterns = useAppStore((s) => s.addFilePatterns)
  const { open } = useWorkAreaPopup()

  const [mode, setMode] = useState<FilePattern['mode']>('exclude')
  // RT-45(M-1) — 좌측 파일명 검색(REQ-025)을 삭제한 대체 안전장치: 화면
  // 필터링에만 적용되고 Export 대상 계산은 건드리지 않는 패턴. 기본은
  // 꺼짐(기존 exclude 패턴과 동일하게 Export까지 반영)이라 이 체크박스는
  // "검색하듯 잠깐 걸러보고 싶을 때"만 명시적으로 켠다.
  const [screenOnly, setScreenOnly] = useState(false)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  const activePatterns = useMemo(() => filePatterns.filter((p) => p.enabled), [filePatterns])

  const submit = (): void => {
    const inputs = parsePatternList(input)
    if (inputs.length === 0) return
    const { added, activated } = addFilePatterns(input, mode, screenOnly)
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

  const tooltipLines =
    activePatterns.length === 0
      ? '활성 패턴 없음'
      : [`활성 패턴 ${activePatterns.length}개`]
          .concat(activePatterns.map((p) => `${p.mode === 'exclude' ? '−' : '+'} ${p.pattern}`))
          .join('\n')

  return (
    <div className="filter-pattern-bar">
      <div className="filter-pattern-bar__row">
        <span>패턴:</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as FilePattern['mode'])}>
          <option value="exclude">제외</option>
          <option value="include">포함</option>
        </select>
        <input
          type="text"
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
        <label
          className="filter-pattern-bar__screen-only"
          title="켜면 이 패턴은 화면 표시에만 적용되고 Export 대상에는 영향을 주지 않습니다(검색 대용)"
        >
          <input
            type="checkbox"
            checked={screenOnly}
            onChange={(e) => setScreenOnly(e.target.checked)}
          />
          화면만
        </label>
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
      <div className="filter-pattern-bar__summary">
        <span className="filter-pattern-bar__badge" title={tooltipLines}>
          활성 {activePatterns.length}개
        </span>
        <button
          type="button"
          disabled={filePatterns.length === 0}
          title={filePatterns.length === 0 ? '등록된 패턴이 없습니다' : undefined}
          onClick={() => open('patterns')}
        >
          보기
        </button>
        {hiddenCount > 0 && <span className="status-text">· {hiddenCount}개 숨김</span>}
      </div>
    </div>
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
