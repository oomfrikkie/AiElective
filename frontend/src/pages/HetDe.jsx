import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import LessonView from '../components/LessonView'
import ResultsView from '../components/ResultsView'
import { startLesson, submitLesson } from '../userApi'
import { useAuth, useSetting } from '../auth/AuthContext'

export default function HetDe() {
  const { user, checking } = useAuth()

  if (checking) return <p className="status">Loading...</p>
  if (!user) return <LoginPrompt />
  return <Lessons key={user.id} />
}

// Lessons are saved per learner (mistakes come back, progress is tracked), so they need an account.
function LoginPrompt() {
  return (
    <div>
      <div className="header">
        <h1>De or het?</h1>
      </div>
      <div className="card prompt-card">
        <p>Log in to start your de/het lessons.</p>
        <p className="muted">
          Your answers are saved to your account, so the words you get wrong come back next
          time and you can follow your progress on any device.
        </p>
        <Link to="/account" className="btn">Log in or sign up</Link>
      </div>
    </div>
  )
}

function Lessons() {
  const [lesson, setLesson] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [level, setLevel] = useSetting('lessonLevel', 'hettie-lesson-level', 'A1')
  // Only the newest request may update the page (fast level switching, React dev mode).
  const latest = useRef(0)

  useEffect(() => { begin() }, [level])

  async function begin() {
    const id = ++latest.current
    setLoading(true)
    setError(null)
    setResults(null)
    setLesson(null)
    try {
      const lesson = await startLesson(level)
      if (id === latest.current) setLesson(lesson)
    } catch (e) {
      if (id !== latest.current) return
      // A level that no longer exists (e.g. saved from elsewhere): fall back to A1.
      if (e.status === 404 && level !== 'A1') return setLevel('A1')
      setError(e.message || 'Could not load a lesson.')
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }

  async function handleSubmit(answers) {
    setLoading(true)
    setError(null)
    try {
      setResults(await submitLesson(lesson.id, answers))
    } catch (e) {
      setError(e.message || 'Failed to submit answers.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !lesson && !results) return <p className="status">Loading lesson...</p>
  if (error && !lesson) {
    return (
      <div className="card prompt-card">
        <p className="error">{error}</p>
        <button className="btn" onClick={begin}>Try again</button>
      </div>
    )
  }

  if (results) return <ResultsView results={results} onNext={begin} />
  return (
    <>
      <div className="level-tabs">
        {lesson.levels.map(l => (
          <button
            key={l}
            className={`level-tab ${l === level ? 'active' : ''}`}
            onClick={() => setLevel(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <LessonView key={lesson.id} lesson={lesson} onSubmit={handleSubmit} loading={loading} />
      {error && <p className="error">{error}</p>}
    </>
  )
}
