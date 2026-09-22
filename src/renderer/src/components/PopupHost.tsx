import { useWorkAreaPopup } from '../lib/workAreaPopupContext'
import { ManualAddPopup } from './deployFiles/ManualAddPopup'
import { FilterPatternsPopup } from './deployFiles/FilterPatternsPopup'
import { DeletedFilesPopup } from './deployFiles/DeletedFilesPopup'
import { WarningsPopup } from './deployFiles/WarningsPopup'

// RT-43(§5.1) — WorkArea가 소유한 openPopup 값에 따라 팝업을 하나만
// 렌더링한다(구조적으로 동시에 둘 이상 불가 — 단일 값이므로 다른 트리거는
// 백드롭에 가려 도달 불가, 키보드도 Popup의 포커스 트랩으로 차단된다).
// 팝업별 도메인 지식(스토어 구독)은 각 팝업 컴포넌트 자신이 갖는다(§2.3
// "D4 이상 컨테이너만 스토어/훅에 접근" — 이 스위치 자체는 컨텍스트 값만
// 본다).
export function PopupHost(): React.JSX.Element | null {
  const { openPopup, close } = useWorkAreaPopup()

  switch (openPopup) {
    case 'manual':
      return <ManualAddPopup onClose={close} />
    case 'patterns':
      return <FilterPatternsPopup onClose={close} />
    case 'deleted':
      return <DeletedFilesPopup onClose={close} />
    case 'warnings':
      return <WarningsPopup onClose={close} />
    default:
      return null
  }
}
