import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './query-client'
import { readStoredTheme } from './lib/site-theme'

function syncDocumentTheme() {
  const storedTheme = readStoredTheme()

  document.documentElement.classList.toggle(
    'dark',
    storedTheme === 'dark' ||
      (storedTheme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches),
  )
}

syncDocumentTheme()
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if (readStoredTheme() === 'system') syncDocumentTheme()
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
