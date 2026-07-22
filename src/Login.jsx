import { useState } from 'react'
import { Pix } from './pixel.jsx'
import { supabase } from './supabase.js'
import { showAlert } from './dialog.js'

const NOT_CONFIGURED = 'Supabase not configured. Please contact administrator.'

// OAuth and recovery links must land back on this exact page. HashRouter puts the
// route after '#', which Supabase strips when it appends its own hash — so send
// users to the bare path and let the app route to the timer.
const redirectTo = () => window.location.origin + window.location.pathname

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
      return showAlert('Check your email to confirm your account, then log in.')
    }

    await supabase.from('user_preferences').insert([{
      user_id: data.user.id, salary: 0, hours_per_day: 8, days_per_month: 26, theme: 'midnight',
    }])
    await onAuthed(data.user)
    onClose()
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
            <div className="input-group">
              <label><Pix name="lock" /> Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••" />
            </div>
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
            <div className="input-group">
              <label><Pix name="lock" /> Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••" />
            </div>
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
