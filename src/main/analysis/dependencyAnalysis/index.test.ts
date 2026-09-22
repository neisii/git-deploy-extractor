import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { analyzeDependencies } from './index'
import { cleanupRepo, commitAll, initRepo, writeFixtureFile } from '../../testSupport/gitFixture'
import type { MappingProfile } from '../../../shared/types'

// RT-22(S7) — dependencyAnalysis.ts를 projectIndex/resolve/implementations/
// index 네 파일로 쪼개기 전까지 이 알고리즘엔 자동 테스트가 하나도 없었다
// (기존엔 v0.3.0 릴리스 때 사람이 Playwright로 한 번 눈으로 확인한 게
// 전부, HANDOFF.md 참고). 분할이 동작을 바꾸지 않았음을 실제로 증명하기
// 위해 최소 Spring Boot 모양 fixture로 핵심 경로를 커버한다.
//
// DETAILED_DESIGN.md §6.2 주의사항대로 Application.java는 최상위 패키지에,
// 나머지 코드는 전부 그 하위 패키지에 둔다(형제 패키지에 두면 컴포넌트
// 스캔 밖이라 아무것도 안 잡히는 게 정상 — 실수하기 쉬운 지점).

const DEFAULT_PROFILE: MappingProfile = { profileName: 'default', version: '1.0', overrides: [] }

describe('analyzeDependencies', () => {
  describe('정상 경로 — 인터페이스·구현체 탐색', () => {
    let dir: string
    const controllerPath = 'src/main/java/com/example/app/controller/OrderController.java'
    const servicePath = 'src/main/java/com/example/app/service/OrderService.java'
    const serviceImplPath = 'src/main/java/com/example/app/service/impl/OrderServiceImpl.java'
    // stereotype 애노테이션이 없는 "가짜" 구현체 — findImplementors의 grep
    // 사전 필터에는 걸리지만 isConfirmedImplementor의 최종 확인에서
    // 걸러져야 한다.
    const notAServicePath = 'src/main/java/com/example/app/service/impl/NotAService.java'
    // BFS로 도달할 수 없는 무관한 파일 — missingDependencies에 나오면 안 됨.
    const unrelatedPath = 'src/main/java/com/example/app/util/StringUtils.java'

    beforeAll(() => {
      dir = initRepo('gde-dep-analysis-')

      writeFixtureFile(
        dir,
        'src/main/java/com/example/app/Application.java',
        [
          'package com.example.app;',
          '',
          'import org.springframework.boot.autoconfigure.SpringBootApplication;',
          '',
          '@SpringBootApplication',
          'public class Application {',
          '}',
          ''
        ].join('\n')
      )

      writeFixtureFile(
        dir,
        controllerPath,
        [
          'package com.example.app.controller;',
          '',
          'import com.example.app.service.OrderService;',
          'import org.springframework.web.bind.annotation.RestController;',
          '',
          '@RestController',
          'public class OrderController {',
          '    private final OrderService orderService;',
          '',
          '    public OrderController(OrderService orderService) {',
          '        this.orderService = orderService;',
          '    }',
          '}',
          ''
        ].join('\n')
      )

      writeFixtureFile(
        dir,
        servicePath,
        [
          'package com.example.app.service;',
          '',
          'public interface OrderService {',
          '    void placeOrder();',
          '}',
          ''
        ].join('\n')
      )

      writeFixtureFile(
        dir,
        serviceImplPath,
        [
          'package com.example.app.service.impl;',
          '',
          'import com.example.app.service.OrderService;',
          'import org.springframework.stereotype.Service;',
          '',
          '@Service',
          'public class OrderServiceImpl implements OrderService {',
          '    public void placeOrder() {}',
          '}',
          ''
        ].join('\n')
      )

      writeFixtureFile(
        dir,
        notAServicePath,
        [
          'package com.example.app.service.impl;',
          '',
          'import com.example.app.service.OrderService;',
          '',
          'public class NotAService implements OrderService {',
          '    public void placeOrder() {}',
          '}',
          ''
        ].join('\n')
      )

      writeFixtureFile(
        dir,
        unrelatedPath,
        ['package com.example.app.util;', '', 'public class StringUtils {', '}', ''].join('\n')
      )

      commitAll(dir, 'add spring app fixture')
    })

    afterAll(() => {
      cleanupRepo(dir)
    })

    it('base package를 감지하고, 참조 그래프로 도달 가능한 것만 missing으로 잡는다', async () => {
      const result = await analyzeDependencies(dir, 'main', [controllerPath], DEFAULT_PROFILE)

      expect(result.applicable).toBe(true)
      expect(result.basePackage).toBe('com.example.app')
      expect(result.parseWarnings).toEqual([])

      const missingPaths = result.missingDependencies.map((d) => d.localPath).sort()
      expect(missingPaths).toEqual([servicePath, serviceImplPath].sort())
    })

    it('필드로 참조된 인터페이스는 kind: interface로, 확정된 구현체는 kind: class로 분류한다', async () => {
      const result = await analyzeDependencies(dir, 'main', [controllerPath], DEFAULT_PROFILE)

      const byPath = new Map(result.missingDependencies.map((d) => [d.localPath, d]))
      expect(byPath.get(servicePath)?.kind).toBe('interface')
      expect(byPath.get(serviceImplPath)?.kind).toBe('class')
      // src/main/java/ 아래는 Mapping Profile을 거치지 않고 그대로 통과한다(DR-011/012).
      expect(byPath.get(serviceImplPath)?.serverPath).toBe(serviceImplPath)
    })

    it('grep 사전 필터에는 걸리지만 stereotype이 없는 구현체는 최종 목록에서 제외한다', async () => {
      const result = await analyzeDependencies(dir, 'main', [controllerPath], DEFAULT_PROFILE)

      const missingPaths = result.missingDependencies.map((d) => d.localPath)
      expect(missingPaths).not.toContain(notAServicePath)
    })
  })

  it('포함된 파일 중 Java 파일이 없으면 applicable: false', async () => {
    const dir = initRepo('gde-dep-analysis-nojava-')
    try {
      writeFixtureFile(dir, 'README.md', 'hello')
      commitAll(dir, 'add readme')

      const result = await analyzeDependencies(dir, 'main', ['README.md'], DEFAULT_PROFILE)

      expect(result.applicable).toBe(false)
      expect(result.missingDependencies).toEqual([])
    } finally {
      cleanupRepo(dir)
    }
  })

  it('@SpringBootApplication 클래스를 못 찾으면 applicable: false', async () => {
    const dir = initRepo('gde-dep-analysis-nospring-')
    try {
      const path = 'src/main/java/com/example/app/Plain.java'
      writeFixtureFile(
        dir,
        path,
        ['package com.example.app;', '', 'public class Plain {', '}', ''].join('\n')
      )
      commitAll(dir, 'add plain class')

      const result = await analyzeDependencies(dir, 'main', [path], DEFAULT_PROFILE)

      expect(result.applicable).toBe(false)
      expect(result.missingDependencies).toEqual([])
    } finally {
      cleanupRepo(dir)
    }
  })
})
