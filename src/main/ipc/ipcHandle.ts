import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { IpcChannelMap } from '../../shared/ipc-channels'

// RT-20(S6) — ipcMain.handle을 채널명·타입 둘 다 IpcChannelMap으로
// 제약하는 얇은 래퍼로 감싼다. 채널명 오타, preload와의 params/result
// 불일치는 이 래퍼를 거치는 순간 컴파일 타임에 잡힌다. RT-21에서
// handlers.ts를 채널 그룹별 파일(handlers/app.ts 등)로 쪼개면서, 그룹
// 파일들이 공유하는 이 부분만 별도 모듈로 뺐다.
export function handle<C extends keyof IpcChannelMap>(
  channel: C,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: IpcChannelMap[C]['params']
  ) => IpcChannelMap[C]['result'] | Promise<IpcChannelMap[C]['result']>
): void {
  ipcMain.handle(channel, listener)
}
