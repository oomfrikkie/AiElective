import { useState } from 'react'

const KEY = 'hettie-mode'

// Text / Voice mode, remembered across pages and visits.
export function useMode() {
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem(KEY) || 'text' } catch { return 'text' }
  })

  function setMode(m) {
    setModeState(m)
    try { localStorage.setItem(KEY, m) } catch { /* storage unavailable */ }
  }

  return [mode, setMode]
}

export default function ModeSwitch({ mode, onChange }) {
  return (
    <div className="mode-switch">
      {['text', 'voice'].map(m => (
        <button
          key={m}
          className={`mode-option ${mode === m ? 'active' : ''}`}
          onClick={() => onChange(m)}
        >
          {m === 'text' ? 'Text' : 'Voice'}
        </button>
      ))}
    </div>
  )
}

export function VoicePicker({ voices, voice, onChange }) {
  if (voices.length < 2) return null
  return (
    <select
      className="voice-picker"
      value={voice}
      onChange={e => onChange(e.target.value)}
      aria-label="Dutch voice"
    >
      {voices.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  )
}
