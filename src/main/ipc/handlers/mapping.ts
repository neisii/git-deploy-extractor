import { listProfileNames } from '../../mapping/profileStore'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { handle } from '../ipcHandle'
import { getProfilesDir } from './profilesDir'

export function registerMappingHandlers(): void {
  handle(IPC_CHANNELS['mapping:listProfiles'], () => {
    return listProfileNames(getProfilesDir())
  })
}
