const STORAGE_KEY = 'gde:lastUpdateCheck'

// REQ-017/DR-016 — 하루 1회로 제한하는 근거는 비인증 GitHub API의 시간당
// 60회 제한(사내 공유 IP 환경 고려, DETAILED_DESIGN.md §10.6).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface UpdateCheckCache {
  checkedAt: number
  hasUpdate: boolean
  latestVersion: string
}

// 컴포넌트 마운트 후 비동기로 채우면 첫 렌더링에 배지가 잠깐 "평시" 상태로
// 반짝인다 — 스토어 생성 시점에 이 함수로 동기 초기화한다(columnWidths.ts와
// 동일 패턴, RISK_ISSUES.md 결정 이력 #35).
export function loadUpdateCheckCache(): UpdateCheckCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { checkedAt, hasUpdate, latestVersion } = parsed as Record<string, unknown>
    if (
      typeof checkedAt !== 'number' ||
      typeof hasUpdate !== 'boolean' ||
      typeof latestVersion !== 'string'
    ) {
      return null
    }
    return { checkedAt, hasUpdate, latestVersion }
  } catch {
    return null
  }
}

export function saveUpdateCheckCache(cache: UpdateCheckCache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 저장 실패는 무시 — 다음 실행이 캐시 없이 다시 시작할 뿐, 기능에는 영향 없음
  }
}

export function isUpdateCheckCacheStale(cache: UpdateCheckCache | null): boolean {
  if (!cache) return true
  return Date.now() - cache.checkedAt > CACHE_TTL_MS
}
