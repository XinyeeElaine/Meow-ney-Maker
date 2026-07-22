import { useRef, useState } from 'react'
import { Pix, iconSvg } from './pixel.jsx'
import { displayName, supabase } from './supabase.js'
import { showAlert, showConfirm, showDialog } from './dialog.js'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_NAME = 40

export default function Profile({ user, onClose, onLogout, onUser }) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(() => displayName(user))
  const fileInput = useRef(null)

  const avatar = user.user_metadata?.avatar_url
  const nameChanged = name.trim() !== displayName(user)

  async function saveMeta(patch) {
    const { data, error } = await supabase.auth.updateUser({ data: patch })
    if (error) return showAlert(error.message)
    onUser(data.user)
  }

  const saveAvatarUrl = (url) => saveMeta({ avatar_url: url })

  async function saveName() {
    setBusy(true)
    try {
      await saveMeta({ display_name: name.trim() })
    } finally {
      setBusy(false)
    }
  }

  async function pickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''                    // let the same file be picked again
    if (!file) return

    // Trust boundary: the bucket is public, so check before it leaves the browser.
    if (!file.type.startsWith('image/')) return showAlert('Please choose an image file.')
    if (file.size > MAX_BYTES) return showAlert('Image must be under 2 MB.')

    setBusy(true)
    try {
      // One fixed path per user, overwritten on each upload, so old pictures
      // don't pile up in the bucket.
      const path = `${user.id}/avatar`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) return showAlert(`Upload failed: ${error.message}`)

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Same URL every time, so bust the cache or the old picture keeps showing.
      await saveAvatarUrl(`${data.publicUrl}?v=${Date.now()}`)
    } finally {
      setBusy(false)
    }
  }

  // Closing is the only way to lose the typed name, so intercept every route out.
  // "Keep editing" is the cancel action, which Escape and a backdrop click also
  // resolve to — dismissing the warning can never be what discards the edit.
  async function requestClose() {
    if (!nameChanged) return onClose()
    const discard = await showDialog({
      title: 'Unsaved changes',
      message: `Your display name hasn't been saved yet. Close anyway?`,
      cat: true,
      okText: 'Discard',
      cancelText: 'Keep editing',
    })
    if (discard) onClose()
  }

  async function logout() {
    if (!await showConfirm('Log out of your account?')) return
    if (supabase) await supabase.auth.signOut()
    onLogout()
    location.reload()
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}
         onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="modal-content settings-panel">
        <span className="close-btn" onClick={requestClose}>&times;</span>

        <div className="settings-header">
          <h2><Pix name="user" /> Profile</h2>
          <div className="avatar-center">
            {avatar
              ? <img src={avatar} className="avatar" alt="Your profile picture" />
              : <div className="avatar avatar-blank"
                     dangerouslySetInnerHTML={{ __html: iconSvg('user') }} />}
          </div>
          <div className="avatar-edit">
            <button className="link-accent link-btn" disabled={busy}
                    title="JPG or PNG, up to 2 MB"
                    onClick={() => fileInput.current.click()}>
              {busy ? 'Uploading…' : (avatar ? 'Edit picture or avatar' : 'Add picture or avatar')}
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>

        <section className="settings-section">
          <div className="section-head">Your Account</div>
          <div className="setting-row">
            <div className="setting-text" style={{ flex: 1, minWidth: 0 }}>
              <span className="setting-label">Display name</span>
              <input className="row-input" value={name} maxLength={MAX_NAME}
                     placeholder="Your name"
                     onChange={(e) => setName(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && nameChanged && saveName()} />
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-label"><Pix name="mail" /> Email</span>
              <span className="setting-hint">{user.email}</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <button className="btn btn-start" style={{ width: '100%' }}
                  disabled={busy || !nameChanged} onClick={saveName}>Save</button>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={logout}>
            <Pix name="logout" /> Log out
          </button>
        </section>
      </div>
    </div>
  )
}
