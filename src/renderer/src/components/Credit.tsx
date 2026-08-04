import goraeng from '../assets/goraeng.png'

export function Credit(): React.JSX.Element {
  return (
    <a
      className="credit-link"
      href="https://github.com/neisii"
      target="_blank"
      rel="noopener noreferrer"
      title="클릭 시 제작자의 Github로 이동합니다."
    >
      <img src={goraeng} alt="" width={50} height={50} />
    </a>
  )
}
