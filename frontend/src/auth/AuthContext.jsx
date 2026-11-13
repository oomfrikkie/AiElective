import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as userApi from '../userApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // True until we know whether a saved token is still valid.
  const [checking, setChecking] = useState(() => Boolean(userApi.getToken()))

  useEffect(() => {
    if (!userApi.getToken()) return
    userApi.fetchMe()
      .then(setUser)
      .catch(e => {
        // Expired or revoked token: forget it. Network errors keep it for next time.
        if (e.status === 401) userApi.setToken(null)
      })
      .finally(() => setChecking(false))
  }, [])

  const startSession = useCallback(({ accessToken, user }) => {
    userApi.setToken(accessToken)
    setUser(user)
    return user
  }, [])

  const login = useCallback(
    async (email, password) => startSession(await userApi.login(email, password)),
    [startSession],
  )

  const register = useCallback(
    async (email, password, displayName) =>
      startSession(await userApi.register(email, password, displayName)),
    [startSession],
  )

  const logout = useCallback(() => {
    userApi.setToken(null)
    setUser(null)
  }, [])

  // Optimistic: the UI changes at once, the server catches up.
  const saveSettings = useCallback(changes => {
    setUser(u => (u ? { ...u, settings: { ...u.settings, ...changes } } : u))
    return userApi.updateSettings(changes).catch(() => { /* kept locally until next save */ })
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, checking, login, register, logout, saveSettings }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/**
 * A preference that follows the learner: stored in their account when logged in,
 * otherwise in this browser only (so it still works for guests).
 * `key` is the settings field in the API, `localKey` the localStorage key for guests.
 */
export function useSetting(key, localKey, fallback) {
  const { user, saveSettings } = useAuth()
  const [local, setLocal] = useState(() => {
    try { return localStorage.getItem(localKey) || fallback } catch { return fallback }
  })

  const value = user?.settings?.[key] ?? local

  const setValue = useCallback(v => {
    setLocal(v)
    try { localStorage.setItem(localKey, v) } catch { /* storage unavailable */ }
    if (user) saveSettings({ [key]: v })
  }, [user, saveSettings, key, localKey])

  return [value, setValue]
}
