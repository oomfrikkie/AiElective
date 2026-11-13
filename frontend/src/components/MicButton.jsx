import { useState, useEffect } from 'react'
import useRecorder from '../hooks/useRecorder'

const MAX_SECONDS = 20

export default function MicButton({ onAudio, disabled }) {
  const { recording, error, liveText, liveError, start, stop } = useRecorder()
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!recording) return
    setSeconds(0)
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) finish()
  }, [seconds])

  async function finish() {
    const result = await stop()
    if (result) onAudio(result.audio, result.transcript)
  }

  return (
    <div className="mic-row">
      <button
        className={`mic-btn ${recording ? 'recording' : ''}`}
        onClick={recording ? finish : start}
        disabled={disabled && !recording}
      >
        {recording ? `■ Stop (${seconds}s)` : '🎤 Tap to speak'}
      </button>
      {recording && liveText && <span className="live-text">{liveText}</span>}
      {error && <span className="error mic-error">{error}</span>}
      {liveError && <span className="voice-hint">{liveError}</span>}
    </div>
  )
}
