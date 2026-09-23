import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateExportTarget, normalizeForCasePolicy } from './validateExportTarget'

// RT-56(U-16) §5.1 — "임시 폴더 통합 테스트": 실제 파일시스템 위에서
// fs.realpath 기반 겹침 판정 + direct 모드의 "비어 있음" 판정을 검증한다.

describe('validateExportTarget', () => {
  let repoDir: string

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'gde-validate-repo-'))
  })

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true })
  })

  it('경로를 선택하지 않으면 NO_PATH', async () => {
    const result = await validateExportTarget({ repoPath: repoDir, mode: 'sub' })
    expect(result).toEqual({ ok: false, code: 'NO_PATH', message: expect.any(String) })
  })

  it('저장소와 정확히 같으면(direct) INSIDE_REPO', async () => {
    const result = await validateExportTarget({
      repoPath: repoDir,
      exportParentDir: repoDir,
      mode: 'direct'
    })
    expect(result).toMatchObject({ ok: false, code: 'INSIDE_REPO' })
  })

  it('끝에 구분자가 붙어도(direct) INSIDE_REPO', async () => {
    const result = await validateExportTarget({
      repoPath: repoDir,
      exportParentDir: `${repoDir}/`,
      mode: 'direct'
    })
    expect(result).toMatchObject({ ok: false, code: 'INSIDE_REPO' })
  })

  it('.·..를 거쳐 저장소 자신을 가리켜도(direct) INSIDE_REPO', async () => {
    mkdirSync(join(repoDir, 'sub'))
    const roundabout = `${join(repoDir, 'sub')}/..`
    const result = await validateExportTarget({
      repoPath: repoDir,
      exportParentDir: roundabout,
      mode: 'direct'
    })
    expect(result).toMatchObject({ ok: false, code: 'INSIDE_REPO' })
  })

  it('심볼릭 링크를 거쳐 저장소를 가리켜도 INSIDE_REPO', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'gde-validate-outside-'))
    try {
      const linkPath = join(outside, 'repo-link')
      symlinkSync(repoDir, linkPath, 'dir')
      const result = await validateExportTarget({
        repoPath: repoDir,
        exportParentDir: linkPath,
        mode: 'direct'
      })
      expect(result).toMatchObject({ ok: false, code: 'INSIDE_REPO' })
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('저장소 하위 폴더(sub 모드: 선택 경로가 저장소 → <저장소>/git-deploy-extracted)면 INSIDE_REPO', async () => {
    const result = await validateExportTarget({
      repoPath: repoDir,
      exportParentDir: repoDir,
      mode: 'sub'
    })
    expect(result).toMatchObject({ ok: false, code: 'INSIDE_REPO' })
  })

  it('저장소의 깊은 하위 폴더(direct)면 INSIDE_REPO', async () => {
    const nested = join(repoDir, 'a', 'b')
    mkdirSync(nested, { recursive: true })
    const result = await validateExportTarget({
      repoPath: repoDir,
      exportParentDir: nested,
      mode: 'direct'
    })
    expect(result).toMatchObject({ ok: false, code: 'INSIDE_REPO' })
  })

  it('선택 경로 아래 sub 폴더가 저장소를 포함하면(sub) CONTAINS_REPO — 저장소 파일은 지워지지 않는다', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'gde-validate-parent-'))
    try {
      // repoDir을 <parent>/git-deploy-extracted/proj로 만든다(F가 R을 포함).
      const containerRepo = join(parent, 'git-deploy-extracted', 'proj')
      mkdirSync(containerRepo, { recursive: true })
      writeFileSync(join(containerRepo, 'marker.txt'), 'do-not-delete')

      const result = await validateExportTarget({
        repoPath: containerRepo,
        exportParentDir: parent,
        mode: 'sub'
      })
      expect(result).toMatchObject({ ok: false, code: 'CONTAINS_REPO' })
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('저장소의 형제 폴더는 통과(OK)', async () => {
    const sibling = mkdtempSync(join(tmpdir(), 'gde-validate-sibling-'))
    try {
      const result = await validateExportTarget({
        repoPath: repoDir,
        exportParentDir: sibling,
        mode: 'direct'
      })
      expect(result).toEqual({ ok: true })
    } finally {
      rmSync(sibling, { recursive: true, force: true })
    }
  })

  it('접두사만 같은 형제(<저장소>-old)는 통과(startsWith 오판 방지)', async () => {
    const prefixSibling = `${repoDir}-old`
    mkdirSync(prefixSibling)
    try {
      const result = await validateExportTarget({
        repoPath: repoDir,
        exportParentDir: prefixSibling,
        mode: 'direct'
      })
      expect(result).toEqual({ ok: true })
    } finally {
      rmSync(prefixSibling, { recursive: true, force: true })
    }
  })

  it('sub 모드는 저장소를 포함하지 않는 상위 폴더를 통과시킨다(F=상위/git-deploy-extracted, 형제)', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'gde-validate-uncle-'))
    try {
      const nestedRepo = join(parent, 'proj')
      mkdirSync(nestedRepo)
      const result = await validateExportTarget({
        repoPath: nestedRepo,
        exportParentDir: parent,
        mode: 'sub'
      })
      expect(result).toEqual({ ok: true })
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  describe('direct 모드 — 비어 있음 검사(a안)', () => {
    it('빈 폴더면 통과(OK)', async () => {
      const target = mkdtempSync(join(tmpdir(), 'gde-validate-empty-'))
      try {
        const result = await validateExportTarget({
          repoPath: repoDir,
          exportParentDir: target,
          mode: 'direct'
        })
        expect(result).toEqual({ ok: true })
      } finally {
        rmSync(target, { recursive: true, force: true })
      }
    })

    it('비어 있지 않으면 NOT_EMPTY로 거부한다', async () => {
      const target = mkdtempSync(join(tmpdir(), 'gde-validate-nonempty-'))
      try {
        writeFileSync(join(target, 'existing.txt'), 'hello')
        const result = await validateExportTarget({
          repoPath: repoDir,
          exportParentDir: target,
          mode: 'direct'
        })
        expect(result).toMatchObject({ ok: false, code: 'NOT_EMPTY' })
      } finally {
        rmSync(target, { recursive: true, force: true })
      }
    })

    it('아직 존재하지 않는 경로는 direct에서도 통과(첫 Export)', async () => {
      const parent = mkdtempSync(join(tmpdir(), 'gde-validate-newparent-'))
      try {
        const notYetCreated = join(parent, 'brand-new')
        const result = await validateExportTarget({
          repoPath: repoDir,
          exportParentDir: notYetCreated,
          mode: 'direct'
        })
        expect(result).toEqual({ ok: true })
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
    })
  })

  describe('sub 모드 — 비어 있지 않아도 비어 있음 검사를 하지 않는다', () => {
    it('sub 모드는 NOT_EMPTY를 절대 반환하지 않는다(덮어쓰기 확인은 IPC 핸들러 몫)', async () => {
      const parent = mkdtempSync(join(tmpdir(), 'gde-validate-sub-nonempty-'))
      try {
        mkdirSync(join(parent, 'git-deploy-extracted'))
        writeFileSync(join(parent, 'git-deploy-extracted', 'old.txt'), 'stale')
        const result = await validateExportTarget({
          repoPath: repoDir,
          exportParentDir: parent,
          mode: 'sub'
        })
        expect(result).toEqual({ ok: true })
      } finally {
        rmSync(parent, { recursive: true, force: true })
      }
    })
  })
})

describe('normalizeForCasePolicy', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('Windows에서는 대소문자를 무시한다(소문자로 접는다)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(normalizeForCasePolicy('D:\\Work\\Proj')).toBe('d:\\work\\proj')
  })

  it('macOS에서도 대소문자를 무시한다', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    expect(normalizeForCasePolicy('/Work/Proj')).toBe('/work/proj')
  })

  it('Linux에서는 대소문자를 그대로 구분한다', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    expect(normalizeForCasePolicy('/Work/Proj')).toBe('/Work/Proj')
  })
})
