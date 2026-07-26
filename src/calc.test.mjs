// Run: node src/calc.test.mjs
import assert from 'node:assert/strict'
import { clock, hm, human, monthSeries, ratePerSecond, series, sortTasks, summarize, yearSeries, ymd } from './calc.js'

// RM1500 over 26 days x 8h = 748800 working seconds.
const r = ratePerSecond(1500, 8, 26)
assert.equal(r.toFixed(6), '0.002003')
assert.equal((r * 8 * 3600).toFixed(2), '57.69', 'a full 8h day pays salary/26')
assert.equal((r * 26 * 8 * 3600).toFixed(2), '1500.00', 'a full month pays the salary')

assert.equal(clock(0), '00:00:00')
assert.equal(clock(3661.9), '01:01:01', 'partial seconds floor, never round up')
assert.equal(clock(86399), '23:59:59')
assert.equal(human(3661), '1h 1m 1s')
assert.equal(hm(3661), '1h 1m')

assert.equal(ymd(new Date(2026, 0, 5)), '2026-01-05', 'single digits pad')

// Fixed "today" so the rolling windows are deterministic. 2026-03-02 is a Monday,
// so the 7-day window has to reach back into February.
const today = new Date(2026, 2, 2)
const rows = [
  { date: '2026-03-02', duration: 3600, earned: 10 },
  { date: '2026-03-02', duration: 1800, earned: 5 },   // same day, must merge
  { date: '2026-02-25', duration: 7200, earned: 40 },  // 5 days back: in week
  { date: '2026-02-24', duration: 3600, earned: 100 }, // 6 days back: last day in week
  { date: '2026-02-23', duration: 3600, earned: 7 },   // 7 days back: month only
  { date: '2025-12-01', duration: 3600, earned: 3 },   // outside both windows
]
const s = summarize(rows, today)
assert.equal(s.week, 155, 'week is the last 7 days including today')
assert.equal(s.month, 162, 'a day outside the week can still be inside the month')
assert.equal(s.all, 165)
assert.equal(s.secs, 23400)
assert.equal(s.days, 5, 'two shifts on one date count as one day')
assert.deepEqual(s.best, { date: '2026-02-24', earned: 100 }, 'best day beats the merged day')

const week = series(rows, 'week', today)
assert.equal(week.length, 7)
assert.equal(week[0].key, '2026-02-24', 'oldest first, 6 days back')
assert.equal(week.at(-1).key, '2026-03-02', 'newest is today')
assert.equal(week.at(-1).label, 'Mon')
assert.equal(week.at(-1).value, 15, 'same-day shifts are summed into one point')
assert.equal(week[2].key, '2026-02-26')
assert.equal(week[2].value, 0, 'an idle day is a zero point, not a missing one')

const month = series(rows, 'month', today)
assert.equal(month.length, 30)
assert.equal(month[0].key, '2026-02-01', '30 days back crosses the month boundary')
assert.equal(month.at(-1).key, '2026-03-02')
assert.equal(month.filter((p) => p.label).length, 6, 'a month names every fifth day only')

const year = series(rows, 'year', today)
assert.equal(year.length, 12)
assert.equal(year[0].key, '2025-04', '12 months back, oldest first')
assert.equal(year.at(-1).key, '2026-03')
assert.equal(year.at(-1).label, 'Mar')
assert.equal(year.at(-1).value, 15, 'March holds only the two 03-02 shifts')
assert.equal(year.find((p) => p.key === '2026-02').value, 147, 'February sums its three days')
assert.equal(year.find((p) => p.key === '2025-12').value, 3, 'a year reaches past the 30-day window')

// monthSeries: one point per calendar day of the chosen month.
const feb = monthSeries(rows, 2026, 1)                 // February 2026
assert.equal(feb.length, 28, 'Feb 2026 has 28 days')
assert.equal(feb[22].key, '2026-02-23')
assert.equal(feb[22].value, 7, 'the 2026-02-23 shift lands on day 23')
assert.equal(feb[23].value, 100, 'day 24')
assert.equal(feb[24].value, 40, 'day 25')
assert.equal(feb[0].value, 0, 'an idle day is a zero point')
assert.equal(feb.reduce((a, p) => a + p.value, 0), 147, 'February sums its three days')
assert.equal(monthSeries(rows, 2026, 0).length, 31, 'January has 31 days')
assert.equal(monthSeries(rows, 2026, 3).length, 30, 'April has 30 days')

// yearSeries: Jan..Dec of the chosen year.
const y2026 = yearSeries(rows, 2026)
assert.equal(y2026.length, 12)
assert.equal(y2026[0].label, 'Jan')
assert.equal(y2026[1].value, 147, 'February bucket sums its shifts')
assert.equal(y2026[2].value, 15, 'March holds the two 03-02 shifts')
assert.equal(yearSeries(rows, 2025).find((p) => p.key === '2025-12').value, 3, 'Dec 2025')
assert.equal(yearSeries(rows, 2024).every((p) => p.value === 0), true, 'a year with no shifts is all zeros')

// --- sortTasks ---------------------------------------------------------
const t = (over) => ({ done: false, priority: false, due_date: null, created_at: '2026-01-01T00:00:00Z', ...over })

// Open work always outranks finished work, whatever its priority or date.
const doneFirst = sortTasks([
  t({ done: true, priority: true, due_date: '2026-01-01' }),
  t({ id: 'open' }),
])
assert.equal(doneFirst[0].id, 'open', 'done never outranks open')

// Priority beats an earlier due date.
const byPriority = sortTasks([
  t({ id: 'soon', due_date: '2026-01-02' }),
  t({ id: 'urgent', priority: true, due_date: '2026-12-31' }),
])
assert.equal(byPriority[0].id, 'urgent', 'priority beats due date')

// Within one priority level, the earlier date wins and undated sinks.
const byDate = sortTasks([
  t({ id: 'none' }),
  t({ id: 'late', due_date: '2026-06-01' }),
  t({ id: 'early', due_date: '2026-02-01' }),
])
assert.deepEqual(byDate.map((x) => x.id), ['early', 'late', 'none'], 'undated sinks below dated')

// Same priority, same (absent) date: oldest first.
const byAge = sortTasks([
  t({ id: 'new', created_at: '2026-05-05T00:00:00Z' }),
  t({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
])
assert.deepEqual(byAge.map((x) => x.id), ['old', 'new'], 'oldest created first')

// The input array is left alone — callers hold it in React state.
const input = [t({ id: 'b', created_at: '2026-09-09T00:00:00Z' }), t({ id: 'a' })]
sortTasks(input)
assert.equal(input[0].id, 'b', 'sortTasks does not mutate its argument')

console.log('calc ok')
