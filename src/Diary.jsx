import { useEffect, useRef, useState } from 'react'
import { Pix } from './pixel.jsx'
import { MONTH_NAMES, hm, pad, ymd } from './calc.js'
import { loadWorkSessions, loadDiaryEntries, saveDiaryEntry } from './db.js'
import { showDialog } from './dialog.js'

// Cat moods, on theme. Key is what's stored; emoji is only ever for display.
const MOODS = [
  ['happy', '😸'],
  ['sad', '😿'],
  ['sleepy', '😴'],
  ['angry', '😾'],
  ['love', '😻'],
  ['bored', '😼'],
]
// Entries written before this list changed still store the old keys, so keep
// their emoji for display only — they're gone from the picker.
const RETIRED_MOODS = { great: '😺', good: '😸', shocked: '🙀', grumpy: '😾' }
const moodEmoji = { ...RETIRED_MOODS, ...Object.fromEntries(MOODS) }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Always-offered tag suggestions; user's own tags merge in alongside.
const DEFAULT_TAGS = ['Work', 'Play', 'Rest', 'Study', 'Family', 'Special']

// Each default tag gets its own colour in the mini calendar; the colours live in
// style.css as .t-work … .t-special. Custom tags keep the theme accent.
const tagClass = (t) => (DEFAULT_TAGS.includes(t) ? ` t-${t.toLowerCase()}` : '')

// Clock time of an ISO stamp; older rows predate start/end, so guard for missing.
const hhmm = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

// Title centred on the page, action pinned right — the empty first column is what
// keeps the title centred however wide the action gets.
const Frame = ({ action, children }) => (
  <div className="diary-wrap">
    <div className="diary-head">
      <h1 className="diary-title">Every day deserves a page <Pix name="pencil" /></h1>
      {action}
    </div>
    <div className="container diary">{children}</div>
  </div>
)

// The selected day's entry as an open book: info on the left page, writing on
// the right. Keyed by date in the parent so drafts re-seed on day change.
// Book height is fixed, so only show a handful of shifts before truncating.
const MAX_SHIFTS = 4

function BookView({ date, shifts, entry, suggestions, onSave, unsavedRef }) {
  const dialogRef = useRef(null)
  const [emote, setEmote] = useState(entry?.emote || '')
  const [note, setNote] = useState(entry?.note || '')
  const [tags, setTags] = useState(entry?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Two flags on purpose: `saved` drives the button label, `unsavedRef` is what
  // the day-switch and tab-close guards read (a ref, so no stale closure).
  const [unsaved, setUnsaved] = useState(false)
  const dirty = () => { setSaved(false); setUnsaved(true); unsavedRef.current = true }

  // Browser's own "Leave site?" prompt. Only armed while there's something to lose.
  useEffect(() => {
    const warn = (e) => { if (unsavedRef.current) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsavedRef])
  const addTag = (t) => {
    const v = t.trim()
    if (v && !tags.includes(v)) { setTags([...tags, v]); dirty() }
    setTagInput('')
  }
  const removeTag = (t) => { setTags(tags.filter((x) => x !== t)); dirty() }
  const toggleTag = (t) => {
    if (tags.includes(t)) removeTag(t)
    else { setTags([...tags, t]); dirty() }
  }
  // Custom tags deleted this session; hides the chip, defaults are permanent.
  // ponytail: only clears the tag from this day's entry — other days keep it,
  // so it reappears in suggestions after reload. Per-user tag table if needed.
  const [hidden, setHidden] = useState([])
  const delTag = (t) => { setHidden([...hidden, t]); removeTag(t) }
  const shownTags = [...new Set([...suggestions, ...tags])].filter((t) => !hidden.includes(t))
  // Defaults get their own even row; the user's own tags trail the + Add button.
  const defaultTags = shownTags.filter((t) => DEFAULT_TAGS.includes(t))
  const customTags = shownTags.filter((t) => !DEFAULT_TAGS.includes(t))
  // Same chip in both rows; only custom ones carry the delete ×.
  const chip = (t) => {
    const on = tags.includes(t)
    return (
      <button key={t} type="button"
              className={'tag-chip tag-toggle' + (on ? ' on' : '')}
              aria-pressed={on}
              onClick={() => toggleTag(t)}>
        {t}
        {!DEFAULT_TAGS.includes(t) && (
          <span className="tag-x" role="button" aria-label={`Delete ${t}`}
                onClick={(e) => { e.stopPropagation(); delTag(t) }}>&times;</span>
        )}
      </button>
    )
  }

  const total = shifts.reduce((s, r) => s + r.earned, 0)
  const totalSecs = shifts.reduce((s, r) => s + r.duration, 0)
  // Two lines: the date itself, then the weekday under it.
  const day = new Date(date + 'T00:00')
  const pretty = day.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
  const weekday = day.toLocaleDateString([], { weekday: 'long' })

  async function save() {
    setSaving(true)
    await onSave(date, emote, note, tags)
    setSaving(false)
    setSaved(true)
    setUnsaved(false)
    unsavedRef.current = false
  }

  return (
    <div className="book">
      <div className="book-page book-page-left">
        <h2 className="book-date">
          <span className="book-date-line"><Pix name="calendar" /> {pretty}</span>
          <span className="book-weekday">{weekday}</span>
        </h2>

        <section className="book-section">
          <div className="section-head"><Pix name="clock" /> Work</div>
          {shifts.length === 0
            ? <p className="dash-note">No shifts logged this day.</p>
            : (
              <>
                <table className="shift-table">
                  <thead>
                    <tr><th>Start</th><th>End</th><th className="num">Time</th></tr>
                  </thead>
                  <tbody>
                    {shifts.slice(0, MAX_SHIFTS).map((r, i) => (
                      <tr key={r.id ?? i}>
                        <td>{hhmm(r.start)}</td>
                        <td>{hhmm(r.end)}</td>
                        <td className="num">{hm(r.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Time already sits in the table's last column, so the footer
                    only carries the money. */}
                <p className="book-total">
                  {shifts.length > MAX_SHIFTS && `+${shifts.length - MAX_SHIFTS} more · `}
                  Earned <strong>RM {total.toFixed(2)}</strong>
                </p>
              </>
            )}
        </section>

        <section className="book-section">
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
      </div>

      <div className="book-page book-page-right">
        <section className="book-section">
          <div className="section-head"><Pix name="book" /> Note</div>
          <textarea className="diary-note" rows="8" value={note}
                    placeholder="Special event, how the day went…"
                    onChange={(e) => { setNote(e.target.value); dirty() }} />
        </section>

        <section className="book-section">
          <div className="section-head"><Pix name="star" /> Tags</div>
          <div className="tag-row">{defaultTags.map(chip)}</div>
          {/* + Add leads the second row; the user's own tags follow it. */}
          <div className="tag-row-custom">
            <button type="button" className="tag-chip tag-pick"
                    onClick={() => {
                      dialogRef.current.showModal()
                      dialogRef.current.querySelector('input')?.focus()
                    }}>+ Add</button>
            {customTags.map(chip)}
          </div>
          <dialog ref={dialogRef} className="tag-dialog" onClose={() => setTagInput('')}>
            {/* method="dialog" closes the dialog on submit; addTag handles the value. */}
            <form method="dialog" onSubmit={() => addTag(tagInput)}>
              <div className="section-head"><Pix name="star" /> Add tag</div>
              <input className="diary-tag-input" value={tagInput} placeholder="Tag name…"
                     onChange={(e) => setTagInput(e.target.value)} />
              <button className="btn btn-blue">Done</button>
            </form>
          </dialog>
        </section>

        <button className={'btn btn-blue book-save' + (unsaved ? ' unsaved' : '')}
                onClick={save} disabled={saving || !unsaved}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : unsaved ? 'Save •' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function Diary({ user }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())   // 0-11
  const [rows, setRows] = useState([])
  const [entries, setEntries] = useState({})           // { 'YYYY-MM-DD': {emote, note, tags} }
  const [selected, setSelected] = useState(ymd(now))   // 'YYYY-MM-DD'
  const [flip, setFlip] = useState(0)                  // >0 while a page-flip runs
  const [moodFilter, setMoodFilter] = useState('')     // '' = any mood
  const [tagFilter, setTagFilter] = useState('')       // '' = any tag
  const filterRef = useRef(null)

  // Set by BookView while an entry has unsaved edits; switching days would throw
  // them away, so ask first. A ref, not state — the guard must read it at click time.
  const unsavedRef = useRef(false)

  // Same warning Profile shows when a typed name would be lost: "Keep editing" is
  // the cancel action, so Escape can never be what discards the entry.
  const pick = async (date) => {
    if (date === selected) return
    if (unsavedRef.current) {
      const discard = await showDialog({
        title: 'Unsaved changes',
        message: `This day's entry hasn't been saved yet. Switch days anyway?`,
        cat: true,
        okText: 'Discard',
        cancelText: 'Keep editing',
      })
      if (!discard) return
    }
    unsavedRef.current = false
    setSelected(date)
    setFlip((k) => k + 1)   // new key each time so a rapid re-click restarts the animation
  }

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
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  async function save(date, emote, note, tags) {
    await saveDiaryEntry(user, date, emote, note, tags)
    setEntries((prev) => ({ ...prev, [date]: { emote, note, tags } }))
  }

  const selectedShifts = selected ? rows.filter((r) => r.date === selected) : []
  const allTags = [...new Set([
    ...DEFAULT_TAGS,
    ...Object.values(entries).flatMap((e) => e.tags || []),
  ])].sort()

  // Both filters must match. A day with no entry fails either one, so it fades
  // as soon as any filter is on.
  const hits = (e) => (!moodFilter || e?.emote === moodFilter) &&
                      (!tagFilter || (e?.tags || []).includes(tagFilter))

  const filterOn = moodFilter || tagFilter
  const filterBtn = (
    <button className={'btn btn-blue diary-filter-btn' + (filterOn ? ' unsaved' : '')}
            onClick={() => filterRef.current.showModal()}>
      <Pix name="filter" /> Filter{filterOn ? ' •' : ''}
    </button>
  )

  return (
    <Frame action={filterBtn}>
      {/* Same <dialog> shell as the tag picker — dialog.js can't hold selects. */}
      <dialog ref={filterRef} className="tag-dialog">
        <form method="dialog">
          <div className="section-head">Filter days</div>
          <select className="table-sort" value={moodFilter} aria-label="Filter by mood"
                  onChange={(e) => setMoodFilter(e.target.value)}>
            <option value="">All moods</option>
            {MOODS.map(([key, emoji]) => <option key={key} value={key}>{emoji} {key}</option>)}
          </select>
          <select className="table-sort" value={tagFilter} aria-label="Filter by tag"
                  onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="filter-actions">
            <button type="button" className="btn"
                    onClick={() => { setMoodFilter(''); setTagFilter('') }}>Clear</button>
            <button className="btn btn-blue">Done</button>
          </div>
        </form>
      </dialog>

      <div className="diary-cols">
        <div className="mini-cal">
          <div className="cal-head">
            <button className="pager-btn" onClick={() => step(-1)} aria-label="Previous month">‹</button>
            <select className="table-sort" value={month} aria-label="Month"
                    onChange={(e) => setMonth(+e.target.value)}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="table-sort" value={year} aria-label="Year"
                    onChange={(e) => setYear(+e.target.value)}>
              {/* Current year always first, then ten ahead, plus the pager's year
                  if it stepped outside that window. */}
              {[...new Set([
                now.getFullYear(),
                ...Array.from({ length: 10 }, (_, i) => now.getFullYear() + i + 1),
                year,
              ])].map((y) => <option key={y} value={y}>{y}</option>)}
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
                        className={'cal-cell' + (isToday ? ' today' : '') +
                                   (date === selected ? ' selected' : '') +
                                   (hits(entry) ? '' : ' faded')}
                        onClick={() => pick(date)}>
                  <span className="cal-num">{day}</span>
                  {entry?.tags?.[0] && (
                    <span className={'cal-tag' + tagClass(entry.tags[0])}>{entry.tags[0]}</span>
                  )}
                  {entry?.emote && <span className="cal-mini-mood">{moodEmoji[entry.emote]}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="book-outer">
          <BookView key={selected} date={selected} shifts={selectedShifts}
                    entry={entries[selected]} suggestions={allTags} onSave={save}
                    unsavedRef={unsavedRef} />
          {flip > 0 && (
            <div key={flip} className="book-flip" onAnimationEnd={() => setFlip(0)}>
              <div className="book-flip-face book-flip-front" />
              <div className="book-flip-face book-flip-back" />
            </div>
          )}
        </div>
      </div>

    </Frame>
  )
}
