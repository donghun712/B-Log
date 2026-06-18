import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeLocalDatabase } from './lib/db.ts'
import { registerServiceWorker } from './pwa.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
initializeLocalDatabase().catch((error: unknown) => {
  console.error('Failed to initialize local database', error)
})
