import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Home from './pages/Home'
import HetDe from './pages/HetDe'
import Conversation from './pages/Conversation'

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/het-de" element={<HetDe />} />
          <Route path="/conversation" element={<Conversation />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
