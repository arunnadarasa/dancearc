import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './polyfills'
import './index.css'
import App from './App.tsx'
import BattleApp from './BattleApp.tsx'
import CoachingApp from './CoachingApp.tsx'
import BeatsApp from './BeatsApp.tsx'
import ExtraDanceApp from './ExtraDanceApp.tsx'
import BridgeApp from './BridgeApp.tsx'

const path = window.location.pathname

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/battle' ? (
      <BattleApp />
    ) : path === '/coaching' ? (
      <CoachingApp />
    ) : path === '/beats' ? (
      <BeatsApp />
    ) : path === '/dance-extras' || path.startsWith('/dance-extras/') ? (
      <ExtraDanceApp />
    ) : path === '/bridge' ? (
      <BridgeApp />
    ) : (
      <App />
    )}
  </StrictMode>,
)
