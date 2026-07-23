import { useEffect, useRef, useState } from 'react'
import { Cat, Pix } from './pixel.jsx'
import { clock, hm, human, ratePerSecond, ymd } from './calc.js'
import { showAlert, showConfirm } from './dialog.js'
import * as db from './db.js'

const GRIND_PHRASES = [
  "Grinding... 🧱", "Making bank 🤑", "Cha-ching! 💸", "Stacking coins 🪙",
  "Get that bag 💰", "Meow-ney rising 📈", "Hustle mode 🔥", "Counting pennies 🐾",
  "Still slaving 😹", "To the moon 🚀",
]

const ACTIVE_KEYS = ['activeStartTime', 'activeRate', 'activeTotalEarned', 'isWorking']
const clearActive = () => ACTIVE_KEYS.forEach((k) => localStorage.removeItem(k))

// Two storage paths, exactly as before: signed in → Supabase, guest → localStorage.
export default function Timer({ theme, user }) {
  const [screen, setScreen] = useState('input')
  const [form, setForm] = useState({ salary: '', hours: '', days: '' })
  const [elapsed, setElapsed] = useState(0)
  const [earned, setEarned] = useState(0)
  const [phrase, setPhrase] = useState(GRIND_PHRASES[0])
  const [history, setHistory] = useState([])
  const rate = useRef(0)
  const startedAt = useRef(0)

  // Restore saved inputs, and resume a shift that was running before a refresh.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (user) {
        const prefs = await db.loadPreferences(user)
        const active = await db.loadActiveSession(user)
        if (cancelled) return
        if (prefs && prefs.salary > 0) {
          setForm({
            salary: prefs.salary || '',
            hours: prefs.hours_per_day || '',
            days: prefs.days_per_month || '',
          })
        }
        if (active) {
          startedAt.current = new Date(active.start_time).getTime()
          rate.current = active.rate_per_second
          setScreen('timer')
        }
        return
      }
      setForm({
        salary: localStorage.getItem('savedSalary') || '',
        hours: localStorage.getItem('savedHours') || '',
        days: localStorage.getItem('savedDays') || '',
      })
      if (localStorage.getItem('isWorking') === 'true') {
        startedAt.current = parseInt(localStorage.getItem('activeStartTime'))
        rate.current = parseFloat(localStorage.getItem('activeRate')) || 0
        setScreen('timer')
      }
    })()
    return () => { cancelled = true }
  }, [user])

  // Tick. Elapsed is recomputed from the start timestamp, so a throttled
  // background tab cannot make the clock drift behind wall time.
  useEffect(() => {
    if (screen !== 'timer') return
    const tick = () => {
      const e = (Date.now() - startedAt.current) / 1000
      setElapsed(e)
      setEarned(e * rate.current)
      // Crash-recovery snapshot for guests only; signed-in shifts live in active_sessions.
      if (!user) localStorage.setItem('activeTotalEarned', e * rate.current)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [screen])

  useEffect(() => {
    if (screen !== 'timer') return
    let i = 0
    const id = setInterval(() => setPhrase(GRIND_PHRASES[++i % GRIND_PHRASES.length]), 2500)
    return () => clearInterval(id)
  }, [screen])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function startWork() {
    const salary = parseFloat(form.salary)
    const hours = parseFloat(form.hours)
    const days = parseFloat(form.days)
    if (!salary || !hours || !days) return showAlert('Please fill in ALL fields!')

    rate.current = ratePerSecond(salary, hours, days)
    startedAt.current = Date.now()
    setEarned(0)
    setElapsed(0)
    setScreen('timer')

    if (user) {
      await db.savePreferences(user, salary, hours, days)
      await db.saveActiveSession(user, startedAt.current, rate.current)
      return
    }
    localStorage.setItem('savedSalary', salary)
    localStorage.setItem('savedHours', hours)
    localStorage.setItem('savedDays', days)
    // Persist the shift so a refresh resumes instead of losing it.
    localStorage.setItem('activeStartTime', startedAt.current)
    localStorage.setItem('activeRate', rate.current)
    localStorage.setItem('activeTotalEarned', 0)
    localStorage.setItem('isWorking', 'true')
  }

  async function stopWork() {
    const secs = (Date.now() - startedAt.current) / 1000
    const total = secs * rate.current
    setElapsed(secs)
    setEarned(total)
    setScreen('result')

    const date = ymd()

    if (user) {
      await db.clearActiveSession(user)
      await db.saveWorkSession(user, startedAt.current, secs, rate.current, total, date)
      return
    }
    clearActive()
    const log = JSON.parse(localStorage.getItem('workHistory')) || []
    log.push({ date, duration: secs, earned: total })
    localStorage.setItem('workHistory', JSON.stringify(log))
  }

  async function reset() {
    setEarned(0)
    setElapsed(0)
    setScreen('input')
    if (user) await db.clearActiveSession(user)
    else clearActive()
  }

  async function viewHistory() {
    setHistory(user ? await db.loadWorkSessions(user)
                    : JSON.parse(localStorage.getItem('workHistory')) || [])
    setScreen('history')
  }

  async function clearHistory() {
    if (!await showConfirm('Are you sure you want to clear ALL history?')) return
    if (user) await db.clearAllWorkSessions(user)
    else localStorage.removeItem('workHistory')
    setHistory([])
  }

  // `i` indexes the stored (oldest-first) array, not the reversed display order.
  async function deleteRecord(i) {
    if (!await showConfirm('Are you sure you want to delete this specific shift?')) return
    const next = history.slice()
    const [removed] = next.splice(i, 1)
    if (user) await db.deleteWorkSession(removed.id)
    else localStorage.setItem('workHistory', JSON.stringify(next))
    setHistory(next)
  }

  const totals = history.reduce(
    (a, r) => ({ secs: a.secs + r.duration, money: a.money + r.earned }),
    { secs: 0, money: 0 },
  )
  const uniqueDays = new Set(history.map((r) => r.date)).size

  return (
    <div className="container">
      {screen === 'input' && (
        // style.css targets these by id (#inputScreen h1 is the floating badge title,
        // .container:has(#historyScreen[style*="block"]) widens the card) — keep them.
        <div className="input-screen" id="inputScreen" style={{ display: 'block' }}>
          <h1>· Meow~Ney Time ·<br /><span className="kao">( Φ ω Φ )</span></h1>

          <div className="input-group">
            <label><Pix name="coin" /> Salary (RM)</label>
            <input type="number" value={form.salary} onChange={set('salary')} placeholder="E.g: 1500" />
          </div>
          <div className="input-group">
            <label><Pix name="clock" /> Working Hours</label>
            <input type="number" value={form.hours} onChange={set('hours')} placeholder="E.g: 8" />
          </div>
          <div className="input-group">
            <label><Pix name="calendar" /> Working Days</label>
            <input type="number" value={form.days} onChange={set('days')} placeholder="E.g: 26" />
          </div>

          <button className="btn btn-start" onClick={startWork}>
            Welcome to HELL <Pix name="star" />
          </button>
          <button className="btn btn-blue" onClick={viewHistory} style={{ width: '100%', fontSize: 18 }}>
            <Pix name="chart" /> View History
          </button>
        </div>
      )}

      {screen === 'timer' && (
        <div className="timer-screen" id="timerScreen" style={{ display: 'block' }}>
          <h1 id="timerTitle">{phrase}</h1>
          <div className="cat-container working" id="workingCat"><Cat theme={theme} /></div>
          <div className="money-display">{earned.toFixed(4)}</div>
          <div className="time-display">Worked: <span>{clock(elapsed)}</span></div>
          <button className="btn btn-stop" onClick={stopWork}>CLOCK OUT <Pix name="fire" /></button>
        </div>
      )}

      {screen === 'result' && (
        <div className="result-screen" id="resultScreen" style={{ display: 'block' }}>
          <h1>Clocked Out <Pix name="cat" /></h1>
          <div className="celebration">
            <img src="https://media.tenor.com/tLF__YybpV0AAAAj/dj-cat.gif" alt="DJ Cat" className="dj-cat" />
          </div>
          <div className="result-amount">{earned.toFixed(2)}</div>
          <div className="result-details">
            <p><Pix name="calendar" /> Time worked: <strong>{human(elapsed)}</strong></p>
            <p><Pix name="coin" /> Per second: <strong>RM{rate.current.toFixed(6)}</strong></p>
            <p><Pix name="moneybag" /> Earned today: <strong>RM{earned.toFixed(2)}</strong></p>
          </div>
          <div className="button-group">
            <button className="btn btn-reset" onClick={reset} style={{ width: '100%' }}>RuNnnN</button>
          </div>
        </div>
      )}

      {screen === 'history' && (
        <div className="history-screen" id="historyScreen" style={{ display: 'block' }}>
          <h1>Working History <Pix name="chart" /></h1>
          <div className="history-stats">
            <div className="stat-box"><span>{uniqueDays}</span><p>Days</p></div>
            <div className="stat-box"><span>{hm(totals.secs)}</span><p>Hours</p></div>
            <div className="stat-box"><span>{totals.money.toFixed(4)}</span><p>Earned (RM)</p></div>
          </div>
          <div className="history-list">
            {history.length === 0
              ? <p style={{ textAlign: 'center', padding: 20, color: '#666' }}>No history yet</p>
              : history.slice().reverse().map((r, i) => (
                  <div className="history-item" key={history.length - 1 - i}>
                    <span style={{ flex: 1.5, whiteSpace: 'nowrap' }}><Pix name="calendar" /> {r.date}</span>
                    <span style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <Pix name="clock" /> {hm(r.duration)}
                    </span>
                    <span style={{ flex: 1.1, textAlign: 'right', whiteSpace: 'nowrap',
                                   color: 'var(--accent)', fontWeight: 'bold' }}>
                      RM {r.earned.toFixed(4)}
                    </span>
                    <button className="delete-btn" title="Delete this shift"
                            onClick={() => deleteRecord(history.length - 1 - i)}>
                      <Pix name="cross" />
                    </button>
                  </div>
                ))}
          </div>
          <button className="btn btn-reset" onClick={() => setScreen('input')} style={{ width: '100%' }}>Back</button>
          {history.length > 0 && (
            <button className="btn btn-danger" onClick={clearHistory} style={{ width: '100%', marginTop: 10 }}>
              Clear All History
            </button>
          )}
        </div>
      )}
    </div>
  )
}
