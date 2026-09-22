import type { MappingProfile } from '../../shared/types'

// Spring 표준 구조 접두사 (DR-011, DR-012) — 사용자 설정이 아니라 하드 규칙이며,
// 이 접두사에 해당하면 Mapping Profile을 아예 조회하지 않는다.
const JAVA_PREFIX = 'src/main/java/'
const RESOURCES_PREFIX = 'src/main/resources/'

export function resolveServerPath(localPath: string, profile: MappingProfile): string {
  if (localPath.startsWith(JAVA_PREFIX)) return localPath
  if (localPath.startsWith(RESOURCES_PREFIX)) return localPath

  const override = profile.overrides.find((o) => o.from === localPath)
  return override ? override.to : localPath
}

export function validateMappingProfile(profile: MappingProfile): void {
  const seen = new Set<string>()
  for (const override of profile.overrides) {
    if (seen.has(override.from)) {
      throw new Error(`Mapping Profile에 중복된 from 경로가 있습니다: ${override.from}`)
    }
    seen.add(override.from)
  }
}
