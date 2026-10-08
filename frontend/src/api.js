const BASE = import.meta.env.VITE_API_URL

export async function fetchNewLesson() {
  const res = await fetch(`${BASE}/lesson/new`)
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

export async function sendChatMessage(message) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}
