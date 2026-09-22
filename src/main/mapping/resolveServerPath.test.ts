import { describe, expect, it } from 'vitest'
import { resolveServerPath, validateMappingProfile } from './resolveServerPath'
import type { MappingProfile } from '../../shared/types'

// scripts/verify-phase2.ts 케이스 5의 이식 — Mapping Profile override
// (REQ-008, DR-010~012).

describe('resolveServerPath', () => {
  const profile: MappingProfile = {
    profileName: 'test-profile',
    version: '1.0',
    overrides: [
      { from: 'config/deploy-only.properties', to: 'config/override/deploy-only.properties' },
      // DR-011/012 경로에 실수로 override를 넣어도 무시되어야 한다.
      { from: 'src/main/java/com/example/Ignored.java', to: 'should-not-be-used' }
    ]
  }

  it('Spring 표준 java 경로는 그대로 유지된다', () => {
    expect(
      resolveServerPath('src/main/java/com/example/sell/GuaranteeListController.java', profile)
    ).toBe('src/main/java/com/example/sell/GuaranteeListController.java')
  })

  it('Spring 표준 resources 경로는 그대로 유지된다', () => {
    expect(resolveServerPath('src/main/resources/static/js/guarantee/list.js', profile)).toBe(
      'src/main/resources/static/js/guarantee/list.js'
    )
  })

  it('Spring 표준 구조 안의 경로는 override가 매치해도 무시된다', () => {
    expect(resolveServerPath('src/main/java/com/example/Ignored.java', profile)).toBe(
      'src/main/java/com/example/Ignored.java'
    )
  })

  it('Spring 표준 구조 밖의 경로는 override가 적용된다', () => {
    expect(resolveServerPath('config/deploy-only.properties', profile)).toBe(
      'config/override/deploy-only.properties'
    )
  })

  it('override가 없는 경로는 그대로(identity)', () => {
    expect(resolveServerPath('config/no-override.properties', profile)).toBe(
      'config/no-override.properties'
    )
  })
})

describe('validateMappingProfile', () => {
  it('중복된 from은 거부한다', () => {
    expect(() =>
      validateMappingProfile({
        profileName: 'dup',
        version: '1.0',
        overrides: [
          { from: 'a.txt', to: 'b.txt' },
          { from: 'a.txt', to: 'c.txt' }
        ]
      })
    ).toThrow()
  })
})
