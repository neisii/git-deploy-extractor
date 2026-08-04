import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { MappingProfile } from './types'
import { validateMappingProfile } from './resolveServerPath'

const JSON_EXT = '.json'

export async function listProfileNames(profilesDir: string): Promise<string[]> {
  await fs.mkdir(profilesDir, { recursive: true })
  const entries = await fs.readdir(profilesDir)
  return entries
    .filter((name) => name.endsWith(JSON_EXT))
    .map((name) => name.slice(0, -JSON_EXT.length))
}

export async function loadProfile(
  profilesDir: string,
  profileName: string
): Promise<MappingProfile> {
  const filePath = join(profilesDir, `${profileName}${JSON_EXT}`)
  const raw = await fs.readFile(filePath, 'utf8')
  const profile = JSON.parse(raw) as MappingProfile
  validateMappingProfile(profile)
  return profile
}

// 앱 최초 실행 시 profiles/ 디렉터리가 비어 있으면 identity mapping뿐인
// default.json을 생성한다 (DETAILED_DESIGN.md §1.3). Main Process 시작 시
// 1회 호출하는 것을 전제로 한다.
export async function seedDefaultProfileIfEmpty(profilesDir: string): Promise<void> {
  await fs.mkdir(profilesDir, { recursive: true })
  const existing = await fs.readdir(profilesDir)
  if (existing.length > 0) return

  const defaultProfile: MappingProfile = { profileName: 'default', version: '1.0', overrides: [] }
  await fs.writeFile(
    join(profilesDir, `default${JSON_EXT}`),
    JSON.stringify(defaultProfile, null, 2) + '\n',
    'utf8'
  )
}
