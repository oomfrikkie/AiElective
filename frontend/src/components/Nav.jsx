import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/',            label: 'Home' },
  { to: '/het-de',      label: 'Het / De' },
  { to: '/conversation',label: 'Conversation' },
  { to: '/account',     label: 'Account' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="navbar">
        <span className="nav-brand">HettieAI</span>
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
