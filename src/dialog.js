// In-page replacement for alert/confirm/prompt, ported from the original vanilla app.
// Deliberately imperative + promise-based rather than a React component: callers
// `await` a value inline, which React state would turn into a callback maze.
import { catPalette, iconSvg } from './pixel.jsx'

// Front-facing "questioning" cat — eyes look straight at the user.
const THINK_CAT_ROWS = [
  "                ",
  "   d         d   ",
  "  dwd       dwd ",
  "  dowd     dwod ",
  " dopowdddddwopod",
  " doppowwwwwoppod",
  " doooooooooooood",
  " doooooooooooood ",
  "doobbbooooobbbood ",
  "dobwwbbooobwwbbod",
  "dobwbbbooobwbbbod",
  "dobbbwbooobbbwbod",
  "doobbbooooobbbood",
  "dooooooopoooooood",
  " dooooopopoooood ",
  "  doooooooooood  ",
  "   ddddddddddd   ",
]

// 8-bit smiley cat: vertical bar eyes, whisker bars on the cheeks, omega mouth.
// Face mirrors about column 8, so a pixel at x pairs with one at 16 - x.
const HAPPY_CAT_ROWS = [
  "                ",
  "   d         d   ",
  "  dwd       dwd ",
  "  dowd     dwod ",
  " dopowdddddwopod",
  " doppowwwwwoppod",
  " doooooooooooood",
  " doooooooooooood ",
  "doooboooooooboood ",
  "doooboooooooboood",
  "doooboooooooboood",
  "doppoobobobooppod",
  "doooooobobooooood",
  "doooooooooooooood",
  " doooooooooooood ",
  "  doooooooooood  ",
  "   ddddddddddd   ",
]

const CATS = { think: THINK_CAT_ROWS, happy: HAPPY_CAT_ROWS }

function pixelSprite(rows, palette, widthPx) {
  const w = Math.max(...rows.map((r) => r.length))  // tolerate ragged rows so hand-edits don't clip
  let rects = ''
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === ' ') continue
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[c]}"/>`
    }
  })
  return `<svg viewBox="0 0 ${w} ${rows.length}" width="${widthPx}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">${rects}</svg>`
}

export function showDialog({ title = '', message = '', input = null, okText = 'OK', cancelText = null, cat = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.style.display = 'flex'

    const box = document.createElement('div')
    box.className = 'modal-content modal-small'

    if (title) {
      const h = document.createElement('h2')
      h.textContent = title
      box.appendChild(h)
    }
    if (message) {
      const p = document.createElement('p')
      p.style.margin = '10px 0 18px'
      p.textContent = message
      box.appendChild(p)
    }

    if (cat) {
      const wrap = document.createElement('div')
      wrap.style.cssText = 'display:flex;justify-content:center;margin:2px 0 16px;'
      // cat: true keeps the original questioning cat; cat: 'happy' picks another.
      wrap.innerHTML = pixelSprite(CATS[cat] || CATS.think, catPalette(), 120)
      box.appendChild(wrap)
    }

    let field = null
    if (input) {
      const group = document.createElement('div')
      group.className = 'input-group'           // reuse existing input styling
      field = document.createElement('input')
      field.type = input.type || 'text'
      field.placeholder = input.placeholder || ''

      if (field.type === 'password') {
        // No confirm field on this prompt, so let the user check what they typed.
        const wrap = document.createElement('div')
        wrap.className = 'pw-wrap'
        const toggle = document.createElement('button')
        toggle.type = 'button'
        toggle.className = 'pw-toggle'
        const paint = () => {
          const shown = field.type === 'text'
          toggle.innerHTML = iconSvg(shown ? 'eyeOff' : 'eye')
          toggle.title = shown ? 'Hide password' : 'Show password'
          toggle.setAttribute('aria-label', toggle.title)
        }
        toggle.onclick = () => { field.type = field.type === 'password' ? 'text' : 'password'; paint() }
        paint()
        wrap.appendChild(field)
        wrap.appendChild(toggle)
        group.appendChild(wrap)
      } else {
        group.appendChild(field)
      }
      box.appendChild(group)
    }

    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.gap = '10px'

    const close = (val) => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(val) }

    if (cancelText) {
      const cancel = document.createElement('button')
      cancel.className = 'btn'
      cancel.style.flex = '1'
      cancel.textContent = cancelText
      cancel.onclick = () => close(input ? null : false)
      row.appendChild(cancel)
    }
    const ok = document.createElement('button')
    ok.className = 'btn btn-start'
    ok.style.flex = '1'
    ok.style.width = 'auto'
    ok.textContent = okText
    ok.onclick = () => close(input ? field.value : true)
    row.appendChild(ok)

    box.appendChild(row)
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); ok.click() }
      else if (e.key === 'Escape') { close(input ? null : false) }
    }
    document.addEventListener('keydown', onKey)
    ;(field || ok).focus()
  })
}

// Non-blocking confirmation: nothing to await, the CSS animation removes it.
// `action` is an optional { label, onClick } — an Undo button inside the toast.
export const TOAST_MS = 2600            // must match the toastPop animation

export function showToast(message, action) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')       // announced without stealing focus
  el.textContent = message
  if (action) {
    el.classList.add('toast-with-action')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'toast-action'
    btn.textContent = action.label
    btn.onclick = () => { el.remove(); action.onClick() }
    el.append(' ', btn)
  }
  el.onanimationend = () => el.remove()
  document.body.appendChild(el)
}

export const showAlert = (message, title = '') => showDialog({ title, message, okText: 'OK' })
export const showConfirm = (message, title = '') =>
  showDialog({ title, message, cat: true, okText: 'Yes', cancelText: 'Cancel' })
export const showPrompt = (message, opts = {}) =>
  showDialog({
    message, cat: opts.cat || true,
    input: { type: opts.type || 'text', placeholder: opts.placeholder || '' },
    okText: 'OK', cancelText: 'Cancel',
  })
