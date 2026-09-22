import { grepTree } from '../../git/grep'
import { getHeadFileContent } from '../../git/showFile'
import { parseJavaFile } from '../java/parseJavaFile'
import type { ProjectIndex } from './projectIndex'

// DETAILED_DESIGN.md §6.5(구현체 탐색) — 필드/생성자 파라미터로 참조된
// 타입이 실제로 인터페이스로 확인되면, `git grep`으로 그 이름을 텍스트로
// 언급하는 파일을 먼저 좁히고(findImplementors, 빠른 사전 필터), 파싱으로
// 실제 `implements` + stereotype 애노테이션 여부를 확인해(isConfirmedImplementor,
// 최종 필터) 구현체 후보를 확정한다(모호하면 전부 제안 — 하나로 확정하지
// 않는다).

export const STEREOTYPE_ANNOTATIONS = new Set([
  'Component',
  'Service',
  'Repository',
  'Controller',
  'RestController',
  'Configuration'
])

// 인터페이스 단순 이름으로 그 이름을 텍스트로 언급하는 파일 후보를 찾는다
// (사전 필터 — 주석·무관한 문자열 매치가 섞여 들어올 수 있음, 최종 확정은
// isConfirmedImplementor가 한다). 같은 인터페이스가 BFS 도중 여러 번
// 재발견돼도 중복 grep하지 않도록 cache에 캐싱한다(호출자가 BFS 한 번의
// 수명 동안 같은 Map을 넘겨야 한다).
export async function findImplementors(
  repoPath: string,
  branch: string,
  index: ProjectIndex,
  cache: Map<string, string[]>,
  interfaceSimpleName: string
): Promise<string[]> {
  const cached = cache.get(interfaceSimpleName)
  if (cached) return cached
  const candidates = await grepTree(repoPath, branch, interfaceSimpleName, [
    index.basePackagePathPrefix
  ])
  cache.set(interfaceSimpleName, candidates)
  return candidates
}

// findImplementors로 좁혀진 후보 중 실제로 구현체로 확정할지 판정한다.
// findImplementors 후보가 아니었던 경로(직접 참조로 발견된 파일 등)는
// 검사할 대상이 아니므로 항상 true(그대로 유지). 후보였던 경로는
// 다시 읽어 파싱해서 그 인터페이스를 실제로 implements하고 stereotype
// 애노테이션이 붙어 있어야만 true — 어느 한쪽이라도 아니면 false(제외).
export async function isConfirmedImplementor(
  repoPath: string,
  branch: string,
  path: string,
  implementorCache: Map<string, string[]>
): Promise<boolean> {
  const isImplementorCandidate = [...implementorCache.values()].some((list) => list.includes(path))
  if (!isImplementorCandidate) return true

  let content: Buffer
  try {
    content = await getHeadFileContent(repoPath, branch, path)
  } catch {
    return false
  }
  let parsed
  try {
    parsed = parseJavaFile(content.toString('utf8'))
  } catch {
    return false
  }
  const classType = parsed.types.find((t) => t.kind === 'class')
  const hasStereotype = classType?.annotationSimpleNames.some((a) => STEREOTYPE_ANNOTATIONS.has(a))
  const implementsTarget = [...implementorCache.entries()].some(
    ([ifaceName, list]) =>
      list.includes(path) && classType?.implementsSimpleNames.includes(ifaceName)
  )
  return Boolean(hasStereotype && implementsTarget)
}
