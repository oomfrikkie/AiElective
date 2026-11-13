import { useState, useRef, useEffect } from 'react'
import { sendChatMessage, transcribeAudio } from '../api'
import ModeSwitch, { useMode, VoicePicker } from '../components/ModeSwitch'
import MicButton from '../components/MicButton'
import useSpeech from '../hooks/useSpeech'

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hoi! I\'m Hettie, your Dutch tutor. Ask me anything about Dutch vocabulary, grammar, pronunciation, or de/het rules.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useMode()
  // Explanations are in English with Dutch examples, so the voice switches language itself.
  const { speak, stop, voices, voice, setVoice } = useSpeech({ dutchOnly: false })
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    ask({ role: 'user', text }, text)
  }

  // The tutor chat has no pronunciation feedback, so the voice is transcribed once
  // (live by the browser, or else by a quick Gemini call) and sent as normal text.
  async function sendVoice(audio, transcript) {
    stop()
    if (!transcript) {
      const placeholder = { role: 'user', text: '🎤 ...', placeholder: true }
      setMessages(prev => [...prev, placeholder])
      setLoading(true)
      transcript = await transcribeAudio(audio).catch(() => '')
      setLoading(false)
      setMessages(prev => prev.filter(m => m !== placeholder))
    }
    if (transcript) ask({ role: 'user', text: transcript }, transcript)
    else setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't hear that. Try again." }])
  }

  async function ask(userMessage, text) {
    const history = messages.map(({ role, text }) => ({ role, text }))
    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    try {
      const data = await sendChatMessage(text, history)
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }])
      if (mode === 'voice') speak(data.reply)
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }


  function changeMode(m) {
    setMode(m)
    if (m === 'text') stop()
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-topbar mode-controls">
        {mode === 'voice' && (
          <VoicePicker voices={voices} voice={voice} onChange={setVoice} />
        )}
        <ModeSwitch mode={mode} onChange={changeMode} />
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.placeholder ? 'typing' : ''}`}>
            {m.text}
            {m.role === 'ai' && i > 0 && (
              <div className="bubble-actions">
                <button className="link-btn" onClick={() => speak(m.text)}>🔊 Listen</button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="bubble ai typing">...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        {mode === 'voice' ? (
          <>
            <MicButton onAudio={sendVoice} disabled={loading} />
          </>
        ) : (
          <>
            <textarea
              className="chat-input"
              rows={1}
              placeholder="Ask your Dutch tutor..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="btn" onClick={send} disabled={!input.trim() || loading}>
              Send
            </button>
          </>
        )}
      </div>
    </div>
  )
}
