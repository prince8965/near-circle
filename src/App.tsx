import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './hooks/AppContext'
import { AuthProvider } from './hooks/AuthContext'
import { ToastProvider } from './hooks/ToastContext'
import { AppRoutes } from './routes/AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
