import { useState, useRef, useEffect } from 'react'

const SAMPLE_RATE = 16000

// Browsers record webm (Chrome) or mp4 (Safari); convert to 16 kHz mono WAV,
// which Gemini always accepts.
async function toWav(blob) {
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  ctx.close()

  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const samples = (await offline.startRendering()).getChannelData(0)

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  return view.buffer
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const Recognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

// Live browser speech-to-text, so the learner sees their words instantly.
// Gemini still gets the audio for the reply and pronunciation feedback.
function startRecognition(onText, onError) {
  if (!Recognition) return null
  const r = new Recognition()
  r.lang = 'nl-NL'
  r.continuous = true
  r.interimResults = true
  r.onresult = e => onText([...e.results].map(res => res[0].transcript).join(' ').trim())
  r.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') onError(e.error) }
  try { r.start() } catch { return null }
  return r
}

// Wait (briefly) for the last words to come in after stopping.
function stopRecognition(r) {
  if (!r) return Promise.resolve()
  return new Promise(resolve => {
    const timer = setTimeout(resolve, 800)
    r.onend = () => { clearTimeout(timer); resolve() }
    r.stop()
  })
}

export default function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const [liveText, setLiveText] = useState('')
  const [liveError, setLiveError] = useState(
    Recognition ? null : 'Live captions are not supported in this browser (use Chrome, Edge or Safari).'
  )
  const rec = useRef(null)
  const textRef = useRef('')

  // Leaving the page mid-recording releases the mic.
  useEffect(() => () => {
    if (!rec.current) return
    const { recorder, stream, recognition } = rec.current
    rec.current = null
    recorder.onstop = null
    if (recorder.state !== 'inactive') recorder.stop()
    stream.getTracks().forEach(t => t.stop())
    recognition?.abort()
  }, [])

  async function start() {
    setError(null)
    setLiveText('')
    textRef.current = ''
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.start()
      const recognition = startRecognition(
        text => { textRef.current = text; setLiveText(text) },
        code => setLiveError(`Live captions unavailable in this browser (${code}); your words appear a moment after you stop.`),
      )
      rec.current = { recorder, stream, chunks, recognition }
      setRecording(true)
    } catch {
      setError('Microphone not available. Allow mic access in your browser.')
    }
  }

  // Resolves with { audio: {data: base64 WAV, mime_type}, transcript } or null if nothing
  // was recorded. transcript is '' when the browser has no speech recognition.
  function stop() {
    if (!rec.current) return Promise.resolve(null)
    const { recorder, stream, chunks, recognition } = rec.current
    rec.current = null
    setRecording(false)

    const audio = new Promise(resolve => {
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        try {
          const wav = await toWav(new Blob(chunks, { type: recorder.mimeType }))
          resolve({ data: toBase64(wav), mime_type: 'audio/wav' })
        } catch {
          setError('Could not process the recording. Try again.')
          resolve(null)
        }
      }
      recorder.stop()
    })

    return Promise.all([audio, stopRecognition(recognition)]).then(([a]) => {
      setLiveText('')
      return a && { audio: a, transcript: textRef.current }
    })
  }

  return { recording, error, liveText, liveError, start, stop }
}
