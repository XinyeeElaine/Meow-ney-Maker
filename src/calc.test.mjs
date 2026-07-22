// Run: node src/calc.test.mjs
import assert from 'node:assert/strict'
import { clock, human, ratePerSecond } from './calc.js'

// RM1500 over 26 days x 8h = 748800 working seconds.
const r = ratePerSecond(1500, 8, 26)
assert.equal(r.toFixed(6), '0.002003')
assert.equal((r * 8 * 3600).toFixed(2), '57.69', 'a full 8h day pays salary/26')
assert.equal((r * 26 * 8 * 3600).toFixed(2), '1500.00', 'a full month pays the salary')

assert.equal(clock(0), '00:00:00')
assert.equal(clock(3661.9), '01:01:01', 'partial seconds floor, never round up')
assert.equal(clock(86399), '23:59:59')
assert.equal(human(3661), '1h 1m 1s')

console.log('calc ok')
