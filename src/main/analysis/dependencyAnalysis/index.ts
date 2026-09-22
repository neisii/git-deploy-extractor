import { getHeadFileContent } from '../../git/showFile'
import { resolveServerPath } from '../../mapping/resolveServerPath'
import { parseJavaFile } from '../java/parseJavaFile'
import type { JavaTypeKind } from '../java/parseJavaFile'
import type {
  AnalysisWarning,
  DependencyAnalysisResult,
  DependencyCandidate,
  MappingProfile
} from '../../../shared/types'
import { JAVA_SUFFIX, pathToFqn, detectBasePackage, buildProjectIndex } from './projectIndex'
import { resolveToPath } from './resolve'
import { findImplementors, isConfirmedImplementor } from './implementations'

// RISK_ISSUES.md §7.2 — Java/Spring 단일 모듈 의존성 완결성 검사.
//
// 알고리즘 개요 (설계 근거는 DETAILED_DESIGN.md §4.4 참고, RT-22로 아래
// 네 파일에 분할됨):
// 1. `@SpringBootApplication` 클래스를 저장소 전체에서 찾아 base package를
//    감지한다(하드코딩 금지 — §7.2 point 4). 못 찾으면 기능을 비활성화한다.
// 2. base package 경로 아래 .java 파일 목록으로 "경로 ↔ FQN" 인덱스를
//    구성한다(파일 내용을 읽지 않고 경로에서 바로 유도 — Spring 표준 구조
//    전제는 이 프로젝트 전체가 이미 하고 있는 가정과 같다). (1·2 =
//    `./projectIndex`)
// 3. 포함된 파일들에서 시작해 BFS로 전이적 폐쇄까지 따라간다(point 5).
//    각 파일을 파싱해 import/implements/extends/필드·생성자 파라미터
//    타입에서 참조를 뽑고, 우리 프로젝트 내부로 해석되는 것만 엣지로
//    삼는다(참조 해석 자체는 `./resolve`, BFS 루프는 이 파일).
// 4. 필드/생성자 파라미터로 참조된 타입이 실제로 인터페이스로 확인되면,
//    `git grep`으로 그 이름을 텍스트로 언급하는 파일을 먼저 좁히고(빠른
//    사전 필터), 파싱으로 실제 `implements` + stereotype 애노테이션 여부를
//    확인해 구현체 후보를 전부 수집한다(point 6, 모호하면 전부 제안,
//    `./implementations`).

export async function analyzeDependencies(
  repoPath: string,
  branch: string,
  includedLocalPaths: string[],
  profile: MappingProfile
): Promise<DependencyAnalysisResult> {
  const javaIncluded = includedLocalPaths.filter((p) => p.endsWith(JAVA_SUFFIX))
  if (javaIncluded.length === 0) {
    return {
      applicable: false,
      reason: '포함된 파일 중 Java 파일이 없습니다',
      missingDependencies: [],
      parseWarnings: []
    }
  }

  const base = await detectBasePackage(repoPath, branch)
  if (!base) {
    return {
      applicable: false,
      reason: '@SpringBootApplication 클래스를 찾지 못해 의존성 검사를 사용할 수 없습니다',
      missingDependencies: [],
      parseWarnings: []
    }
  }

  const index = await buildProjectIndex(repoPath, branch, base.basePackage, base.sourceRoot)
  const includedSet = new Set(includedLocalPaths)

  const visited = new Set<string>()
  const queued = new Set<string>()
  const queue: string[] = []
  const discoveredKind = new Map<string, JavaTypeKind>() // 포함되지 않은(missing) 경로만
  const pendingInterfaceCheck = new Set<string>()
  const implementorCache = new Map<string, string[]>()
  const parseWarnings: AnalysisWarning[] = []

  function enqueue(path: string): void {
    if (visited.has(path) || queued.has(path)) return
    queued.add(path)
    queue.push(path)
  }

  function addEdge(path: string): void {
    if (!index.fqnToPath.has(pathToFqn(path, base!.sourceRoot))) return
    if (!includedSet.has(path) && !discoveredKind.has(path)) {
      discoveredKind.set(path, 'class') // 방문 전 잠정값 — 실제 방문 시 확정
    }
    enqueue(path)
  }

  for (const path of javaIncluded) enqueue(path)

  while (queue.length > 0) {
    const path = queue.shift()!
    queued.delete(path)
    if (visited.has(path)) continue
    visited.add(path)

    let content: Buffer
    try {
      content = await getHeadFileContent(repoPath, branch, path)
    } catch {
      parseWarnings.push({ path, reason: 'HEAD 파일 조회 실패 — 의존성 검사에서 제외' })
      continue
    }

    let parsed
    try {
      parsed = parseJavaFile(content.toString('utf8'))
    } catch {
      parseWarnings.push({ path, reason: 'Java 파싱 실패 — 의존성 검사에서 제외' })
      continue
    }

    const currentPackage = parsed.packageName ?? ''
    const importedSimpleNameToFqn = new Map<string, string>()
    for (const imp of parsed.imports) {
      if (!imp.isWildcard) importedSimpleNameToFqn.set(imp.simpleName, imp.fqn)
    }
    const resolve = (name: string): string | undefined =>
      resolveToPath(name, currentPackage, importedSimpleNameToFqn, index)

    // import 기반 텍스트 참조
    for (const imp of parsed.imports) {
      if (imp.isWildcard) continue
      const p = index.fqnToPath.get(imp.fqn)
      if (p && p !== path) addEdge(p)
    }

    for (const type of parsed.types) {
      for (const name of type.structuralReferenceNames) {
        const p = resolve(name)
        if (p && p !== path) addEdge(p)
      }
      for (const name of type.fieldAndParamTypeNames) {
        const p = resolve(name)
        if (!p || p === path) continue
        addEdge(p)
        pendingInterfaceCheck.add(p)
      }
    }

    // 이 파일이 "필드/파라미터로 참조된" 대상이었다면, 실제로 인터페이스인지
    // 이제 확인할 수 있다 — 맞으면 구현체 후보를 찾아 엣지에 더한다.
    if (pendingInterfaceCheck.has(path)) {
      const iface = parsed.types.find((t) => t.kind === 'interface')
      if (iface) {
        const candidatePaths = await findImplementors(
          repoPath,
          branch,
          index,
          implementorCache,
          iface.simpleName
        )
        for (const candidatePath of candidatePaths) {
          if (candidatePath === path) continue
          addEdge(candidatePath)
        }
      }
    }

    if (discoveredKind.has(path) && parsed.types.length > 0) {
      const matched =
        parsed.types.find(
          (t) => t.simpleName === path.slice(path.lastIndexOf('/') + 1, -JAVA_SUFFIX.length)
        ) ?? parsed.types[0]
      discoveredKind.set(path, matched.kind)
    }
  }

  // pendingInterfaceCheck 대상 중 "이미 방문된" 파일도 있었을 케이스를 대비해
  // implements 여부를 최종적으로 한 번 더 필터링한다 — 구현체 후보로
  // enqueue된 경로 중 실제로 그 인터페이스를 implements하고 stereotype
  // 애노테이션이 붙은 것만 최종 missingDependencies에 남긴다(isConfirmedImplementor,
  // `./implementations`). 이 판정은 이미 parsed 결과가 없으므로(방문 루프
  // 안에서 로컬 변수였음), 다시 한 번 읽어야 한다 — implementorCache로
  // 좁혀진 소수 후보에 대해서만 수행되므로 비용이 크지 않다.
  const finalMissing: DependencyCandidate[] = []
  for (const [path, kind] of discoveredKind) {
    if (kind === 'class') {
      const keep = await isConfirmedImplementor(repoPath, branch, path, implementorCache)
      if (!keep) continue
    }
    finalMissing.push({
      localPath: path,
      serverPath: resolveServerPath(path, profile),
      status: 'added',
      kind
    })
  }

  finalMissing.sort((a, b) => a.localPath.localeCompare(b.localPath))

  return {
    applicable: true,
    basePackage: base.basePackage,
    missingDependencies: finalMissing,
    parseWarnings
  }
}
