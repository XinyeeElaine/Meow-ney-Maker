import { useEffect, useRef, useState } from 'react'
import { Pix } from './pixel.jsx'
import { sortTasks } from './calc.js'
import { showAlert, showPrompt, showToast, TOAST_MS } from './dialog.js'
import {
  loadTodoData, addCategory, updateCategory, deleteCategory,
  addTodo, updateTodo, deleteTodo,
} from './db.js'


// a shortlist and the tab strip is back to where it started.
const PIN_LIMIT = 3


// Rainbow order, with the neutral parked at the end.
const COLORS = [
  ['rose', '#e35d72'],
  ['pink', '#f2789f'],
  ['gold', '#ffc24b'],
  ['teal', '#3fb8ad'],
  ['blue', '#4fa8e8'],
  ['navy', '#3f63c4'],
  ['purple', '#9b6fd4'],
  ['cream', '#f0dcae'],
]
// Keys live on the row, so every palette this board has had leaves rows behind.
// Without this map they'd all fall back to one colour and the board would look
// as if picking a colour did nothing.
const LEGACY = {
  lilac: 'purple',
  green: 'teal', mint: 'teal',
  slate: 'navy', sky: 'blue',
  amber: 'gold', sand: 'cream',
  orange: 'gold', peach: 'gold', brown: 'gold',
  red: 'rose', coral: 'rose',
}
const colorOf = (key) => {
  const want = LEGACY[key] || key
  return (COLORS.find(([k]) => k === want) || COLORS[0])[1]
}

// No .container wrapper: the board runs the width of the screen and the only
// boxed things on it are the task cards.
const Frame = ({ action, children }) => (
  <div className="todo-wrap">
    <div className="diary-head">
      <h1 className="diary-title">Small wins, one box at a time <Pix name="check" /></h1>
      {action}
    </div>
    {children}
  </div>
)

// When the task was written down. Rows created before this column existed have
// no stamp, so fall back to a dash rather than "Invalid Date".
const made = (iso) =>
  iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'

// Six dots behind a swatch. <details> gives the open/closed state for free — no
// component state, and Escape and outside clicks already behave.
const ColorPick = ({ value, onPick, label }) => (
  <details className="todo-color">
    <summary aria-label={label} style={{ background: colorOf(value) }} />
    <div className="todo-color-pop">
      {COLORS.map(([key, hex]) => (
        <button key={key} type="button" title={key} aria-label={key}
                className={'todo-dot' + (value === key ? ' on' : '')}
                style={{ background: hex }}
                onClick={(e) => { e.currentTarget.closest('details').open = false; onPick(key) }} />
      ))}
    </div>
  </details>
)

// One category: its tasks, the add field, and the done toggle.
function Category({ cat, tasks, onAddTask, onPatch, onDelTask }) {
  const [draft, setDraft] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0][0])
  const [showDone, setShowDone] = useState(false)

  const sorted = sortTasks(tasks)
  const open = sorted.filter((t) => !t.done)
  const done = sorted.filter((t) => t.done)

  // The finished view with nothing left in it: reachable by ticking the last
  // task back open, or deleting it. It needs its own line and its own way out,
  // or the board is a blank page with no button on it.
  const emptyDone = showDone && done.length === 0

  const submit = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    // Cleared only on success — offline, the typed text stays put instead of vanishing.
    if (await onAddTask(cat.id, text, newColor)) setDraft('')
  }

  // One task, one fixed-size card: marks and close on top with the date between
  // them, then the checkbox and the editable title filling the rest.
  const card = (t) => (
    <article className={'todo-task' + (t.done ? ' done' : '')} key={t.id}
             style={{ '--card-c': colorOf(t.color) }}>
      {/* Status controls left, the day it was written centred, close right. The
          colour is fixed once the card exists — it was chosen when it was made. */}
      <div className="todo-task-head">
        <div className="todo-task-marks">
          <button type="button" className={'todo-star' + (t.priority ? ' on' : '')}
                  aria-label={`Favourite: ${t.text}`} aria-pressed={t.priority}
                  onClick={() => onPatch(t.id, { priority: !t.priority })}>
            {t.priority ? '★' : '☆'}
          </button>
        </div>

        <span className="todo-made">{made(t.created_at)}</span>

        <button type="button" className="spend-del todo-task-del"
                aria-label={`Remove ${t.text}`}
                onClick={() => onDelTask(t.id)}>&times;</button>
      </div>

      <div className="todo-task-body">
        {/* Stamp the moment it was ticked, and clear the stamp if it comes back. */}
        <input type="checkbox" checked={t.done} aria-label={`Done: ${t.text}`}
               onChange={() => onPatch(t.id, {
                 done: !t.done,
                 done_at: t.done ? null : new Date().toISOString(),
               })} />
        <textarea className="todo-text" key={t.text} defaultValue={t.text}
                rows={3} aria-label={`Rename ${t.text}`}
                onBlur={(e) => {
                  const text = e.target.value.trim()
                  // Empty means the user cleared it — put the old name back rather
                  // than saving a nameless task.
                  if (!text) return (e.target.value = t.text)
                  if (text !== t.text) onPatch(t.id, { text })
                }}
                onKeyDown={(e) => {
                  // Enter commits instead of adding a newline; the field is a
                  // textarea only so long titles wrap inside the card.
                  if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
                  if (e.key === 'Escape') { e.target.value = t.text; e.target.blur() }
                }} />
      </div>

      {/* Rows ticked before done_at existed carry no stamp, so say "Finished"
          plainly rather than "Finished —". */}
      {t.done && (
        <p className="todo-fin">
          {t.done_at ? `Finished ${made(t.done_at)}` : 'Finished'}
        </p>
      )}
    </article>
  )

  // Percent complete drives the bar. No tasks means an empty bar, not 0/0.
  const total = sorted.length
  const pct = total ? Math.round((done.length / total) * 100) : 0

  return (
    <section className="todo-list">
      {/* Number over label, same shape as the dashboard's KPI cards. */}
      <div className="todo-list-bar">
        <div className="todo-stat">
          <b>{total}</b><span>Total</span>
        </div>
        <div className="todo-stat pending">
          <b>{open.length}</b><span>Pending</span>
        </div>
        <div className="todo-stat finished">
          <b>{done.length}</b><span>Finished</span>
        </div>

        <div className="todo-progress">
          <div className="todo-bar" role="progressbar" aria-valuenow={pct}
               aria-valuemin={0} aria-valuemax={100}
               aria-label={`${cat.name}: ${pct}% done`}>
            <div className="todo-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="todo-count">{pct}%</span>
        </div>

        {/* Right edge, so it holds still while the numbers change width. The
            finished view keeps the button even at zero — it's the way back. */}
        {(done.length > 0 || showDone) && (
          <button type="button" className="range-tab todo-done-toggle"
                  onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide finished' : 'Show finished'}
          </button>
        )}
      </div>

      {/* Finished view swaps the board out entirely — the open cards and the
          template go, so what's left is only what's been done. */}
      <div className="todo-cards">
        {!showDone && (
        <form className="todo-task todo-new" onSubmit={submit}
              style={{ '--card-c': colorOf(newColor) }}>
          {/* Empty first cell so the date sits in the head's centre column,
              mirroring a real card. */}
          <div className="todo-task-head">
            <span />
            <span className="todo-made">{made(new Date().toISOString())}</span>
            <ColorPick value={newColor} label="Colour for the new task"
                       onPick={setNewColor} />
          </div>
          <textarea className="todo-text" value={draft} rows={3}
                    placeholder={`New task in ${cat.name}…`}
                    aria-label={`New task in ${cat.name}`}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter files the card; Shift+Enter is left alone for
                      // anyone writing a two-line title.
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e) }
                    }} />
          <button className="todo-new-save">Press Enter to add</button>
        </form>
        )}

        {(showDone ? done : open).map(card)}
      </div>

      {/* Outside .todo-cards: in that grid it would be squeezed into one 210px
          column instead of running the width of the board. */}
      {emptyDone && (
        <p className="todo-blank">
          Nothing finished in {cat.name} yet — tick a task off and it lands here.{' '}
          <button type="button" className="link-accent link-btn"
                  onClick={() => setShowDone(false)}>Back to tasks</button>
        </p>
      )}
    </section>
  )
}

export default function Todo({ user }) {
  const [cats, setCats] = useState([])
  const [tasks, setTasks] = useState([])
  const [ready, setReady] = useState(false)
  // Which tab is open. Derived against the live list rather than kept in sync,
  // so deleting the open list falls back to the first one on its own.
  const [activeId, setActiveId] = useState(null)
  const settingsRef = useRef(null)
  const [nameDraft, setNameDraft] = useState('')

  // Named so a failed write can pull the truth back from the server. A failed
  // refetch leaves state untouched — a stale list beats a page that looks wiped.
  const refetch = async () => {
    const { ok, categories, todos } = await loadTodoData(user)
    if (!ok) return
    setCats(categories)
    setTasks(todos)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadTodoData(user).then(({ ok, categories, todos }) => {
      if (cancelled) return
      // Set regardless of ok: a genuine load failure should show the empty-state
      // page, not hang forever on "Loading…".
      setCats(categories)
      setTasks(todos)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [user])

  if (!user) return <Frame><p className="dash-note">Log in to see your tasks.</p></Frame>
  if (!ready) return <Frame><p className="dash-note">Loading…</p></Frame>

  async function newList() {
    const name = (await showPrompt(
      'What should this list hold? Give it a name — Study, Home, Work, whatever fits.',
      { cat: 'happy', placeholder: 'e.g. Study' },
    ))?.trim()
    if (!name) return
    const row = await addCategory(user, name, cats.length)
    // Open the new list straight away — making one is a statement of intent.
    if (row) {
      setCats((prev) => [...prev, row])
      setActiveId(row.id)
      showToast(`List "${row.name}" created!`)
    }
  }


  function delCat(cat) {
    settingsRef.current?.close()
    const prevCats = cats
    const prevTasks = tasks
    setCats(prevCats.filter((c) => c.id !== cat.id))
    setTasks(prevTasks.filter((t) => t.category_id !== cat.id))

    let undone = false
    showToast(`Deleted "${cat.name}"`, {
      label: 'Undo',
      onClick: () => { undone = true; setCats(prevCats); setTasks(prevTasks); setActiveId(cat.id) },
    })
    setTimeout(async () => {
      if (undone) return
      if (!await deleteCategory(cat.id)) await refetch()
    }, TOAST_MS)
  }

  // Rename and recolour share one path: both are a patch on the category row.
  async function patchCat(id, fields) {
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)))
    if (await updateCategory(id, fields)) return true
    await refetch()
    return false
  }

  function openSettings() {
    setNameDraft(active.name)
    settingsRef.current.showModal()
  }

  async function newTask(categoryId, text, color) {
    const row = await addTodo(user, categoryId, text, color)
    if (row) setTasks((prev) => [...prev, row])
    return !!row       // tells the caller whether to clear its draft
  }

  // Optimistic: the checkbox has to feel instant. If the write fails, report()
  // has already alerted, and the refetch drops the change the server refused.
  async function patch(id, fields) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)))
    if (!await updateTodo(id, fields)) await refetch()
  }

  async function delTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (!await deleteTodo(id)) await refetch()
  }

  // Pinned lists lead the strip. Array.sort is stable, so everything else keeps
  // the order the server sent.
  const ordered = [...cats].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  const pinnedCount = cats.filter((c) => c.pinned).length

  // Undefined only when there are no lists at all, and that path renders the
  // empty state instead of a tab strip.
  const active = cats.find((c) => c.id === activeId) || ordered[0]

  async function togglePin() {
    if (!active.pinned && pinnedCount >= PIN_LIMIT) {
      return showAlert(`You can pin ${PIN_LIMIT} lists. Unpin one first.`, 'Pin limit')
    }
    patchCat(active.id, { pinned: !active.pinned })
  }

  const newListBtn = (
    <button className="btn btn-blue diary-filter-btn" onClick={newList}>
      <Pix name="star" /> New list
    </button>
  )

  return (
    <Frame action={newListBtn}>
      {/* No lists: a line in the middle of the board, with the header's New list
          button as the only way out. .dash-note is already centred in .todo-wrap. */}
      {cats.length === 0
        ? <p className="dash-note">No lists yet — start one with New list.</p>
        : (
          <>
          {/* One tab per list; only the open one's tasks are rendered. */}
          <div className="todo-tabs" role="tablist">
            {ordered.map((cat) => {
              const openCount = tasks.filter((t) => t.category_id === cat.id && !t.done).length
              return (
                <button key={cat.id} role="tab" aria-selected={cat.id === active.id}
                        className={'range-tab todo-tab' + (cat.id === active.id ? ' active' : '') +
                                   (cat.pinned ? ' pinned' : '')}
                        onClick={() => setActiveId(cat.id)}>
                  {cat.name}
                  {openCount > 0 && <span className="todo-tab-count">{openCount}</span>}
                </button>
              )
            })}
            <button type="button" className="range-tab todo-settings-btn"
                    aria-label={`Settings for ${active.name}`} title="List settings"
                    onClick={openSettings}>
              <Pix name="gear" />
            </button>
          </div>

          <Category key={active.id} cat={active}
                    tasks={tasks.filter((t) => t.category_id === active.id)}
                    onAddTask={newTask} onPatch={patch} onDelTask={delTask} />

          {/* Same <dialog> shell as the diary's pickers. Name commits on submit;
              colour applies on click so the choice is visible immediately. */}
          <dialog ref={settingsRef} className="tag-dialog todo-settings">
            <form method="dialog" onSubmit={async () => {
              const name = nameDraft.trim()
              if (!name || name === active.name) return
              if (await patchCat(active.id, { name })) showToast('List saved!')
            }}>
              <div className="todo-set-head">
                <span className="section-head">List settings</span>
                <button type="button" className="todo-set-x" aria-label="Close"
                        onClick={() => settingsRef.current.close()}>×</button>
              </div>

              <label className="todo-field">
                <span>Name</span>
                <input className="diary-tag-input" value={nameDraft}
                       onChange={(e) => setNameDraft(e.target.value)} />
              </label>

              {/* Pin and Delete act on click; only Name waits for Save, so they
                  sit in their own rows below the field rather than in a button bar. */}
              <div className="todo-set-row">
                <div className="todo-set-label">
                  Keep this list first
                  <small className="todo-hint">{pinnedCount} of {PIN_LIMIT} pinned</small>
                </div>
                <button type="button" aria-pressed={!!active.pinned}
                        className={'range-tab todo-pin' + (active.pinned ? ' active' : '')}
                        onClick={togglePin}>
                  {active.pinned ? 'Unpin' : 'Pin'}
                </button>
              </div>

              <div className="todo-set-row">
                <div className="todo-set-label">
                  Delete
                  <small className="todo-hint">Removes this list and every task in it</small>
                </div>
                <button type="button" className="btn btn-danger todo-set-del"
                        aria-label={`Delete ${active.name}`} title="Delete list"
                        onClick={() => delCat(active)}><Pix name="trash" /></button>
              </div>

              <button className="btn btn-blue todo-set-save">Save</button>
            </form>
          </dialog>
          </>
        )}
    </Frame>
  )
}
