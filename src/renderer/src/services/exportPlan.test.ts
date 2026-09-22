import { describe, expect, it } from 'vitest'
import { buildExportFiles } from './exportPlan'
import type { ExportableDeployFile } from './exportPlan'

// RT-33(S1) — exportSlice.ts의 runExport 안에 인라인이던 "Export 대상
// 파일 계산"(REQ-019/DR-018)을 뽑아온 순수 함수 검증.

function file(overrides: Partial<ExportableDeployFile>): ExportableDeployFile {
  return { localPath: 'a.txt', serverPath: 'a.txt', status: 'added', included: true, ...overrides }
}

describe('buildExportFiles', () => {
  it('included=false인 파일은 제외한다', () => {
    const result = buildExportFiles(
      [file({ localPath: 'a.txt' }), file({ localPath: 'b.txt', included: false })],
      []
    )
    expect(result.map((f) => f.localPath)).toEqual(['a.txt'])
  })

  it('included=true라도 활성 제외 패턴에 매치되면 제외한다', () => {
    const result = buildExportFiles(
      [file({ localPath: 'a.txt' }), file({ localPath: 'b.log' })],
      [{ pattern: '*.log', mode: 'exclude', enabled: true }]
    )
    expect(result.map((f) => f.localPath)).toEqual(['a.txt'])
  })

  it('비활성 제외 패턴은 적용하지 않는다', () => {
    const result = buildExportFiles(
      [file({ localPath: 'b.log' })],
      [{ pattern: '*.log', mode: 'exclude', enabled: false }]
    )
    expect(result.map((f) => f.localPath)).toEqual(['b.log'])
  })

  it('결과는 included/제외 여부와 무관한 필드(localPath/serverPath/status)만 남긴다', () => {
    const result = buildExportFiles(
      [file({ localPath: 'a.txt', serverPath: 'server/a.txt', status: 'modified' })],
      []
    )
    expect(result).toEqual([{ localPath: 'a.txt', serverPath: 'server/a.txt', status: 'modified' }])
  })
})
