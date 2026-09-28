import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadFilePatterns, saveFilePatterns } from './patternStore'
import type { FilePattern } from '../../shared/types'

describe('patternStore', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gde-patterns-'))
    filePath = join(dir, 'patterns.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('파일이 아직 없으면 빈 배열을 반환한다', async () => {
    expect(await loadFilePatterns(filePath)).toEqual([])
  })

  it('저장한 내용을 그대로 다시 읽는다(round trip)', async () => {
    const patterns: FilePattern[] = [
      { pattern: '*.png', mode: 'exclude', enabled: true },
      { pattern: 'com.acme.legacy.**', mode: 'include', enabled: false }
    ]
    await saveFilePatterns(filePath, patterns)
    expect(await loadFilePatterns(filePath)).toEqual(patterns)
  })

  it('손상된 JSON은 빈 배열로 안전하게 폴백한다', async () => {
    writeFileSync(filePath, '{ not valid json', 'utf8')
    expect(await loadFilePatterns(filePath)).toEqual([])
  })

  it('배열이 아닌 JSON(예: 객체)도 빈 배열로 폴백한다', async () => {
    writeFileSync(filePath, JSON.stringify({ pattern: '*.png' }), 'utf8')
    expect(await loadFilePatterns(filePath)).toEqual([])
  })

  it('형태가 안 맞는 항목은 걸러내고 유효한 것만 남긴다', async () => {
    writeFileSync(
      filePath,
      JSON.stringify([
        { pattern: '*.png', mode: 'exclude', enabled: true },
        { pattern: '*.md' }, // enabled/mode 없음
        { pattern: 42, mode: 'exclude', enabled: true }, // pattern이 문자열 아님
        { pattern: '*.yml', mode: 'weird', enabled: true } // mode가 유효하지 않음
      ]),
      'utf8'
    )
    expect(await loadFilePatterns(filePath)).toEqual([
      { pattern: '*.png', mode: 'exclude', enabled: true }
    ])
  })

  it('UTF-8·마지막 개행 포함으로 저장한다', async () => {
    await saveFilePatterns(filePath, [])
    const { readFileSync } = await import('node:fs')
    const raw = readFileSync(filePath, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toBe('[]\n')
  })
})
