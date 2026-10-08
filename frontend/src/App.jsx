import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Home from './pages/Home'
import HetDe from './pages/HetDe'

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/het-de" element={<HetDe />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
