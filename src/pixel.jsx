// Pixel visuals + theme, ported from the original vanilla app.
// Sprite data and the sky canvas are unchanged — only the DOM plumbing is React now.

// ==========================================
//  THEME
// ==========================================
export const THEMES = ['midnight', 'peach', 'mint', 'lavender']

export function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'midnight'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  refreshSkyColors()
  return theme
}

export const currentTheme = () => localStorage.getItem('theme') || 'midnight'

// ==========================================
//  PIXEL NAV ICONS  (currentColor, theme-tinted)
// ==========================================
const PALETTE = {
  y: '#ffcf4d', o: '#ff8a3d', r: '#ff5a6e', g: '#5fd08a', b: '#5db0ff',
  p: '#ff9db0', w: '#fff3e6', k: '#4a3b52', n: '#ffb066',
}
const ICONS = {
  settings: ["........","..c.....","cccccccc","..c.....","........","....c...","cccccccc","....c..."],
  login:    ["..yyyy..","..y..y..","..y..y..","..yyyy..","...y....","...y....","...yy...","...y...."],
  logout:   ["c.......","c...c...","c....c..","c.ccccc.","c....c..","c...c...","c.......","c......."],
  coin:     ["..yyyy..",".ywwyyy.","yyyyyyyy","yyy..yyy","yyy..yyy","yyyyyyyy",".yyyyyy.","..yyyy.."],
  moneybag: ["...kk...","..yyyy..",".yyyyyy.","yyygggyy","yyyggyyy","yyyyggyy","yyygggyy",".yyyyyy."],
  clock:    ["..kkkk..",".kwwwwk.","kwwkwwwk","kwwkwwwk","kwwkkwwk","kwwwwwwk",".kwwwwk.","..kkkk.."],
  calendar: [".k....k.","rrrrrrrr","rrrrrrrr","wwwwwwww","wkkwkkww","wwwwwwww","wkkwkkww","wwwwwwww"],
  star:     ["...y....","..yyy...",".yyyyy..","yyyyyyyy",".yyyyy..","..yyy...","...y....","........"],
  fire:     ["...r....","...o....","..oo....","..ooo...",".ooyyo..",".oyyyo..","..ooo...","........"],
  cat:      ["n......n","np....pn","nnnnnnnn","nknnnnkn","nnnnnnnn","nnnppnnn","nnnnnnnn",".n....n."],
  chart:    ["........","......y.","....g.y.","....g.y.","..b.g.y.","..b.g.y.","p.b.g.y.","kkkkkkkk"],
  book:     [".rrrrrr.","rwwwwwr.","rwwwwwr.","rwwwwwr.","rwwwwwr.","rwwwwwr.","rwwwwwr.",".rrrrrr."],
  check:    [".......g","......gg",".....gg.","g...gg..","gg.gg...",".ggg....","..g.....","........"],
  cone:     ["...oo...","...yy...","..oooo..","..yyyy..",".oooooo.",".yyyyyy.","oooooooo","yyyyyyyy"],
  mail:     ["kkkkkkkk","kwwwwwwk","kkwwwwkk","kwkkkkwk","kwwwwwwk","kwwwwwwk","kkkkkkkk","........"],
  lock:     ["..kkk...",".k...k..",".k...k..","yyyyyyy.","yyykyyy.","yyykyyy.","yyyyyyy.","........"],
  list:     ["wwwwwwww","wkkkkkkw","wwwwwwww","wkkkkkww","wwwwwwww","wkkkkkkw","wwwwwwww","wkkkkkww"],
  rocket:   ["...r....","..rrr...","..rbr...","..www...","..www...",".rwwwr..",".r.w.r..","..o.o..."],
  cross:    ["r......r","rr....rr",".rr..rr.","..rrrr..","..rrrr..",".rr..rr.","rr....rr","r......r"],
  paw:      ["pp.pp.pp","pp.pp.pp","........",".pppppp.","pppppppp","pppppppp",".pppppp.","..pppp.."],
  google:   ["..bbbb..",".b....r.",".b......",".b..yyy.",".b....y.",".g....y.","..gggg..","........"],
  eye:      ["........","..kkkk..",".kwwwwk.","kwwkkwwk","kwwkkwwk",".kwwwwk.","..kkkk..","........"],
  eyeOff:   ["........","........","k......k",".kkkkkk.","k.k..k.k","........","........","........"],
}

export function iconSvg(name) {
  const rows = ICONS[name]
  if (!rows) return ''
  let rects = ''
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const fill = ch === 'c' ? 'currentColor' : (PALETTE[ch] || 'currentColor')
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  })
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
}

// Replaces the old <span class="pix" data-icon="..."> + renderIcons() pass.
export const Pix = ({ name }) => (
  <span className="pix" dangerouslySetInnerHTML={{ __html: iconSvg(name) }} />
)

// ==========================================
//  PIXEL CAT SPRITE
// ==========================================
const CAT_ROWS = [
  "      d       d        ",
  "     dd      dd        ",
  "    dod     dod        ",
  "   dpoodddddoopd       ",
  "   dppoooooooppd       ",
  "   doooooooooood       ",
  "   doooooooooood       ",
  "   dooowooowoood       ",
  " dddoooeoeoeoooddd     ",
  "   doooooooooood       ",
  "ddddooooooooooodddd    ",
  "    ddooooooodd    ddd ",
  "      doooood     doood",
  "      dooooood   dooood",
  "      doooooood dooddd ",
  "      doooooooodood    ",
  "      dooooooooood     ",
  "      doodoodooddd     ",
  "       dddddddddd      ",
]

// Fur + outline come from the active theme's CSS vars, so the cat recolors with the palette.
export function catPalette() {
  const s = getComputedStyle(document.documentElement)
  return {
    d: (s.getPropertyValue('--cat-dark') || '').trim() || '#cdbb98',
    o: (s.getPropertyValue('--cat-fur') || '').trim() || '#efe4cf',
    p: '#ff9db0', e: '#332f47', w: '#ffffff', b: '#332f47',
  }
}

function catSvg() {
  const palette = catPalette()
  let rects = ''
  CAT_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === ' ') continue
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[c]}"/>`
    }
  })
  return `<svg viewBox="0 0 ${CAT_ROWS[0].length} ${CAT_ROWS.length}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
}

// `theme` is only a prop so a palette switch forces a re-read of the CSS vars.
export const Cat = ({ theme }) => (
  <div className="cat-sprite" role="img" aria-label="Pixel cat"
       key={theme} dangerouslySetInnerHTML={{ __html: catSvg() }} />
)

// ==========================================
//  PIXEL SKY  (background canvas — clouds, sparkles, hearts)
// ==========================================
const PX = 4
let canvas, ctx
let clouds = [], sparkles = [], hearts = []
let skyColors = { cloud: '#fff7f0', spark: '#ffd98a', heart: '#ff9db0' }

export function refreshSkyColors() {
  const s = getComputedStyle(document.documentElement)
  skyColors = {
    cloud: (s.getPropertyValue('--cloud') || '#fff').trim(),
    spark: (s.getPropertyValue('--spark') || '#ffd98a').trim(),
    heart: (s.getPropertyValue('--heart') || '#ff9db0').trim(),
  }
}

const snap = (v) => Math.round(v / PX) * PX

function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  ctx.imageSmoothingEnabled = false
}

class Cloud {
  constructor(spawnLeft) {
    this.scale = Math.random() * 1.4 + 1.0
    this.speed = (Math.random() * 0.25 + 0.12) * this.scale
    this.y = Math.random() * canvas.height * 0.75
    this.alpha = Math.random() * 0.25 + 0.35
    this.rows = [[2, 4], [1, 6], [0, 8], [1, 6]]
    this.w = 8 * PX * this.scale
    this.x = spawnLeft ? -this.w : Math.random() * canvas.width
  }
  update() {
    this.x += this.speed
    if (this.x > canvas.width + this.w) { this.x = -this.w; this.y = Math.random() * canvas.height * 0.75 }
  }
  draw() {
    ctx.globalAlpha = this.alpha
    ctx.fillStyle = skyColors.cloud
    const b = PX * this.scale
    this.rows.forEach(([off, len], r) => {
      ctx.fillRect(snap(this.x + off * b), snap(this.y + r * b), len * b, b)
    })
  }
}

class Sparkle {
  constructor() { this.reset() }
  reset() {
    this.x = Math.random() * canvas.width
    this.y = Math.random() * canvas.height
    this.t = Math.random() * Math.PI * 2
    this.speed = Math.random() * 0.05 + 0.02
    this.big = Math.random() < 0.4
  }
  update() {
    this.t += this.speed
    if (this.t > Math.PI * 2) { this.t = 0; this.reset() }
  }
  draw() {
    const a = Math.sin(this.t)
    if (a <= 0) return
    ctx.globalAlpha = a * 0.9
    ctx.fillStyle = skyColors.spark
    const s = this.big ? PX : PX * 0.75
    const x = snap(this.x), y = snap(this.y)
    ctx.fillRect(x, y, s, s)
    ctx.fillRect(x - s, y, s, s)
    ctx.fillRect(x + s, y, s, s)
    ctx.fillRect(x, y - s, s, s)
    ctx.fillRect(x, y + s, s, s)
  }
}

class Heart {
  constructor() {
    this.x = Math.random() * canvas.width
    this.y = canvas.height + 10
    this.speed = Math.random() * 0.6 + 0.4
    this.sway = Math.random() * Math.PI * 2
    this.life = 1
    this.scale = Math.random() * 0.6 + 0.7
  }
  update() {
    this.y -= this.speed
    this.sway += 0.05
    this.x += Math.sin(this.sway) * 0.6
    if (this.y < canvas.height * 0.15) this.life -= 0.01
  }
  draw() {
    ctx.globalAlpha = Math.max(0, this.life) * 0.85
    ctx.fillStyle = skyColors.heart
    const b = PX * this.scale
    const x = snap(this.x), y = snap(this.y)
    const rows = ['01010', '11111', '11111', '01110', '00100']
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') ctx.fillRect(snap(x + c * b), snap(y + r * b), b, b)
      }
    })
  }
}

function initSky() {
  refreshSkyColors()
  clouds = []
  sparkles = []
  const cloudCount = Math.min(10, Math.floor(canvas.width / 220))
  for (let i = 0; i < cloudCount; i++) clouds.push(new Cloud(false))
  const sparkCount = Math.min(70, Math.floor((canvas.width * canvas.height) / 22000))
  for (let i = 0; i < sparkCount; i++) sparkles.push(new Sparkle())
}

// ponytail: fixed per-frame heart odds; good enough, no scheduler needed
function animateSky() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const c of clouds) { c.update(); c.draw() }
  for (const s of sparkles) { s.update(); s.draw() }
  if (Math.random() < 0.015 && hearts.length < 6) hearts.push(new Heart())
  for (let i = hearts.length - 1; i >= 0; i--) {
    hearts[i].update()
    hearts[i].draw()
    if (hearts[i].life <= 0 || hearts[i].y < -20) hearts.splice(i, 1)
  }
  ctx.globalAlpha = 1
  requestAnimationFrame(animateSky)
}

// ==========================================
//  BONUS SCENE — click the logo: it pops + coins shower down
// ==========================================
function coinShower() {
  const layer = document.createElement('div')
  layer.className = 'coin-shower'
  const coin = iconSvg('coin')
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('div')
    c.className = 'coin-drop'
    c.innerHTML = coin
    c.style.left = (Math.random() * 100) + 'vw'
    c.style.width = (Math.random() * 18 + 18) + 'px'
    c.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's'
    c.style.animationDuration = (Math.random() * 1.4 + 1.6).toFixed(2) + 's'
    layer.appendChild(c)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 3600)
}

let bonusActive = false
export function triggerBonus(e) {
  if (e) e.stopPropagation()
  if (bonusActive) return          // ignore clicks while a bonus is running
  bonusActive = true

  const big = document.createElement('img')
  big.src = `${import.meta.env.BASE_URL}favicon.png`
  big.className = 'logo-bonus'
  big.alt = ''
  document.body.appendChild(big)

  coinShower()
  setTimeout(() => { big.remove(); bonusActive = false }, 3000)
}

// ==========================================
//  PIXEL TOOLTIP  (one floating element; replaces native title= on hover)
//  Delegation + lazy title→data-tip swap covers static and dynamic elements.
// ==========================================
let tipStarted = false
export function startTooltips() {
  if (tipStarted) return
  tipStarted = true

  const tip = document.createElement('div')
  tip.className = 'pixel-tip'
  document.body.appendChild(tip)

  function place(el) {
    const r = el.getBoundingClientRect()
    const t = tip.getBoundingClientRect()
    let left = r.left + r.width / 2 - t.width / 2
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8))  // clamp to viewport
    let top = r.top - t.height - 8
    if (top < 8) top = r.bottom + 8                                      // flip below if no room above
    tip.style.left = left + 'px'
    tip.style.top = top + 'px'
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip], [title]')
    if (!el) return
    if (el.hasAttribute('title')) {   // move it so the browser stops showing its own tooltip
      el.setAttribute('data-tip', el.getAttribute('title'))
      el.removeAttribute('title')
    }
    tip.textContent = el.getAttribute('data-tip')
    tip.classList.add('show')
    place(el)
  })
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tip]')) tip.classList.remove('show')
  })
  document.addEventListener('click', () => tip.classList.remove('show'))
}

// Called once from main.jsx. Guarded so Vite's HMR re-running the module
// cannot stack a second canvas and a second rAF loop on top of the first.
export function startSky() {
  if (canvas) return
  canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100vw', height: '100vh', zIndex: '-1', pointerEvents: 'none',
  })
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  resizeCanvas()
  initSky()
  window.addEventListener('resize', () => { resizeCanvas(); initSky() })
  animateSky()
}
