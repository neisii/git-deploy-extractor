import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listProfileNames, loadProfile, seedDefaultProfileIfEmpty } from './profileStore'

// scripts/verify-phase2.ts 케이스 6의 이식 — Profile 저장소(§1.3).

describe('profileStore', () => {
  let profilesDir: string

  beforeEach(() => {
    profilesDir = mkdtempSync(join(tmpdir(), 'gde-profiles-'))
  })

  afterEach(() => {
    rmSync(profilesDir, { recursive: true, force: true })
  })

  it('빈 디렉터리는 프로필 목록도 비어 있다', async () => {
    expect(await listProfileNames(profilesDir)).toEqual([])
  })

  it('seedDefaultProfileIfEmpty는 default 프로필을 만든다', async () => {
    await seedDefaultProfileIfEmpty(profilesDir)
    expect(await listProfileNames(profilesDir)).toEqual(['default'])

    const loaded = await loadProfile(profilesDir, 'default')
    expect(loaded.profileName).toBe('default')
    expect(loaded.overrides).toEqual([])
  })

  it('이미 파일이 있으면 재시드하지 않는다(덮어쓰지 않음)', async () => {
    await seedDefaultProfileIfEmpty(profilesDir)
    const raw = readFileSync(join(profilesDir, 'default.json'), 'utf8')

    await seedDefaultProfileIfEmpty(profilesDir)
    const rawAfter = readFileSync(join(profilesDir, 'default.json'), 'utf8')
    expect(rawAfter).toBe(raw)
  })
})
