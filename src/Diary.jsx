import { useEffect, useState } from 'react'
import { Pix } from './pixel.jsx'
import { MONTH_NAMES, hm, pad, ymd } from './calc.js'
import { loadWorkSessions, loadDiaryEntries, saveDiaryEntry } from './db.js'

// Cat moods, on theme. Key is what's stored; emoji is only ever for display.
const MOODS = [
  ['great', '😺'],
  ['good', '😸'],
  ['sad', '😿'],
  ['shocked', '🙀'],
  ['grumpy', '😾'],
]
const moodEmoji = Object.fromEntries(MOODS)

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Clock time of an ISO stamp; older rows predate start/end, so guard for missing.
const hhmm = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

const Frame = ({ children }) => (
  <div className="diary-wrap">
    <h1 className="diary-title">Diary <Pix name="book" /></h1>
    <div className="container diary">{children}</div>
  </div>
)

// The selected day's details, in a slide-in drawer from the right. Keyed by date
// in the parent so its draft state re-seeds whenever a different day is opened.
function DayView({ date, shifts, entry, suggestions, onSave, onClose }) {
  const [emote, setEmote] = useState(entry?.emote || '')
  const [note, setNote] = useState(entry?.note || '')
  const [tags, setTags] = useState(entry?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = () => setSaved(false)
  const addTag = (t) => {
    const v = t.trim()
    if (v && !tags.includes(v)) { setTags([...tags, v]); dirty() }
    setTagInput('')
  }
  const removeTag = (t) => { setTags(tags.filter((x) => x !== t)); dirty() }
  const unused = suggestions.filter((t) => !tags.includes(t))

  const total = shifts.reduce((s, r) => s + r.earned, 0)
  const totalSecs = shifts.reduce((s, r) => s + r.duration, 0)
  const pretty = new Date(date + 'T00:00').toLocaleDateString([],
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  async function save() {
    setSaving(true)
    await onSave(date, emote, note, tags)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label={`Diary for ${pretty}`}>
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2 className="drawer-date"><Pix name="calendar" /> {pretty}</h2>

        <section className="drawer-section">
          <div className="section-head"><Pix name="clock" /> Work</div>
          {shifts.length === 0
            ? <p className="dash-note">No shifts logged this day.</p>
            : (
              <>
                <table className="shift-table">
                  <thead>
                    <tr><th>Start</th><th>End</th><th>Time</th><th className="num">RM</th></tr>
                  </thead>
                  <tbody>
                    {shifts.map((r, i) => (
                      <tr key={r.id ?? i}>
                        <td>{hhmm(r.start)}</td>
                        <td>{hhmm(r.end)}</td>
                        <td>{hm(r.duration)}</td>
                        <td className="num">{r.earned.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="drawer-total">{hm(totalSecs)} · RM {total.toFixed(2)}</p>
              </>
            )}
        </section>

        <section className="drawer-section">
          <div className="section-head"><Pix name="cat" /> Mood</div>
          <div className="mood-row">
            {MOODS.map(([key, emoji]) => (
              <button key={key} type="button" title={key}
                      className={'mood-btn' + (emote === key ? ' active' : '')}
                      onClick={() => { setEmote(emote === key ? '' : key); dirty() }}>
                {emoji}
              </button>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <div className="section-head"><Pix name="star" /> Tags</div>
          {tags.length > 0 && (
            <div className="tag-row">
              {tags.map((t) => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" className="tag-x" aria-label={`Remove ${t}`}
                          onClick={() => removeTag(t)}>&times;</button>
                </span>
              ))}
            </div>
          )}
          <div className="tag-input-row">
            <input className="diary-tag-input" value={tagInput} placeholder="Add a tag…"
                   onChange={(e) => setTagInput(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }} />
            <button type="button" className="btn btn-blue" onClick={() => addTag(tagInput)}>Add</button>
          </div>
          {unused.length > 0 && (
            <div className="tag-row tag-suggest">
              {unused.map((t) => (
                <button key={t} type="button" className="tag-chip tag-pick"
                        onClick={() => addTag(t)}>+ {t}</button>
              ))}
            </div>
          )}
        </section>

        <section className="drawer-section">
          <div className="section-head"><Pix name="book" /> Note</div>
          <textarea className="diary-note" rows="6" value={note}
                    placeholder="Special event, how the day went…"
                    onChange={(e) => { setNote(e.target.value); dirty() }} />
        </section>

        <button className="btn btn-blue drawer-save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </aside>
    </div>
  )
}

export default function Diary({ user }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())   // 0-11
  const [rows, setRows] = useState([])
  const [entries, setEntries] = useState({})           // { 'YYYY-MM-DD': {emote, note, tags} }
  const [selected, setSelected] = useState(null)       // 'YYYY-MM-DD' or null

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([loadWorkSessions(user), loadDiaryEntries(user)]).then(([r, e]) => {
      if (cancelled) return
      setRows(r)
      setEntries(e)
    })
    return () => { cancelled = true }
  }, [user])

  if (!user) return <Frame><p className="dash-note">Log in to write your diary.</p></Frame>

  const step = (delta) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Total seconds worked per day, so a cell can show the coin + how long.
  const workedSecs = rows.reduce((m, r) => {
    m[r.date] = (m[r.date] || 0) + r.duration
    return m
  }, {})
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  async function save(date, emote, note, tags) {
    await saveDiaryEntry(user, date, emote, note, tags)
    setEntries((prev) => ({ ...prev, [date]: { emote, note, tags } }))
  }

  const selectedShifts = selected ? rows.filter((r) => r.date === selected) : []
  const allTags = [...new Set(Object.values(entries).flatMap((e) => e.tags || []))].sort()

  return (
    <Frame>
      <div className="cal-head">
        <button className="pager-btn" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <select className="table-sort" value={month} aria-label="Month"
                onChange={(e) => setMonth(+e.target.value)}>
          {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="table-sort" value={year} aria-label="Year"
                onChange={(e) => setYear(+e.target.value)}>
          {Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i)
            .map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="pager-btn" onClick={() => step(1)} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`b${i}`} className="cal-cell empty" />
          const date = `${year}-${pad(month + 1)}-${pad(day)}`
          const entry = entries[date]
          const isToday = date === ymd(now)
          return (
            <button key={date}
                    className={'cal-cell' + (isToday ? ' today' : '') + (date === selected ? ' selected' : '')}
                    onClick={() => setSelected(date)}>
              <span className="cal-num">{day}</span>
              <div className="cal-bottom">
                <span className="cal-left">
                  {entry?.tags?.map((t) => <span key={t} className="cal-tag">{t}</span>)}
                  {workedSecs[date] && (
                    <span className="cal-work"><Pix name="coin" /> {hm(workedSecs[date])}</span>
                  )}
                </span>
                {entry?.emote && (
                  <span className="cal-mood">
                    <span className="cal-mood-emoji">{moodEmoji[entry.emote]}</span>
                    <span className="cal-mood-text">{entry.emote}</span>
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <DayView key={selected} date={selected} shifts={selectedShifts}
                 entry={entries[selected]} suggestions={allTags}
                 onSave={save} onClose={() => setSelected(null)} />
      )}
    </Frame>
  )
}
