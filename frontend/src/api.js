// The Python AI service (chat, speech, conversation practice).
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export async function fetchNewLesson(level = 'A1') {
  const res = await fetch(`${BASE}/lesson/new?level=${level}`)
  if (!res.ok) throw new Error('Failed to fetch lesson')
  return res.json()
}

export async function submitLesson(answers) {
  const res = await fetch(`${BASE}/lesson/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })
  if (!res.ok) throw new Error('Failed to submit lesson')
  return res.json()
}

export async function sendChatMessage(message, history = []) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}

export async function fetchVoices() {
  const res = await fetch(`${BASE}/speak/voices`)
  if (!res.ok) throw new Error('Failed to fetch voices')
  return (await res.json()).voices
}

// Returns a WAV blob of the text read aloud in Dutch.
export async function fetchSpeech(text, voice, dutchOnly = true) {
  const res = await fetch(`${BASE}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, dutch_only: dutchOnly }),
  })
  if (!res.ok) throw new Error('Failed to fetch speech')
  return res.blob()
}

export async function transcribeAudio(audio) {
  const res = await fetch(`${BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio }),
  })
  if (!res.ok) throw new Error('Failed to transcribe')
  return (await res.json()).transcript
}

export async function fetchScenarios(level = 'A1') {
  const res = await fetch(`${BASE}/conversation/scenarios?level=${level}`)
  if (!res.ok) throw new Error('Failed to fetch scenarios')
  return res.json()
}

export async function sendConversationTurn(level, scenarioId, history, audio = null, transcript = '') {
  const res = await fetch(`${BASE}/conversation/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, scenario_id: scenarioId, history, audio, transcript }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}
