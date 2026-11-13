export default function ResultsView({ results, onNext }) {
  const { score, total, previous, fixed, stillWrong, mistakes } = results
  const diff = previous !== null ? score - previous : null
  const perfect = mistakes.length === 0

  return (
    <div>
      <div className="header">
        <h1>Results</h1>
      </div>

      <div className="score-banner">
        <span className="score-big">{score}<span style={{ fontSize: '1.2rem', fontWeight: 400, color: '#888' }}>/{total}</span></span>
        {diff !== null && (
          <span className={`score-delta ${diff >= 0 ? 'up' : 'down'}`}>
            {diff >= 0 ? '+' : ''}{diff} vs last lesson
          </span>
        )}
      </div>

      {(fixed.length > 0 || stillWrong.length > 0) && (
        <div className="tags">
          {fixed.map(w => <span key={w} className="tag green">✓ {w}</span>)}
          {stillWrong.map(w => <span key={w} className="tag orange">↻ {w}</span>)}
        </div>
      )}

      {perfect ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.1rem' }}>Perfect round.</p>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.4rem' }}>Next lesson will be all new words.</p>
        </div>
      ) : (
        <div className="card">
          <h3>Mistakes — coming back next lesson</h3>
          {mistakes.map(m => (
            <div key={m.word} className="mistake">
              <div className="mistake-word">
                {m.article} {m.word}
                <span>({m.english}) · you guessed {m.guess}</span>
              </div>
              {m.aiHint && (
                <p className="hint-line">Pattern AI: {m.aiHint}</p>
              )}
              {m.teacherTip && (
                <p className="hint-line">Teacher: {m.teacherTip}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <button className="btn" onClick={onNext}>Next lesson →</button>
    </div>
  )
}
