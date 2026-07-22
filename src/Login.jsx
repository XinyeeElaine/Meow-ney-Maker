import { useState } from 'react'
import { Pix, iconSvg } from './pixel.jsx'
import { supabase } from './supabase.js'
import { showAlert, showDialog } from './dialog.js'

const NOT_CONFIGURED = 'Supabase not configured. Please contact administrator.'

// OAuth and recovery links must land back on this exact page. HashRouter puts the
// route after '#', which Supabase strips when it appends its own hash — so send
// users to the bare path and let the app route to the timer.
const redirectTo = () => window.location.origin + window.location.pathname

// type="password" toggling to "text" is the whole trick — no value is re-rendered,
// so the browser's password manager still recognises the field.
function PasswordField({ value, onChange }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="input-group">
      <label><Pix name="lock" /> Password</label>
      <div className="pw-wrap">
        <input type={shown ? 'text' : 'password'} value={value} onChange={onChange}
               placeholder="••••••••" />
        <button type="button" className="pw-toggle"
                onClick={() => setShown(!shown)}
                title={shown ? 'Hide password' : 'Show password'}
                aria-label={shown ? 'Hide password' : 'Show password'}
                aria-pressed={shown}
                dangerouslySetInnerHTML={{ __html: iconSvg(shown ? 'eyeOff' : 'eye') }} />
      </div>
    </div>
  )
}

export default function Login({ onClose, onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleLogin() {
    if (!supabase) return showAlert(NOT_CONFIGURED)
    if (!email || !password) return showAlert('Please fill in all fields')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return showAlert(error.message)
    await onAuthed(data.user)
    onClose()
  }

  async function handleSignup() {
    if (!supabase) return showAlert(NOT_CONFIGURED)
    if (!email || !password) return showAlert('Please fill in all fields')
    if (password.length < 6) return showAlert('Password must be at least 6 characters')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return showAlert(error.message)

    // Email-confirmation projects return no session; there is nothing to log into yet.
    if (!data.session) {
      onClose()
      return showDialog({
        title: 'Almost there!',
        message: `Account created for ${email}. Check your inbox to confirm it, then log in and start earning.`,
        cat: 'happy',
        okText: 'Got it',
      })
    }

    // Supabase signs the new user straight in. Seed their preferences while that
    // session is still active (RLS needs auth.uid()), then drop it so signing up
    // does not double as logging in.
    await supabase.from('user_preferences').insert([{
      user_id: data.user.id, salary: 0, hours_per_day: 8, days_per_month: 26, theme: 'midnight',
    }])
    await supabase.auth.signOut()

    setMode('login')
    setPassword('')          // email stays filled so login is one field away
    showDialog({
      title: 'Welcome aboard!',
      message: `Account created for ${email}. Log in to start making some meow-ney.`,
      cat: 'happy',
      okText: 'Log in',
    })
  }

  async function handleGoogleLogin() {
    if (!supabase) return showAlert(NOT_CONFIGURED)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    })
    if (error) showAlert(error.message)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!supabase) return showAlert(NOT_CONFIGURED)
    if (!email) return showAlert('Type your email above first, then tap "Forgot password".')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
    showAlert(error ? error.message : 'Password reset link sent. Check your email.')
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content modal-small">
        <span className="close-btn" onClick={onClose}>&times;</span>

        {mode === 'login' ? (
          <>
            <h2><Pix name="login" /> Login</h2>
            <button className="btn btn-google" onClick={handleGoogleLogin}>
              <Pix name="google" /> Sign in with Google
            </button>
            <p className="or-divider">— or —</p>
            <div className="input-group">
              <label><Pix name="mail" /> Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="your@email.com" />
            </div>
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn-start" onClick={handleLogin}>Login</button>
            <p style={{ marginTop: 12 }}>
              <a href="#" className="link-accent" onClick={handleForgotPassword}>Forgot password?</a>
            </p>
            <p style={{ marginTop: 8 }}>
              Don't have an account?{' '}
              <a href="#" className="link-accent"
                 onClick={(e) => { e.preventDefault(); setMode('signup') }}>Sign Up</a>
            </p>
          </>
        ) : (
          <>
            <h2><Pix name="star" /> Sign Up</h2>
            <div className="input-group">
              <label><Pix name="mail" /> Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="your@email.com" />
            </div>
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn-start" onClick={handleSignup}>Sign Up</button>
            <p style={{ marginTop: 15 }}>
              Already have an account?{' '}
              <a href="#" className="link-accent"
                 onClick={(e) => { e.preventDefault(); setMode('login') }}>Login</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
