// RT-13(U3) — MaxCountField가 blur/Enter에서 커밋할 때 쓰는 순수 파싱
// 함수. 비었거나 1 미만이거나 숫자가 아니면 null(호출부가 이전 값으로
// 되돌린다). 소수점은 정수부만 취한다(최대 "개수"라 의미가 없음).
export function parseMaxCountInput(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.trunc(parsed)
}
