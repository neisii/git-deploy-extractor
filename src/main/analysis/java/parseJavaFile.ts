import { parse } from 'java-parser'

// RISK_ISSUES.md §7.2 — Java 소스 한 파일을 파싱해서 의존성 완결성 검사에
// 필요한 최소한의 구조만 뽑아낸다. java-parser(chevrotain 기반)가 내보내는
// CST 타입은 규칙마다 `children`이 서로 다른 정확한 타입으로 좁혀져 있어
// (수백 개 규칙 각각 별도 타입) 이름/children 기반의 범용 재귀 순회와는
// 근본적으로 맞지 않는다 — 순회 함수 하나가 모든 규칙에 다 적용돼야 하는데
// TS는 그런 범용 함수를 이 정밀 유니온 타입으로 표현하지 못한다. 그래서
// 이 파일 내부에서만 쓰는 느슨한 구조 타입(AnyCstNode/AnyCstElement)을 따로
// 정의하고, `parse()` 반환값을 여기로 한 번만 캐스팅한다 — 파일 경계
// 밖으로 나가는 공개 타입(ParsedJavaFile 등)은 그대로 정확하게 유지한다.

interface AnyToken {
  image: string
  tokenType?: { name: string }
}

interface AnyCstNode {
  name: string
  children: Record<string, AnyCstElement[]>
}

type AnyCstElement = AnyCstNode | AnyToken

export interface JavaImport {
  simpleName: string // 마지막 식별자(정적 멤버 import는 멤버명, 일반은 클래스명)
  fqn: string // 전체 dotted 경로(마지막 세그먼트 포함)
  isStatic: boolean
  isWildcard: boolean
}

export type JavaTypeKind = 'class' | 'interface'

export interface JavaTypeInfo {
  kind: JavaTypeKind
  simpleName: string
  annotationSimpleNames: string[]
  // classImplements만 — "누가 이 인터페이스를 implements하는가" 확인용
  implementsSimpleNames: string[]
  // implements + extends(class/interface 모두) 식별자를 합친 것 — 이 타입이
  // 텍스트로 참조하는 타입 엣지용. 제네릭 타입 인자도 식별자로 같이 섞여
  // 들어올 수 있지만 과수집은 허용된다(§7.2 point 7, False Positive 허용).
  structuralReferenceNames: string[]
  // 필드/생성자 파라미터 타입에서 수집한 식별자 — Spring DI 후보 엣지용.
  // List<Foo> 같은 제네릭도 타입 인자 식별자까지 그대로 수집한다(점 3,
  // False Negative 방지 우선 — 컬렉션 주입 패턴을 놓치지 않기 위함).
  fieldAndParamTypeNames: string[]
}

export interface ParsedJavaFile {
  packageName: string | null
  imports: JavaImport[]
  types: JavaTypeInfo[]
}

function isNode(el: AnyCstElement): el is AnyCstNode {
  return 'children' in el
}

function child(node: AnyCstNode, key: string): AnyCstElement | undefined {
  return node.children[key]?.[0]
}

function childNode(node: AnyCstNode, key: string): AnyCstNode | undefined {
  const el = child(node, key)
  return el && isNode(el) ? el : undefined
}

// 특정 rule 이름을 가진 모든 하위 노드를 재귀적으로 찾는다(깊이 제한 없음,
// 중첩 타입 선언 경계를 구분하지 않는다 — 안쪽 클래스의 필드가 바깥
// 클래스 것으로도 같이 잡히는 정도의 과수집은 허용된다).
function findAll(node: AnyCstNode, ruleName: string, acc: AnyCstNode[] = []): AnyCstNode[] {
  for (const arr of Object.values(node.children)) {
    for (const el of arr) {
      if (!isNode(el)) continue
      if (el.name === ruleName) acc.push(el)
      findAll(el, ruleName, acc)
    }
  }
  return acc
}

// 노드 하위의 모든 Identifier 토큰 이미지를 순서 없이 수집한다. 점으로
// 이어진 qualified 이름이나 제네릭 타입 인자를 구조적으로 구분하지 않고
// 전부 평평하게 모은다 — 해석(resolve) 단계에서 각 이름을 독립적인
// "내부 클래스 후보"로 시도하는 단순한 전략을 쓰기 때문에 이 정도로 충분하다.
function collectIdentifiers(node: AnyCstNode, acc: string[] = []): string[] {
  for (const arr of Object.values(node.children)) {
    for (const el of arr) {
      if (isNode(el)) {
        collectIdentifiers(el, acc)
      } else if (el.tokenType?.name === 'Identifier') {
        acc.push(el.image)
      }
    }
  }
  return acc
}

// packageDeclaration/packageOrTypeName/typeIdentifier처럼
// `Identifier (Dot Identifier)*` 형태로 평평하게 나열되는 노드는
// children.Identifier 배열이 이미 소스 순서대로 채워져 있다 — 직접
// 이어붙이면 dotted name이 된다.
function joinFlatIdentifiers(node: AnyCstNode): string[] {
  const tokens = node.children.Identifier ?? []
  return tokens.filter((el): el is AnyToken => !isNode(el)).map((t) => t.image)
}

function extractPackageName(compilationUnit: AnyCstNode): string | null {
  const ordinary = childNode(compilationUnit, 'ordinaryCompilationUnit')
  const pkgDecl = ordinary && childNode(ordinary, 'packageDeclaration')
  if (!pkgDecl) return null
  const segments = joinFlatIdentifiers(pkgDecl)
  return segments.length > 0 ? segments.join('.') : null
}

function extractImports(compilationUnit: AnyCstNode): JavaImport[] {
  const ordinary = childNode(compilationUnit, 'ordinaryCompilationUnit')
  if (!ordinary) return []
  const importDecls = (ordinary.children.importDeclaration ?? []).filter(isNode)

  return importDecls.map((decl): JavaImport => {
    const isStatic = 'Static' in decl.children
    const isWildcard = 'Star' in decl.children
    const nameNode = childNode(decl, 'packageOrTypeName')
    const segments = nameNode ? joinFlatIdentifiers(nameNode) : []
    const fqn = segments.join('.')
    // 정적 멤버 import(`import static a.b.C.member;`)는 마지막 세그먼트가
    // 멤버명이라 클래스 이름이 아니다 — simpleName은 그 앞 세그먼트로 잡는다.
    const simpleNameIndex =
      isStatic && segments.length > 1 ? segments.length - 2 : segments.length - 1
    const simpleName = segments[simpleNameIndex] ?? ''
    return { simpleName, fqn, isStatic, isWildcard }
  })
}

function extractAnnotationNames(modifiers: AnyCstNode[]): string[] {
  const names: string[] = []
  for (const modifier of modifiers) {
    const annotation = childNode(modifier, 'annotation')
    const typeName = annotation && childNode(annotation, 'typeName')
    if (!typeName) continue
    const segments = joinFlatIdentifiers(typeName)
    if (segments.length > 0) names.push(segments[segments.length - 1])
  }
  return names
}

// unannType은 fieldDeclaration에서는 직접 자식이지만 formalParameter에서는
// variableParaRegularParameter를 한 단계 거쳐야 한다 — 구조 차이를 각각
// 외우는 대신 findAll로 하위 어디에 있든 찾는다(재현 테스트로 두 구조
// 모두 확인, DETAILED_DESIGN.md §0.1과 같은 이유로 실제 CST를 직접 검증했다).
function extractFieldAndParamTypeNames(body: AnyCstNode): string[] {
  const names: string[] = []
  for (const field of findAll(body, 'fieldDeclaration')) {
    const unannType = findAll(field, 'unannType')[0]
    if (unannType) names.push(...collectIdentifiers(unannType))
  }
  for (const ctor of findAll(body, 'constructorDeclaration')) {
    for (const param of findAll(ctor, 'formalParameter')) {
      const unannType = findAll(param, 'unannType')[0]
      if (unannType) names.push(...collectIdentifiers(unannType))
    }
  }
  return names
}

function extractOneType(typeDecl: AnyCstNode, kind: JavaTypeKind): JavaTypeInfo | null {
  const normalDecl =
    childNode(typeDecl, 'normalClassDeclaration') ??
    childNode(typeDecl, 'normalInterfaceDeclaration')
  if (!normalDecl) return null

  const idNode = childNode(normalDecl, 'typeIdentifier')
  const simpleName = idNode ? joinFlatIdentifiers(idNode)[0] : undefined
  if (!simpleName) return null

  const modifierKey = kind === 'class' ? 'classModifier' : 'interfaceModifier'
  const modifiers = (typeDecl.children[modifierKey] ?? []).filter(isNode)
  const annotationSimpleNames = extractAnnotationNames(modifiers)

  const classImplements = childNode(normalDecl, 'classImplements')
  const implementsSimpleNames = classImplements ? collectIdentifiers(classImplements) : []

  const classExtends = childNode(normalDecl, 'classExtends')
  const interfaceExtends = childNode(normalDecl, 'interfaceExtends')
  const extendsNames = [
    ...(classExtends ? collectIdentifiers(classExtends) : []),
    ...(interfaceExtends ? collectIdentifiers(interfaceExtends) : [])
  ]

  const body = childNode(normalDecl, 'classBody') ?? childNode(normalDecl, 'interfaceBody')
  const fieldAndParamTypeNames = body ? extractFieldAndParamTypeNames(body) : []

  return {
    kind,
    simpleName,
    annotationSimpleNames,
    implementsSimpleNames,
    structuralReferenceNames: [...implementsSimpleNames, ...extendsNames],
    fieldAndParamTypeNames
  }
}

export function parseJavaFile(source: string): ParsedJavaFile {
  const cst = parse(source) as unknown as AnyCstNode

  const packageName = extractPackageName(cst)
  const imports = extractImports(cst)

  const types: JavaTypeInfo[] = []
  for (const classDecl of findAll(cst, 'classDeclaration')) {
    const info = extractOneType(classDecl, 'class')
    if (info) types.push(info)
  }
  for (const interfaceDecl of findAll(cst, 'interfaceDeclaration')) {
    const info = extractOneType(interfaceDecl, 'interface')
    if (info) types.push(info)
  }

  return { packageName, imports, types }
}
