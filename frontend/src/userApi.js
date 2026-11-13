// Client for the NestJS user API (accounts, settings, lesson history).
// The AI features (chat, speech, conversation) talk to the Python service in api.js.
const BASE = (import.meta.env.VITE_USER_API_URL || 'http://localhost:3000').replace(/\/$/, '')
const TOKEN_KEY = 'hettie-token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable: the session lasts until the tab closes */ }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(method, path, body) {
  const token = getToken()
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Is the API running?', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Nest validation errors come as a list of messages.
    const message = Array.isArray(data.message) ? data.message.join('. ') : data.message
    throw new ApiError(message || 'Something went wrong', res.status)
  }
  return data
}

// ── Auth ──
export const register = (email, password, displayName) =>
  request('POST', '/auth/register', { email, password, displayName })
export const login = (email, password) => request('POST', '/auth/login', { email, password })

// ── Account ──
export const fetchMe = () => request('GET', '/users/me')
export const updateProfile = changes => request('PATCH', '/users/me', changes)
export const changePassword = (currentPassword, newPassword) =>
  request('PATCH', '/users/me/password', { currentPassword, newPassword })
export const updateSettings = changes => request('PATCH', '/users/me/settings', changes)
export const deleteAccount = password => request('DELETE', '/users/me', { password })

// ── De/het lessons ──
export const fetchLessonLevels = () => request('GET', '/lessons/levels')
export const startLesson = level => request('POST', '/lessons', { level })
export const submitLesson = (id, answers) => request('POST', `/lessons/${id}/submit`, { answers })
export const fetchLessons = (limit = 10) => request('GET', `/lessons?limit=${limit}`)
export const fetchLesson = id => request('GET', `/lessons/${id}`)
export const fetchLessonStats = () => request('GET', '/lessons/stats')

// ── Conversation practice ──
export const saveCompletion = completion => request('POST', '/conversations/completions', completion)
export const fetchCompletionSummary = () => request('GET', '/conversations/completions/summary')
