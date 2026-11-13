import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Nav from './components/Nav'
import Home from './pages/Home'
import HetDe from './pages/HetDe'
import Conversation from './pages/Conversation'
import Account from './pages/Account'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/het-de" element={<HetDe />} />
            <Route path="/conversation" element={<Conversation />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<p className="status">Page not found.</p>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}
