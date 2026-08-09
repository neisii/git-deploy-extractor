const fs = require('fs')
const path = require('path')

// 이 앱은 한국어 전용 사내 도구라 Chromium이 기본 번들하는 220개 언어
// 로케일 리소스가 전부 불필요하다 — 실측(v0.2.1 mac 빌드) 기준 로케일만
// 45MB(전체 261MB 중 17%)를 차지해 가장 큰 단일 절감 지점이었다.
// en은 로케일 매칭 실패 시 Chromium의 표준 폴백 언어라 함께 남긴다.
const KEEP_PREFIXES = ['en', 'ko']

function shouldKeep(localeName) {
  const lower = localeName.toLowerCase()
  return KEEP_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function pruneDir(dir, matchExt, toLocaleName) {
  if (!fs.existsSync(dir)) return 0
  let removed = 0
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(matchExt)) continue
    if (shouldKeep(toLocaleName(entry))) continue
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
    removed++
  }
  return removed
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context

  if (electronPlatformName === 'darwin') {
    const appBundle = fs.readdirSync(appOutDir).find((f) => f.endsWith('.app'))
    if (!appBundle) return
    const resourcesDir = path.join(
      appOutDir,
      appBundle,
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Versions',
      'A',
      'Resources'
    )
    const removed = pruneDir(resourcesDir, '.lproj', (entry) => entry.replace(/\.lproj$/, ''))
    console.log(
      `[afterPack] mac: removed ${removed} unused .lproj locale folders (kept ${KEEP_PREFIXES.join('/')})`
    )
  } else if (electronPlatformName === 'win32') {
    const localesDir = path.join(appOutDir, 'locales')
    const removed = pruneDir(localesDir, '.pak', (entry) => entry.replace(/\.pak$/, ''))
    console.log(
      `[afterPack] win: removed ${removed} unused .pak locale files (kept ${KEEP_PREFIXES.join('/')})`
    )
  }
}
