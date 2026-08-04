export interface MappingOverride {
  from: string // 정확한 Local Path (저장소 루트 기준 상대경로, 와일드카드 없음)
  to: string // 정확한 Server Path
  description?: string
}

export interface MappingProfile {
  profileName: string
  version: string
  overrides: MappingOverride[]
}
