export function pickDefaultBranch(branches: string[]): string | null {
  if (branches.includes('main')) return 'main'
  if (branches.includes('master')) return 'master'
  return null
}
