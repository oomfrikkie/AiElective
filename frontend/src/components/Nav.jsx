import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const links = [
  { to: '/',            label: 'Home' },
  { to: '/het-de',      label: 'Het / De' },
  { to: '/conversation',label: 'Conversation' },
  { to: '/account',     label: 'Account' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  return (
    <>
      <nav className="navbar">
        <span className="nav-brand">HettieAI</span>
        <NavLink to="/account" className="nav-user">{user ? user.displayName : 'Log in'}</NavLink>
        <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>

      {open && <div className="nav-overlay" onClick={() => setOpen(false)} />}

      <div className={`nav-drawer ${open ? 'open' : ''}`}>
        <button className="drawer-close" onClick={() => setOpen(false)}>✕</button>
        <ul>
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
