import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { startSky, startTooltips } from './pixel.jsx'
import './style.css'

startSky()
startTooltips()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* HashRouter, not BrowserRouter: GitHub Pages serves static files with no
        rewrite rule, so a hard refresh on /dashboard would 404. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
