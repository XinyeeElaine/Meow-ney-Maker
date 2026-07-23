// Run: node src/calc.test.mjs
import assert from 'node:assert/strict'
import { clock, hm, human, ratePerSecond, series, summarize, ymd } from './calc.js'

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

console.log('calc ok')
