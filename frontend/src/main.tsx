import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { OptimizationRunsProvider } from './api/OptimizationRunsProvider'
import { AuthProvider } from './auth/AuthProvider'
import { TooltipProvider } from './components/ui/tooltip'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OptimizationRunsProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </OptimizationRunsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
