import { describe, expect, it } from 'vitest'
import { parseMaxCountInput } from './maxCount'

describe('parseMaxCountInput', () => {
  it('빈 문자열은 null', () => {
    expect(parseMaxCountInput('')).toBeNull()
  })

  it('공백만 있으면 null', () => {
    expect(parseMaxCountInput('   ')).toBeNull()
  })

  it('0은 null(1 미만 거부)', () => {
    expect(parseMaxCountInput('0')).toBeNull()
  })

  it('음수는 null', () => {
    expect(parseMaxCountInput('-3')).toBeNull()
  })

  it('숫자가 아니면 null', () => {
    expect(parseMaxCountInput('abc')).toBeNull()
  })

  it('Infinity는 null(유한하지 않음)', () => {
    expect(parseMaxCountInput('Infinity')).toBeNull()
  })

  it('앞뒤 공백은 제거하고 파싱', () => {
    expect(parseMaxCountInput(' 7 ')).toBe(7)
  })

  it('정상 정수는 그대로', () => {
    expect(parseMaxCountInput('5')).toBe(5)
  })

  it('소수는 정수부만 취한다', () => {
    expect(parseMaxCountInput('3.9')).toBe(3)
  })
})
