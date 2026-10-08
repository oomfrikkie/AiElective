import { useState, useEffect } from 'react'
import LessonView from '../components/LessonView'
import ResultsView from '../components/ResultsView'
import { fetchNewLesson, submitLesson } from '../api'

export default function HetDe() {
  const [lesson, setLesson] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { startLesson() }, [])

  async function startLesson() {
    setLoading(true)
    setError(null)
    setResults(null)
    setLesson(null)
    try {
      const data = await fetchNewLesson()
      setLesson(data)
    } catch {
      setError('Could not connect to the backend.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(answers) {
    setLoading(true)
    try {
      const data = await submitLesson(answers)
      setResults(data)
    } catch {
      setError('Failed to submit answers.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !lesson && !results) return <p className="status">Loading lesson...</p>
  if (error) return <p className="error">{error}</p>

  if (results) return <ResultsView results={results} onNext={startLesson} />
  return <LessonView lesson={lesson} onSubmit={handleSubmit} loading={loading} />
}
