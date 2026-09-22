import { app } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'

export function registerAppHandlers(): void {
  // REQ-017: 버전 배지에 항상 표시할 현재 앱 버전. update:check는 캐시가
  // 신선하면 아예 호출되지 않으므로, 배지 텍스트 자체는 이 별도 채널로
  // 가져온다.
  handle(IPC_CHANNELS['app:getVersion'], () => {
    return app.getVersion()
  })
}
