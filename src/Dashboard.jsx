import { useEffect, useState } from 'react'
import { Pix } from './pixel.jsx'
import { MONTH_NAMES, hm, monthSeries, pad, series, summarize, yearSeries, ymd } from './calc.js'
import { loadWorkSessions } from './db.js'

// `action` is the header's top-right slot. It stays empty on the loading, guest,
// and no-shifts states — there is nothing to report on yet.
const Frame = ({ action, children }) => (
  <div className="container dashboard">
    <div className="dash-top">
      <h1>Dashboard <Pix name="chart" /></h1>
      {action}
    </div>
    {/* Only on paper: a printed report needs a date on it. */}
    <p className="print-only">Report generated {ymd()}</p>
    {children}
  </div>
)

// SVG coordinate space. The viewBox scales to whatever width the column gets, so
// these are ratios, not pixels. Labels live in HTML below the chart instead of in
// the SVG, so they keep the page's font size at every width.
const W = 300, H = 110, PAD = 8

// One series (earnings per bucket), so one accent line — the heading names it.
// `peakShift` is the biggest single shift in view; `peak` (bucket max) scales the plot.
function LineChart({ points, peakShift }) {
  const peak = Math.max(0, ...points.map((p) => p.value))
  const band = W / points.length
  // Points sit at band centres, not edge to edge: that is what the HTML label row
  // below and the bar chart both use, so all three line up at any width.
  const x = (i) => (i + 0.5) * band
  const y = (v) => H - PAD - (peak ? (v / peak) * (H - PAD * 2) : 0)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')

  return (
    <div className="chart-wrap line-wrap">
      <span className="chart-peak" title="Highest single shift earning">
        Peak: RM {peakShift.toFixed(2)}
      </span>
      <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           role="img" aria-label="Earnings over the selected range">
        <path className="line-fill" d={`${line} L${x(points.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`} />
        <path className="line-stroke" d={line} />
        {points.map((p, i) => (
          <g key={p.key}>
            {/* Dots only when they'd stay readable; 30 of them is noise. */}
            {points.length <= 12 && <circle className="line-dot" cx={x(i)} cy={y(p.value)} r="3" />}
            {/* Full-height hit band, so the tooltip target is bigger than the mark.
                title= is picked up by startTooltips() and rendered as a pixel tooltip. */}
            <rect className="tip-mono" x={x(i) - band / 2} y="0" width={band} height={H}
                  fill="transparent" title={`${p.key} · RM ${p.value.toFixed(2)}`} />
          </g>
        ))}
      </svg>
      <div className="chart-labels">
        {points.map((p) => <span key={p.key}>{p.label}</span>)}
      </div>
    </div>
  )
}

// Same wrapper and label row as the line chart, so the two read as one system and
// their columns line up with each other.
function BarChart({ points, peakShift }) {
  const peak = Math.max(0, ...points.map((p) => p.value))
  return (
    <div className="chart-wrap">
      <span className="chart-peak" title="Highest single shift earning">
        Peak: RM {peakShift.toFixed(2)}
      </span>
      <div className="bar-chart">
        {points.map((p) => (
          <div className="bar-col tip-mono" key={p.key} title={`${p.key} · RM ${p.value.toFixed(2)}`}>
            {p.value > 0 && (
              // Floor at 4% so a tiny day is still a visible mark, not a hairline.
              <div className="bar" style={{ height: `${Math.max(4, (p.value / peak) * 100)}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {points.map((p) => <span key={p.key}>{p.label}</span>)}
      </div>
    </div>
  )
}

const PAGE_SIZE = 5

// Clock time of an ISO stamp. Older rows predate start/end, so guard for missing.
const hhmm = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

const SORTS = [
  ['new', 'Newest first'],
  ['old', 'Oldest first'],
  ['high', 'Highest earning'],
  ['low', 'Lowest earning'],
]

// rows arrive oldest-first; copy before sorting so the source array is never touched.
function sortRows(rows, sort) {
  const r = [...rows]
  if (sort === 'new') return r.reverse()
  if (sort === 'old') return r
  return r.sort((a, b) => (sort === 'high' ? b.earned - a.earned : a.earned - b.earned))
}

// Every shift in a paged, sortable table. "Top 5" pins the five best-earning rows
// and drops the pager, since there's nothing to page through.
function ShiftTable({ rows }) {
  const [sort, setSort] = useState('new')
  const [page, setPage] = useState(1)
  const [top5, setTop5] = useState(false)
  const [q, setQ] = useState('')

  // Substring match on the date and the RM amount, e.g. "2026-03" or "42.5".
  const term = q.trim().toLowerCase()
  const matched = term
    ? rows.filter((r) => r.date.includes(term) || r.earned.toFixed(2).includes(term))
    : rows
  const sorted = top5 ? sortRows(rows, 'high').slice(0, 5) : sortRows(matched, sort)
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pages)      // clamp if a filter shrank the list
  const shown = top5 ? sorted : sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  return (
    <section>
      <div className="chart-head">
        <div className="section-head"><Pix name="coin" /> All shifts</div>
        <div className="table-controls">
          <button className={'range-tab top5-btn' + (top5 ? ' active' : '')}
                  onClick={() => { setTop5(!top5); setPage(1) }}>
            <Pix name="star" /> Top 5
          </button>
          <select className="table-sort" value={sort} disabled={top5}
                  onChange={(e) => { setSort(e.target.value); setPage(1) }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="table-sort table-search" type="search" value={q} disabled={top5}
                 placeholder="Search..."
                 onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
      </div>

      <table className="shift-table">
        <thead>
          <tr>
            <th>Date</th><th>Start Time</th><th>End Time</th>
            <th>Time worked</th><th className="num">Earned (RM)</th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && (
            <tr><td colSpan="5" className="table-empty">No shifts match “{q}”.</td></tr>
          )}
          {shown.map((r, i) => (
            <tr key={r.id ?? `${r.date}-${i}`}>
              <td>{r.date}</td>
              <td>{hhmm(r.start)}</td>
              <td>{hhmm(r.end)}</td>
              <td>{hm(r.duration)}</td>
              <td className="num">{r.earned.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* First, current, and last page, e.g. ‹ 1 … 5 … 10 ›. Arrows only appear
          when there's somewhere to go, so page 1 has no ‹ and the last has no ›. */}
      {!top5 && (
        <div className="pager">
          {current > 1 && (
            <button className="pager-btn" onClick={() => setPage(current - 1)}
                    aria-label="Previous page">‹</button>
          )}
          {[...new Set([1, current, pages])].sort((a, b) => a - b).map((n, i, arr) => (
            <span key={n} style={{ display: 'contents' }}>
              {i > 0 && n - arr[i - 1] > 1 && <span className="pager-gap">…</span>}
              <button className={'pager-btn' + (n === current ? ' active' : '')}
                      onClick={() => setPage(n)}>{n}</button>
            </span>
          ))}
          {current < pages && (
            <button className="pager-btn" onClick={() => setPage(current + 1)}
                    aria-label="Next page">›</button>
          )}
        </div>
      )}
    </section>
  )
}

// Read-only view of work_sessions. Deleting shifts stays on the Timer's history
// screen, so there's one place that can destroy a row.
export default function Dashboard({ user }) {
  const [rows, setRows] = useState(null)      // null = still loading
  const now = new Date()
  const [view, setView] = useState('month')   // 'month' | 'year'
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadWorkSessions(user).then((r) => { if (!cancelled) setRows(r) })
    return () => { cancelled = true }
  }, [user])

  if (!user) return <Frame><p className="dash-note">Log in to see your stats.</p></Frame>
  if (!rows) return <Frame><p className="dash-note">Loading…</p></Frame>
  if (!rows.length) return <Frame><p className="dash-note">No shifts logged yet.</p></Frame>

  const s = summarize(rows)

  // Years to offer in the dropdown: every year with a shift, plus the current one
  // so an empty new year is still selectable, newest first.
  const years = [...new Set([now.getFullYear(), ...rows.map((r) => +r.date.slice(0, 4))])]
    .sort((a, b) => b - a)

  // Biggest single shift in a date range — the "Peak" the charts show. Not the
  // bucket total, which can merge several shifts on one day.
  const topShift = (prefix) =>
    rows.reduce((m, r) => (r.date.startsWith(prefix) ? Math.max(m, r.earned) : m), 0)
  const linePrefix = view === 'year' ? `${year}-` : `${year}-${pad(month + 1)}-`
  const weekStart = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
  const weekTopShift = rows.reduce((m, r) => (r.date >= weekStart ? Math.max(m, r.earned) : m), 0)

  // The dashboard already is the report, so printing it is the PDF. The browser's
  // "Save as PDF" destination writes the file — see the @media print block in style.css.
  const reportBtn = (
    <button className="btn btn-blue dash-action" onClick={() => window.print()}>
      <Pix name="book" /> Download PDF
    </button>
  )

  const kpis = [
    [s.all.toFixed(2), 'Earned all time (RM)'],
    [hm(s.secs), 'Total time worked'],
    [s.days, 'Days worked'],
    [rows.length, 'Shifts logged'],
    [s.best.earned.toFixed(2), 'Best day (RM)'],
  ]

  return (
    <Frame action={reportBtn}>
      {/* Row 1 — one card per number, spanning the width. */}
      <div className="kpi-row">
        {kpis.map(([value, label]) => (
          <div className="kpi stat-box" key={label}>
            <span>{value}</span>
            <p>{label}</p>
          </div>
        ))}
      </div>

      {/* Row 2 — the two charts, side by side and stretched to equal height. */}
      <div className="dash-grid">
        <section>
          <div className="chart-head">
            <div className="section-head"><Pix name="coin" /> Earnings over time</div>
            <div className="range-tabs">
              <button onClick={() => setView('month')}
                      className={'range-tab' + (view === 'month' ? ' active' : '')}>Month</button>
              <button onClick={() => setView('year')}
                      className={'range-tab' + (view === 'year' ? ' active' : '')}>Year</button>
              {/* Month view picks a month; both views pick a year. */}
              {view === 'month' && (
                <select className="table-sort" value={month} aria-label="Month"
                        onChange={(e) => setMonth(+e.target.value)}>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              )}
              <select className="table-sort" value={year} aria-label="Year"
                      onChange={(e) => setYear(+e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <LineChart peakShift={topShift(linePrefix)}
                     points={view === 'year' ? yearSeries(rows, year) : monthSeries(rows, year, month)} />
        </section>

        <section>
          <div className="section-head"><Pix name="coin" /> Earned in the last 7 days</div>
          <BarChart peakShift={weekTopShift} points={series(rows, 'week')} />
        </section>
      </div>

      {/* Row 3 — the full shift table, paged and sortable. */}
      <ShiftTable rows={rows} />
    </Frame>
  )
}
