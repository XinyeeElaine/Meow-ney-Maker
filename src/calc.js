// Pure money/time math — no DOM, no React, so it stays testable.
export const pad = (n) => String(Math.floor(n)).padStart(2, '0')

// Monthly salary spread across every working second of the month.
export const ratePerSecond = (salary, hoursPerDay, daysPerMonth) =>
  salary / (daysPerMonth * hoursPerDay * 3600)

export const clock = (s) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`

export const human = (s) =>
  `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${Math.floor(s % 60)}s`

export const hm = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`

// Local calendar date, matching the session_date strings the timer writes. Local,
// not ISO/UTC: a shift stopped at 1am should land on the day the user just lived.
export const ymd = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Rolling windows, not calendar ones: a shift log reads as "the last 7 days",
// and a Monday shouldn't wipe the week's numbers back to zero.
// Dates are YYYY-MM-DD, so string compare is date compare.
export function summarize(rows, today = new Date()) {
  const back = (n) => ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n))
  const week = back(6)                     // today included, so 6 back = 7 days
  const month = back(29)
  const t = { week: 0, month: 0, all: 0, secs: 0 }
  const perDay = new Map()
  for (const r of rows) {
    t.all += r.earned
    t.secs += r.duration
    if (r.date >= week) t.week += r.earned
    if (r.date >= month) t.month += r.earned
    perDay.set(r.date, (perDay.get(r.date) || 0) + r.earned)
  }
  let best = null
  for (const [date, earned] of perDay) if (!best || earned > best.earned) best = { date, earned }
  return { ...t, days: perDay.size, best }
}

// One point per bucket, zero-filled and oldest first, so an idle stretch reads as a
// dip instead of silently dropping off the axis. Week and month bucket by day; a
// year buckets by month, because 365 daily points is a smear, not a chart.
export function series(rows, range = 'week', today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const totals = new Map()
  const out = []

  if (range === 'year') {
    for (const r of rows) {
      const k = r.date.slice(0, 7)                       // YYYY-MM
      totals.set(k, (totals.get(k) || 0) + r.earned)
    }
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(y, m - i, 1)
      const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
      out.push({ key, label: MONTH_NAMES[dt.getMonth()], value: totals.get(key) || 0 })
    }
    return out
  }

  const n = range === 'month' ? 30 : 7
  for (const r of rows) totals.set(r.date, (totals.get(r.date) || 0) + r.earned)
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m, d - i)
    const key = ymd(dt)
    // 30 day-labels collide, so a month names every fifth day and blanks the rest.
    const label = n === 7 ? DAY_NAMES[dt.getDay()] : (i % 5 === 0 ? String(dt.getDate()) : '')
    out.push({ key, label, value: totals.get(key) || 0 })
  }
  return out
}

// Earnings for each day of a chosen calendar month, zero-filled, oldest first.
// month is 0-11. Dates are YYYY-MM-DD strings, so a prefix match picks the month.
export function monthSeries(rows, year, month) {
  const days = new Date(year, month + 1, 0).getDate()   // day 0 of next month = last of this
  const prefix = `${year}-${pad(month + 1)}-`
  const totals = new Map()
  for (const r of rows) {
    if (r.date.startsWith(prefix)) totals.set(r.date, (totals.get(r.date) || 0) + r.earned)
  }
  const out = []
  for (let d = 1; d <= days; d++) {
    const key = `${prefix}${pad(d)}`
    out.push({ key, label: String(d), value: totals.get(key) || 0 })   // every day labelled
  }
  return out
}

// Earnings per month (Jan..Dec) of a chosen calendar year, zero-filled.
export function yearSeries(rows, year) {
  const prefix = `${year}-`
  const totals = new Map()
  for (const r of rows) {
    if (r.date.startsWith(prefix)) {
      const k = r.date.slice(0, 7)                       // YYYY-MM
      totals.set(k, (totals.get(k) || 0) + r.earned)
    }
  }
  return MONTH_NAMES.map((label, m) => {
    const key = `${year}-${pad(m + 1)}`
    return { key, label, value: totals.get(key) || 0 }
  })
}

// Task order inside one category: open work first, then what's urgent, then
// what's due soonest. Undated tasks sink below dated ones rather than sorting
// as "no date = very early". Returns a new array; callers hold the input in
// React state, where mutating in place would skip a re-render.
export function sortTasks(tasks) {
  const dueRank = (t) => (t.due_date ? t.due_date : '9999-12-31')
  return [...tasks].sort((a, b) =>
    (a.done - b.done) ||
    (b.priority - a.priority) ||
    dueRank(a).localeCompare(dueRank(b)) ||
    String(a.created_at).localeCompare(String(b.created_at))
  )
}
