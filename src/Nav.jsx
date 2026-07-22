import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Pix, THEMES, iconSvg, triggerBonus } from './pixel.jsx'
import { displayName } from './supabase.js'

const TABS = [
  ['/', 'Timer'],
  ['/dashboard', 'Dashboard'],
  ['/diary', 'Diary'],
  ['/todo', 'To-Do'],
]

export default function Nav({ theme, onTheme, user, onLogin, onProfile }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <header className="top-nav">
        <div className="nav-left">
          <span className="logo-wrap">
            {/* BASE_URL, not "/favicon.png": the site is served from /Meow-ney-Maker/,
                and Vite only rewrites asset paths in index.html, never inside JS. */}
            <img src={`${import.meta.env.BASE_URL}favicon.png`}
                 className="nav-logo" alt="Meow-ney Maker logo"
                 onClick={triggerBonus} title="Bonus!" />
          </span>
          <span className="brand">Meow-ney Maker</span>
        </div>
        <nav className="nav-tabs">
          {TABS.map(([to, label]) => (
            <NavLink key={to} to={to} end
                     className={({ isActive }) => 'nav-tab' + (isActive ? ' active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-right">
          {user && displayName(user) && (
            <span className="nav-name" title={displayName(user)}>{displayName(user)}</span>
          )}
          {/* Signed in the button opens the profile panel, which owns logout. */}
          {user
            ? <button onClick={onProfile} title="Profile" aria-label="Profile"
                      className={'nav-btn-icon' + (user.user_metadata?.avatar_url ? ' nav-btn-avatar' : '')}>
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} className="nav-avatar" alt="" />
                  : <span dangerouslySetInnerHTML={{ __html: iconSvg('user') }} />}
              </button>
            : <button className="nav-btn-icon" onClick={onLogin}
                      title="Login" aria-label="Login"
                      dangerouslySetInnerHTML={{ __html: iconSvg('login') }} />}
          {/* svg goes straight into the button — wrapping it in <Pix> would let
              `.pix svg { width: 100% }` beat `.nav-btn-icon svg { width: 22px }`
              and shrink the icon to 1em. */}
          <button className="nav-btn-icon" onClick={() => setSettingsOpen(true)}
                  title="Settings" aria-label="Settings"
                  dangerouslySetInnerHTML={{ __html: iconSvg('settings') }} />
        </div>
      </header>

      {settingsOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }}
             onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
          <div className="modal-content settings-panel">
            <span className="close-btn" onClick={() => setSettingsOpen(false)}>&times;</span>
            <div className="settings-header">
              <h2><Pix name="settings" /> Settings</h2>
              <p className="settings-sub">Make the grind yours</p>
            </div>
            <section className="settings-section">
              <div className="section-head">Appearance</div>
              <div className="setting-row">
                <div className="setting-text">
                  <span className="setting-label">Theme</span>
                  <span className="setting-hint">{theme[0].toUpperCase() + theme.slice(1)}</span>
                </div>
                <div className="theme-dots">
                  {THEMES.map((t) => (
                    <button key={t} className={`theme-dot dot-${t}${t === theme ? ' active' : ''}`}
                            onClick={() => onTheme(t)} title={t} aria-label={`${t} theme`} />
                  ))}
                </div>
              </div>
            </section>
            <p className="settings-foot">· Meow-ney Maker ·</p>
          </div>
        </div>
      )}
    </>
  )
}
