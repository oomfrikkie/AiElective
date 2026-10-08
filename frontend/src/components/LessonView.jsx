import { useState } from 'react'

export default function LessonView({ lesson, onSubmit, loading }) {
  const [roundIndex, setRoundIndex] = useState(0)
  const [answers, setAnswers] = useState({})

  const groups = lesson.groups
  const group = groups[roundIndex]
  const isLastRound = roundIndex === groups.length - 1
  const roundAnswered = group.every(w => answers[w.word])

  function pick(word, article) {
    setAnswers(prev => ({ ...prev, [word]: article }))
  }

  function next() {
    if (isLastRound) {
      const allWords = groups.flat()
      onSubmit(allWords.map(w => ({ word: w.word, guess: answers[w.word] })))
    } else {
      setRoundIndex(i => i + 1)
    }
  }

  const progress = ((roundIndex) / groups.length) * 100

  return (
    <div>
      <div className="header">
        <h1>De or het?</h1>
        <span className="header-sub">Lesson {lesson.lesson_number}</span>
      </div>

      <div className="progress">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="card">
        <h3>Round {roundIndex + 1} of {groups.length}</h3>

        {group.map(({ word, english }) => (
          <div key={word} className="word-row">
            <span className="word-label">
              ___ {word} <em>({english})</em>
            </span>
            <button
              className={`article-btn ${answers[word] === 'de' ? 'selected-de' : ''} ${answers[word] === 'het' ? 'faded' : ''}`}
              onClick={() => pick(word, 'de')}
            >
              de
            </button>
            <button
              className={`article-btn ${answers[word] === 'het' ? 'selected-het' : ''} ${answers[word] === 'de' ? 'faded' : ''}`}
              onClick={() => pick(word, 'het')}
            >
              het
            </button>
          </div>
        ))}
      </div>

      {lesson.last_wrong_count > 0 && roundIndex === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
          {lesson.last_wrong_count} words from last time are included.
        </p>
      )}

      <button
        className="btn"
        onClick={next}
        disabled={!roundAnswered || loading}
      >
        {loading ? 'Submitting...' : isLastRound ? 'Submit' : 'Next round →'}
      </button>
    </div>
  )
}
