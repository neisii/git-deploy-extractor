import { app } from 'electron'
import type { CheckUpdateResult } from '../../shared/types'

// REQ-017/DR-016. 이 저장소는 항상 vX.Y.Z 형식만 태깅한다(pre-release
// 접미사·빌드 메타데이터 없음) — 로컬/원격 버전 둘 다 같은 정규식으로
// 검증한다(DETAILED_DESIGN.md §10.2). 형식이 안 맞으면 조용히 실패로
// 처리하고 크래시하지 않는다.
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/
const RELEASES_LATEST_URL =
  'https://api.github.com/repos/neisii/git-deploy-extractor/releases/latest'
const TIMEOUT_MS = 5000

function parseVersion(raw: string): [number, number, number] | null {
  const match = VERSION_PATTERN.exec(raw)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

// "다르다"가 아니라 "a가 b보다 엄격히 크다" — 로컬이 원격보다 같거나
// 앞선 경우(버전은 올렸지만 아직 태그/릴리스 전인 상태 등)를 업데이트로
// 오탐하지 않기 위함(RISK_ISSUES.md 결정 이력 #35).
function isGreater(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

export async function checkForUpdate(): Promise<CheckUpdateResult> {
  const currentVersion = parseVersion(app.getVersion())
  if (!currentVersion) return { ok: false }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(RELEASES_LATEST_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return { ok: false }

    const body: unknown = await response.json()
    const tagName =
      typeof body === 'object' && body !== null && 'tag_name' in body
        ? (body as { tag_name: unknown }).tag_name
        : null
    if (typeof tagName !== 'string') return { ok: false }

    const latestVersion = parseVersion(tagName)
    if (!latestVersion) return { ok: false }

    return {
      ok: true,
      hasUpdate: isGreater(latestVersion, currentVersion),
      latestVersion: latestVersion.join('.')
    }
  } catch {
    // 오프라인/타임아웃/DNS 실패 등 — REQ-010과 공존해야 하므로 예외를
    // 던지지 않고 실패를 정상 경로로 반환한다.
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}
