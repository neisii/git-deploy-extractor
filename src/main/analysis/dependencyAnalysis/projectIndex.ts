import { listTrackedFiles } from '../../git/lsTree'
import { grepTree } from '../../git/grep'
import { getHeadFileContent } from '../../git/showFile'
import { parseJavaFile } from '../java/parseJavaFile'

// DETAILED_DESIGN.md §6.2(Base Package 감지)·§6.3(프로젝트 인덱스) —
// `@SpringBootApplication` 클래스를 찾아 기준 패키지를 감지하고, 그 아래
// `.java` 파일 목록으로 "경로 ↔ FQN" 인덱스를 구성한다. 파일 내용을 읽지
// 않고 경로에서 바로 FQN을 유도한다(Spring 표준 구조 전제 — 이 프로젝트
// 전체가 이미 하고 있는 가정과 같다).

export const JAVA_SUFFIX = '.java'

export interface ProjectIndex {
  sourceRoot: string
  basePackagePathPrefix: string
  fqnToPath: Map<string, string>
  simpleNameToFqns: Map<string, string[]>
}

export function pathToFqn(path: string, sourceRoot: string): string {
  const rel = path.slice(sourceRoot.length + 1, -JAVA_SUFFIX.length)
  return rel.split('/').join('.')
}

export async function detectBasePackage(
  repoPath: string,
  branch: string
): Promise<{ basePackage: string; sourceRoot: string } | null> {
  const candidates = await grepTree(repoPath, branch, '@SpringBootApplication', ['*.java'])

  const confirmed: { basePackage: string; sourceRoot: string }[] = []
  for (const path of candidates) {
    let content: Buffer
    try {
      content = await getHeadFileContent(repoPath, branch, path)
    } catch {
      continue
    }
    let parsed
    try {
      parsed = parseJavaFile(content.toString('utf8'))
    } catch {
      continue
    }
    const hasAnnotation = parsed.types.some(
      (t) => t.kind === 'class' && t.annotationSimpleNames.includes('SpringBootApplication')
    )
    if (!hasAnnotation || !parsed.packageName) continue

    const packageSegments = parsed.packageName.split('.')
    const pathSegments = path.split('/')
    const trailingCount = packageSegments.length + 1 // + 파일명 자체
    if (pathSegments.length <= trailingCount) continue
    const sourceRoot = pathSegments.slice(0, pathSegments.length - trailingCount).join('/')
    confirmed.push({ basePackage: parsed.packageName, sourceRoot })
  }

  // 못 찾거나(0건) 모호하면(2건 이상) 폴백 없이 비활성화한다(§7.2 point 4).
  if (confirmed.length !== 1) return null
  return confirmed[0]
}

export async function buildProjectIndex(
  repoPath: string,
  branch: string,
  basePackage: string,
  sourceRoot: string
): Promise<ProjectIndex> {
  const basePackagePathPrefix = `${sourceRoot}/${basePackage.replace(/\./g, '/')}`
  const paths = (await listTrackedFiles(repoPath, branch, basePackagePathPrefix)).filter((p) =>
    p.endsWith(JAVA_SUFFIX)
  )

  const fqnToPath = new Map<string, string>()
  const simpleNameToFqns = new Map<string, string[]>()
  for (const path of paths) {
    const fqn = pathToFqn(path, sourceRoot)
    fqnToPath.set(fqn, path)
    const simpleName = fqn.slice(fqn.lastIndexOf('.') + 1)
    const list = simpleNameToFqns.get(simpleName) ?? []
    list.push(fqn)
    simpleNameToFqns.set(simpleName, list)
  }

  return { sourceRoot, basePackagePathPrefix, fqnToPath, simpleNameToFqns }
}
