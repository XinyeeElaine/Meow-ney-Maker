import { useState } from 'react'
import { Pix, iconSvg } from './pixel.jsx'

// type="password" toggling to "text" is the whole trick — the input keeps its
// identity, so browser password managers still recognise the field.
export default function PasswordField({ value, onChange, label = 'Password', autoComplete }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="input-group">
      <label><Pix name="lock" /> {label}</label>
      <div className="pw-wrap">
        <input type={shown ? 'text' : 'password'} value={value} onChange={onChange}
               placeholder="••••••••" autoComplete={autoComplete} />
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
