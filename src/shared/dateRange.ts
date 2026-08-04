function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// REQ-003 기본값: 시작일 = 오늘-7일, 종료일 = 오늘
export function getDefaultDateRange(today: Date = new Date()): {
  startDate: string
  endDate: string
} {
  const start = new Date(today)
  start.setDate(start.getDate() - 7)
  return { startDate: formatDate(start), endDate: formatDate(today) }
}
