import { useEffect, useState } from 'react'
import { Pix } from './pixel.jsx'
import { RANGES, hm, series, summarize } from './calc.js'
import { loadWorkSessions } from './db.js'
import { showAlert } from './dialog.js'
import { supabase } from './supabase.js'

// `action` is the header's top-right slot. It stays empty on the loading, guest,
// and no-shifts states — there is nothing to report on yet.
const Frame = ({ action, children }) => (
  <div className="container dashboard">
    <div className="dash-top">
      <h1>Dashboard <Pix name="chart" /></h1>
      {action}
    </div>
    {children}
  </div>
)

// SVG coordinate space. The viewBox scales to whatever width the column gets, so
// these are ratios, not pixels. Labels live in HTML below the chart instead of in
// the SVG, so they keep the page's font size at every width.
const W = 300, H = 110, PAD = 8

// One series (earnings per bucket), so one accent line — the heading names it.
function LineChart({ points }) {
  const peak = Math.max(0, ...points.map((p) => p.value))
  const band = W / points.length
  // Points sit at band centres, not edge to edge: that is what the HTML label row
  // below and the bar chart both use, so all three line up at any width.
  const x = (i) => (i + 0.5) * band
  const y = (v) => H - PAD - (peak ? (v / peak) * (H - PAD * 2) : 0)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')

  return (
    <div className="chart-wrap">
      <span className="chart-peak">RM {peak.toFixed(2)}</span>
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
            <rect x={x(i) - band / 2} y="0" width={band} height={H} fill="transparent"
                  title={`${p.key} · RM ${p.value.toFixed(2)}`} />
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
function BarChart({ points }) {
  const peak = Math.max(0, ...points.map((p) => p.value))
  return (
    <div className="chart-wrap">
      <span className="chart-peak">RM {peak.toFixed(2)}</span>
      <div className="bar-chart">
        {points.map((p) => (
          <div className="bar-col" key={p.key} title={`${p.key} · RM ${p.value.toFixed(2)}`}>
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

// Read-only view of work_sessions. Deleting shifts stays on the Timer's history
// screen, so there's one place that can destroy a row.
export default function Dashboard({ user }) {
  const [rows, setRows] = useState(null)      // null = still loading
  const [range, setRange] = useState('week')
  const [report, setReport] = useState('')
  const [busy, setBusy] = useState(false)

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
  const recent = rows.slice(-8).reverse()     // loadWorkSessions returns oldest-first

  // The key is held server-side in a Supabase Edge Function — see
  // supabase/functions/report/index.ts. Only these numbers leave the browser.
  async function generateReport() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('report', {
      body: {
        stats: {
          week: s.week, month: s.month, all: s.all, secs: s.secs,
          days: s.days, bestEarned: s.best.earned, shifts: rows.length,
        },
      },
    })
    setBusy(false)
    if (error || data?.error) return showAlert(`Report failed: ${error?.message || data.error}`)
    setReport(data.text)
  }

  const reportBtn = (
    <button className="btn btn-blue dash-action" disabled={busy} onClick={generateReport}>
      <Pix name="book" /> {busy ? 'Writing…' : 'Generate report'}
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
              {RANGES.map(([key, label]) => (
                <button key={key} onClick={() => setRange(key)}
                        className={'range-tab' + (key === range ? ' active' : '')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <LineChart points={series(rows, range)} />
        </section>

        <section>
          <div className="section-head"><Pix name="chart" /> Earned in the last 7 days</div>
          <BarChart points={series(rows, 'week')} />
        </section>
      </div>

      {/* Row 3 — recent shifts, full width. */}
      <section>
        <div className="section-head"><Pix name="list" /> Recent shifts</div>
        <div className="history-list">
          {recent.map((r, i) => (
            <div className="history-item" key={r.id ?? `${r.date}-${i}`}>
              <span style={{ flex: 1.5, whiteSpace: 'nowrap' }}><Pix name="calendar" /> {r.date}</span>
              <span style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                <Pix name="clock" /> {hm(r.duration)}
              </span>
              <span style={{ flex: 1.1, textAlign: 'right', whiteSpace: 'nowrap',
                             color: 'var(--accent)', fontWeight: 'bold' }}>
                RM {r.earned.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {report && (
        <section>
          <div className="section-head"><Pix name="book" /> Report</div>
          <p className="dash-report">{report}</p>
        </section>
      )}
    </Frame>
  )
}
