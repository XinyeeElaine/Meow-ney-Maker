// Pure money/time math — no DOM, no React, so it stays testable.
export const pad = (n) => String(Math.floor(n)).padStart(2, '0')

// Monthly salary spread across every working second of the month.
export const ratePerSecond = (salary, hoursPerDay, daysPerMonth) =>
  salary / (daysPerMonth * hoursPerDay * 3600)

export const clock = (s) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`

export const human = (s) =>
  `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${Math.floor(s % 60)}s`
