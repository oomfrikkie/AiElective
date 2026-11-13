import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import * as userApi from '../userApi'
import { fetchVoices } from '../api'

export default function Account() {
  const { user, checking } = useAuth()
  if (checking) return <p className="status">Loading...</p>
  return user ? <Profile /> : <AuthForms />
}

// ── Not logged in ───────────────────────────────────────

function AuthForms() {
  const { login, register } = useAuth()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const isRegister = tab === 'register'
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isRegister) await register(form.email, form.password, form.displayName)
      else await login(form.email, form.password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function switchTab(t) {
    setTab(t)
    setError(null)
  }

  return (
    <div>
      <div className="header">
        <h1>Account</h1>
        <span className="header-sub">Save your progress</span>
      </div>

      <div className="level-tabs">
        <button className={`level-tab ${!isRegister ? 'active' : ''}`} onClick={() => switchTab('login')}>
          Log in
        </button>
        <button className={`level-tab ${isRegister ? 'active' : ''}`} onClick={() => switchTab('register')}>
          Sign up
        </button>
      </div>

      <form className="card form" onSubmit={submit}>
        {isRegister && (
          <label className="field">
            <span>Name</span>
            <input
              value={form.displayName}
              onChange={set('displayName')}
              maxLength={50}
              autoComplete="nickname"
              required
            />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            minLength={isRegister ? 8 : undefined}
            maxLength={72}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
          />
          {isRegister && <small className="muted">At least 8 characters.</small>}
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}
        </button>
      </form>

      <p className="muted small">
        The tutor chat and conversation practice work without an account. Your de/het lessons,
        conversation progress and settings are saved once you log in.
      </p>
    </div>
  )
}

// ── Logged in ───────────────────────────────────────────

function Profile() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState(null)
  const [lessons, setLessons] = useState([])
  const [conversations, setConversations] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([userApi.fetchLessonStats(), userApi.fetchLessons(5), userApi.fetchCompletionSummary()])
      .then(([s, l, c]) => { setStats(s); setLessons(l); setConversations(c) })
      .catch(e => setError(e.message))
  }, [])

  return (
    <div>
      <div className="header">
        <h1>Hoi, {user.displayName}</h1>
        <button className="link-btn" onClick={logout}>Log out</button>
      </div>

      {error && <p className="error">{error}</p>}
      {stats && <Progress stats={stats} />}
      {lessons.length > 0 && <RecentLessons lessons={lessons} />}
      <ConversationProgress conversations={conversations} />
      <Settings />
      <ProfileForm />
      <PasswordForm />
      <DangerZone />
    </div>
  )
}

function Progress({ stats }) {
  if (stats.totalLessons === 0) {
    return (
      <div className="card">
        <h3>De / het progress</h3>
        <p>No lessons yet.</p>
        <Link to="/het-de" className="btn">Start your first lesson</Link>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>De / het progress</h3>
      <div className="stat-row">
        <Stat value={stats.totalLessons} label={stats.totalLessons === 1 ? 'lesson' : 'lessons'} />
        <Stat value={`${stats.accuracy}%`} label="correct" />
        <Stat value={stats.levels.reduce((n, l) => n + l.wordsPracticed, 0)} label="words practised" />
      </div>

      {stats.levels.map(l => (
        <div key={l.level} className="level-progress">
          <div className="level-progress-head">
            <strong>{l.level}</strong>
            <span className="muted">
              {l.lessonsCompleted} {l.lessonsCompleted === 1 ? 'lesson' : 'lessons'} · best {l.bestScore}/{l.lessonSize}
              {' '}· last {l.lastScore}/{l.lessonSize}
            </span>
          </div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${l.accuracy}%` }} />
          </div>
        </div>
      ))}

      {stats.trickyWords.length > 0 && (
        <>
          <h3 className="sub-heading">Your tricky words</h3>
          <div className="tags">
            {stats.trickyWords.map(w => (
              <span key={`${w.level}-${w.word}`} className="tag orange">
                {w.article} {w.word} <em className="tag-count">{w.wrong}×</em>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function RecentLessons({ lessons }) {
  const [open, setOpen] = useState(null)
  const [details, setDetails] = useState({})

  async function toggle(id) {
    setOpen(o => (o === id ? null : id))
    if (!details[id]) {
      const lesson = await userApi.fetchLesson(id).catch(() => null)
      if (lesson) setDetails(d => ({ ...d, [id]: lesson }))
    }
  }

  return (
    <div className="card">
      <h3>Recent lessons</h3>
      {lessons.map(l => (
        <div key={l.id} className="history-row">
          <button className="history-head" onClick={() => toggle(l.id)}>
            <span>{l.level} · Lesson {l.lessonNumber}</span>
            <span className="muted">{formatDate(l.completedAt)}</span>
            <strong>{l.score}/{l.total}</strong>
          </button>
          {open === l.id && details[l.id] && (
            <div className="history-detail">
              {details[l.id].mistakes.length === 0 ? (
                <p className="muted">Perfect round, no mistakes.</p>
              ) : details[l.id].mistakes.map(m => (
                <div key={m.word} className="mistake">
                  <div className="mistake-word">
                    {m.article} {m.word}
                    <span>({m.english}) · you guessed {m.guess}</span>
                  </div>
                  {m.teacherTip && <p className="hint-line">Teacher: {m.teacherTip}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ConversationProgress({ conversations }) {
  return (
    <div className="card">
      <h3>Conversations completed</h3>
      {conversations.length === 0 ? (
        <>
          <p>None yet. Reach the goal of a scenario and say goodbye in Dutch to complete it.</p>
          <Link to="/conversation" className="btn">Practise a conversation</Link>
        </>
      ) : conversations.map(c => (
        <div key={`${c.level}-${c.scenarioId}`} className="history-head static">
          <span>{c.level} · {c.scenarioTitle}</span>
          <span className="muted">{c.timesCompleted}× · best {c.bestTurns} messages</span>
          <span className="tag green">✓</span>
        </div>
      ))}
    </div>
  )
}

function Settings() {
  const { user, saveSettings } = useAuth()
  const [voices, setVoices] = useState([])
  const s = user.settings

  useEffect(() => { fetchVoices().then(setVoices).catch(() => {}) }, [])

  return (
    <div className="card form">
      <h3>Settings</h3>
      <label className="field inline">
        <span>Answer by</span>
        <select value={s.mode} onChange={e => saveSettings({ mode: e.target.value })}>
          <option value="text">Text</option>
          <option value="voice">Voice</option>
        </select>
      </label>
      <label className="field inline">
        <span>Hettie's voice</span>
        <select value={s.voice} onChange={e => saveSettings({ voice: e.target.value })}>
          {(voices.length ? voices : [s.voice]).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <p className="muted small">Saved to your account, so they follow you to any device.</p>
    </div>
  )
}

function ProfileForm() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ displayName: user.displayName, email: user.email })
  const [status, setStatus] = useState(null)

  const changed = form.displayName.trim() !== user.displayName || form.email.trim().toLowerCase() !== user.email

  async function submit(e) {
    e.preventDefault()
    setStatus(null)
    try {
      setUser(await userApi.updateProfile({ displayName: form.displayName, email: form.email }))
      setStatus({ ok: true, text: 'Saved.' })
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>Profile</h3>
      <label className="field">
        <span>Name</span>
        <input value={form.displayName} maxLength={50} required
          onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={form.email} required
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </label>
      {status && <p className={status.ok ? 'success' : 'error'}>{status.text}</p>}
      <button className="btn" type="submit" disabled={!changed}>Save profile</button>
    </form>
  )
}

function PasswordForm() {
  const [form, setForm] = useState({ current: '', next: '' })
  const [status, setStatus] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setStatus(null)
    try {
      await userApi.changePassword(form.current, form.next)
      setForm({ current: '', next: '' })
      setStatus({ ok: true, text: 'Password changed.' })
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>Change password</h3>
      <label className="field">
        <span>Current password</span>
        <input type="password" value={form.current} autoComplete="current-password" required
          onChange={e => setForm(f => ({ ...f, current: e.target.value }))} />
      </label>
      <label className="field">
        <span>New password</span>
        <input type="password" value={form.next} minLength={8} maxLength={72} autoComplete="new-password" required
          onChange={e => setForm(f => ({ ...f, next: e.target.value }))} />
      </label>
      {status && <p className={status.ok ? 'success' : 'error'}>{status.text}</p>}
      <button className="btn" type="submit">Change password</button>
    </form>
  )
}

function DangerZone() {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function remove(e) {
    e.preventDefault()
    setError(null)
    try {
      await userApi.deleteAccount(password)
      logout()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card form danger">
      <h3>Delete account</h3>
      {!open ? (
        <button className="link-btn danger-text" onClick={() => setOpen(true)}>
          Delete my account and all my progress
        </button>
      ) : (
        <form onSubmit={remove}>
          <p className="small">This permanently deletes your account, lessons and progress. Enter your password to confirm.</p>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-danger" type="submit">Delete forever</button>{' '}
          <button className="link-btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
