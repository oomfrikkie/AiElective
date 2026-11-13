import { useState, useRef, useEffect } from 'react'
import { fetchScenarios, sendConversationTurn, transcribeAudio } from '../api'
import ModeSwitch, { useMode, VoicePicker } from '../components/ModeSwitch'
import MicButton from '../components/MicButton'
import useSpeech from '../hooks/useSpeech'
import { useAuth, useSetting } from '../auth/AuthContext'
import { fetchCompletionSummary, saveCompletion } from '../userApi'

export default function Conversation() {
  const { user } = useAuth()
  const [level, setLevel] = useSetting('conversationLevel', 'hettie-conversation-level', 'A1')
  const [levels, setLevels] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [scenario, setScenario] = useState(null)
  const [error, setError] = useState(null)
  const [completed, setCompleted] = useState(new Set())

  // Which scenarios this learner already finished (only with an account).
  useEffect(() => {
    if (!user || scenario) return
    fetchCompletionSummary()
      .then(rows => setCompleted(new Set(rows.map(r => `${r.level}-${r.scenarioId}`))))
      .catch(() => {})
  }, [user, scenario])

  useEffect(() => {
    setError(null)
    fetchScenarios(level)
      .then(data => { setLevels(data.levels); setScenarios(data.scenarios) })
      .catch(() => setError('Could not connect to the backend.'))
  }, [level])

  if (error) return <p className="error">{error}</p>
  if (scenario) return <ConversationChat level={level} scenario={scenario} onBack={() => setScenario(null)} />

  return (
    <div>
      <div className="header">
        <h1>Conversation</h1>
        <span className="header-sub">Practise real situations in Dutch</span>
      </div>

      <div className="level-tabs">
        {levels.map(l => (
          <button
            key={l.level}
            className={`level-tab ${l.level === level ? 'active' : ''}`}
            disabled={!l.available}
            onClick={() => setLevel(l.level)}
          >
            {l.level}{!l.available && <span> soon</span>}
          </button>
        ))}
      </div>

      <div className="scenario-grid">
        {scenarios.map(s => (
          <button key={s.id} className="card scenario-card" onClick={() => setScenario(s)}>
            <div className="scenario-title">
              {s.title}
              {completed.has(`${level}-${s.id}`) && <span className="tag green done-tag">✓ Done</span>}
            </div>
            <div className="scenario-sub">{s.title_en}</div>
            <p className="scenario-desc">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function ConversationChat({ level, scenario, onBack }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [goalReached, setGoalReached] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [mode, setMode] = useMode()
  const { speak, stop, voices, voice, setVoice } = useSpeech()
  const bottomRef = useRef(null)
  // Bumped on every (re)start and when leaving, so replies to an old start are ignored.
  // React's development mode runs the start-up effect twice, which otherwise shows two greetings.
  const session = useRef(0)
  const saved = useRef(false)

  useEffect(() => {
    start()
    return () => { session.current++ }
  }, [scenario.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // The learner's newest bubble is marked `awaiting` until the reply arrives. With audio,
  // that bubble is replaced by the audio in the request.
  async function takeTurn(history, audio, transcript) {
    const id = session.current
    setLoading(true)
    try {
      const sent = audio ? history.slice(0, -1) : history
      const turn = await sendConversationTurn(
        level, scenario.id, sent.map(({ role, text }) => ({ role, text })), audio, transcript
      )
      if (id !== session.current) return
      // Feedback is about the learner's last message, so attach it to that bubble.
      setMessages(prev => [
        ...prev.map(m => !m.awaiting ? m : {
          ...m,
          text: m.placeholder ? turn.transcript || '(not understood)' : m.text,
          placeholder: false,
          awaiting: false,
          feedback: turn.feedback,
          pronunciation: turn.pronunciation,
        }),
        { role: 'ai', text: turn.dutch, english: turn.english },
      ])
      setDone(turn.goal_complete)
      setGoalReached(turn.goal_reached)
      if (turn.goal_complete) recordCompletion(history, turn)
      if (mode === 'voice') speak(turn.dutch)
    } catch {
      if (id !== session.current) return
      setMessages(prev => [
        ...prev.filter(m => !(m.awaiting && audio)).map(({ awaiting, ...m }) => m),
        { role: 'ai', text: 'Something went wrong. Try again.', error: true },
      ])
    } finally {
      if (id === session.current) setLoading(false)
    }
  }

  // Saved once per run to the learner's account, with how many messages it took.
  function recordCompletion(history, lastTurn) {
    if (!user || saved.current) return
    saved.current = true
    const answers = history.filter(m => m.role === 'user')
    const corrections = answers.filter(m => m.feedback && /^(You said|Better|That wasn't Dutch)/.test(m.feedback)).length
      + (/^(You said|Better|That wasn't Dutch)/.test(lastTurn.feedback || '') ? 1 : 0)
    saveCompletion({
      level,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      turns: Math.max(1, answers.length),
      corrections,
    }).catch(() => { saved.current = false })
  }

  function start() {
    session.current++
    saved.current = false
    stop()
    setDone(false)
    setGoalReached(false)
    setMessages([])
    takeTurn([])
  }

  function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const history = [...messages.filter(m => !m.error), { role: 'user', text, awaiting: true }]
    setMessages(history)
    takeTurn(history)
  }

  // The voice is transcribed once (live by the browser, or else by a quick Gemini call)
  // and that text is what the learner sees AND what Hettie corrects.
  async function sendVoice(audio, transcript) {
    stop()
    const id = session.current
    const voice = transcript
      ? { role: 'user', text: transcript, awaiting: true }
      : { role: 'user', text: '🎤 ...', placeholder: true, awaiting: true }
    const history = [...messages.filter(m => !m.error), voice]
    setMessages(history)

    if (!transcript) {
      setLoading(true)
      transcript = await transcribeAudio(audio).catch(() => '')
      if (id !== session.current) return
      if (transcript) {
        setMessages(prev => prev.map(m => m.placeholder ? { ...m, text: transcript, placeholder: false } : m))
      }
    }
    takeTurn(history, audio, transcript)
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
      <div className="convo-header">
        <div className="convo-topbar">
          <button className="link-btn" onClick={onBack}>← Scenarios</button>
          <div className="mode-controls">
            {mode === 'voice' && (
              <VoicePicker voices={voices} voice={voice} onChange={setVoice} />
            )}
            <ModeSwitch mode={mode} onChange={changeMode} />
          </div>
        </div>
        <div className="scenario-title">{scenario.title} <span className="scenario-sub">{level}</span></div>
        <p className="convo-goal"><strong>Goal:</strong> {scenario.goal}</p>
        <button className="link-btn" onClick={() => setShowHelp(h => !h)}>
          {showHelp ? 'Hide' : 'Show'} useful words & phrases
        </button>
        {showHelp && (
          <div className="convo-help">
            <div className="tags">
              {scenario.words.map(w => (
                <span key={w.word} className="tag word-tag">{w.article} {w.word} <em>{w.english}</em></span>
              ))}
            </div>
            {scenario.phrases.map(([nl, en]) => (
              <div key={nl} className="phrase"><strong>{nl}</strong> <em>{en}</em></div>
            ))}
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <Bubble key={i} message={m} onSpeak={speak} />
        ))}
        {loading && <div className="bubble ai typing">...</div>}
        {done && (
          <div className="convo-done">
            Goed gedaan! You completed this conversation.
            {!user && <div className="small muted">Log in on the Account page to keep track of the scenarios you finish.</div>}
            <div>
              <button className="btn" onClick={start}>Try again</button>{' '}
              <button className="btn" onClick={onBack}>Next scenario</button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {goalReached && !done && (
        <p className="goal-hint">Goal reached! Say goodbye or thank you in Dutch to finish the conversation.</p>
      )}
      <div className="chat-input-row">
        {mode === 'voice' ? (
          <>
            <MicButton onAudio={sendVoice} disabled={loading || done} />
          </>
        ) : (
          <>
            <textarea
              className="chat-input"
              rows={1}
              placeholder="Antwoord in het Nederlands..."
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

function Bubble({ message, onSpeak }) {
  const [showEnglish, setShowEnglish] = useState(false)

  if (message.role === 'user') {
    return (
      <>
        <div className={`bubble user ${message.placeholder ? 'typing' : ''}`}>{message.text}</div>
        {message.feedback && <div className="feedback">{message.feedback}</div>}
        {message.pronunciation && <div className="feedback pronunciation">🗣 {message.pronunciation}</div>}
      </>
    )
  }

  return (
    <div className="bubble ai">
      {message.text}
      {message.english && (
        <>
          <div className="bubble-actions">
            <button className="link-btn" onClick={() => onSpeak(message.text)}>🔊 Listen</button>
            <button className="link-btn" onClick={() => setShowEnglish(s => !s)}>
              {showEnglish ? 'Hide' : 'Translate'}
            </button>
          </div>
          {showEnglish && <div className="translation">{message.english}</div>}
        </>
      )}
    </div>
  )
}
