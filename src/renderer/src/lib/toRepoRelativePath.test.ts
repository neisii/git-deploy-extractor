import { describe, expect, it } from 'vitest'
import { toRepoRelativePath } from './toRepoRelativePath'

describe('toRepoRelativePath', () => {
  it('이미 상대경로면 그대로 둔다', () => {
    expect(toRepoRelativePath('src/main/App.java')).toBe('src/main/App.java')
  })

  it('백슬래시를 슬래시로 정규화한다', () => {
    expect(toRepoRelativePath('src\\main\\App.java')).toBe('src/main/App.java')
  })

  it('선행 ./ 를 제거한다', () => {
    expect(toRepoRelativePath('./src/main/App.java')).toBe('src/main/App.java')
  })

  it('선행 / 를 제거한다', () => {
    expect(toRepoRelativePath('/src/main/App.java')).toBe('src/main/App.java')
  })
})
