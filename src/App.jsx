import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Nav from './Nav.jsx'
import Timer from './Timer.jsx'
import Login from './Login.jsx'
import Profile from './Profile.jsx'
import { Pix, applyTheme, currentTheme } from './pixel.jsx'
import { supabase } from './supabase.js'
import { loadPreferences, saveTheme } from './db.js'
import { showAlert, showPrompt } from './dialog.js'

// Placeholder for the pages that were "Coming soon" stubs in the old site.
const Soon = ({ title }) => (
  <div className="container">
    <h1>{title} <Pix name="chart" /></h1>
    <p style={{ color: 'var(--text-dim)', margin: '22px 0', fontWeight: 600 }}>
      <Pix name="cone" /> Coming soon
    </p>
  </div>
)

export default function App() {
  // Theme lives here so both Nav (the picker) and Timer (the cat sprite) see changes.
  const [theme, setTheme] = useState(currentTheme)
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // Gate the timer until the session check finishes, so a logged-in user never
  // sees a flash of guest data pulled from localStorage.
  const [ready, setReady] = useState(!supabase)

  // Pull the user's saved theme down on sign-in.
  async function adoptUser(u) {
    setUser(u)
    const prefs = await loadPreferences(u)
    if (prefs?.theme) setTheme(applyTheme(prefs.theme))
    return prefs
  }

  useEffect(() => {
    if (!supabase) return

    // A recovery link creates a real session, so getSession() would happily log
    // the user in without them ever setting a new password. Skip the auto-login
    // and let the PASSWORD_RECOVERY handler below drive the reset.
    const recovering = window.location.hash.includes('type=recovery')

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !recovering) await adoptUser(session.user)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'PASSWORD_RECOVERY') return
      const pw = await showPrompt('Enter your new password (at least 6 characters):',
        { type: 'password', placeholder: '••••••••' })

      // Cancel / too short → sign out, so the recovery session can't be used to
      // slip into the app on a later refresh without changing the password.
      if (!pw || pw.length < 6) {
        if (pw) showAlert('Password must be at least 6 characters.')
        await supabase.auth.signOut()
        history.replaceState(null, '', window.location.pathname)
        return
      }

      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) return showAlert(error.message)
      showAlert('Password updated — you are now logged in.')
      history.replaceState(null, '', window.location.pathname)  // strip recovery hash
      await adoptUser(session?.user)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function onTheme(t) {
    setTheme(applyTheme(t))
    if (user) await saveTheme(user, t)
  }

  return (
    <>
      <Nav theme={theme} onTheme={onTheme} user={user}
           onLogin={() => setLoginOpen(true)} onProfile={() => setProfileOpen(true)} />
      <Routes>
        {/* `key` remounts Timer on login/logout so it reloads from the right source. */}
        <Route path="/" element={ready ? <Timer theme={theme} user={user} key={user?.id || 'guest'} /> : null} />
        <Route path="/dashboard" element={<Soon title="Dashboard" />} />
        <Route path="/diary" element={<Soon title="Diary" />} />
        <Route path="/todo" element={<Soon title="To-Do" />} />
      </Routes>
      {loginOpen && (
        <Login onClose={() => setLoginOpen(false)} onAuthed={adoptUser} />
      )}
      {profileOpen && user && (
        <Profile user={user} onClose={() => setProfileOpen(false)}
                 onUser={setUser}
                 onLogout={() => { setUser(null); setProfileOpen(false) }} />
      )}
    </>
  )
}
