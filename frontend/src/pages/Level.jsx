import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { exams as examsApi } from '../api';
import Navbar from '../components/Navbar';

const OPTION_LABELS = ['a', 'b', 'c', 'd'];
const OPTION_DISPLAY = { a: 'A', b: 'B', c: 'C', d: 'D' };

function QuestionCard({ question, index, selectedAnswer, onSelect, submitted, result }) {
  const options = [
    { key: 'a', text: question.option_a },
    { key: 'b', text: question.option_b },
    { key: 'c', text: question.option_c },
    { key: 'd', text: question.option_d },
  ];

  return (
    <div className="question-card">
      <div className="question-number">Question {index + 1}</div>
      <div className="question-text">{question.question_text}</div>
      <div className="options-list">
        {options.map(({ key, text }) => {
          let cls = '';
          if (submitted && result) {
            if (key === result.correct_answer) cls = 'correct';
            else if (key === selectedAnswer && key !== result.correct_answer) cls = 'incorrect';
          } else if (key === selectedAnswer) {
            cls = 'selected';
          }

          return (
            <button
              key={key}
              className={`option-btn ${cls}`}
              onClick={() => !submitted && onSelect(question.id, key)}
              disabled={submitted}
            >
              <span className="option-letter">{OPTION_DISPLAY[key]}</span>
              <span>{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultsView({ submission, exam, worldKey, levelNumber, onRetry }) {
  const navigate = useNavigate();
  const { score, total, passed, pass_threshold_pct, world_completed, results } = submission;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="results-card">
      <div className={`results-score-circle ${passed ? 'pass' : 'fail'}`}>
        {pct}%
      </div>
      <h2 className="results-title">
        {world_completed ? '🎉 World Complete!' : passed ? '✅ Level Passed!' : '❌ Not Quite'}
      </h2>
      <p className="results-subtitle">
        {passed
          ? world_completed
            ? `You've mastered all 10 levels in this world!`
            : `Score: ${score}/${total} — well above the ${pass_threshold_pct}% threshold.`
          : `Score: ${score}/${total} — need ${pass_threshold_pct}% to pass. Keep going!`
        }
      </p>

      <div className="results-breakdown">
        <div className="results-stat">
          <div className="results-stat-value" style={{ color: 'var(--green-light)' }}>{score}</div>
          <div className="results-stat-label">Correct</div>
        </div>
        <div className="results-stat">
          <div className="results-stat-value" style={{ color: '#fca5a5' }}>{total - score}</div>
          <div className="results-stat-label">Incorrect</div>
        </div>
        <div className="results-stat">
          <div className="results-stat-value">{pct}%</div>
          <div className="results-stat-label">Score</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        {!passed && (
          <button className="btn btn-violet" onClick={onRetry}>
            Try Again
          </button>
        )}
        {passed && !world_completed && (
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/exam/${exam}/world/${worldKey}/level/${levelNumber + 1}`)}
          >
            Next Level →
          </button>
        )}
        {world_completed && (
          <Link to={`/exam/${exam}`} className="btn btn-primary">
            Back to World Map 🗺️
          </Link>
        )}
        <Link to={`/exam/${exam}`} className="btn btn-ghost">
          World Map
        </Link>
      </div>

      {/* Answer breakdown */}
      {results && results.length > 0 && (
        <div className="results-answers">
          <p className="section-title" style={{ marginBottom: 12 }}>Answer Review</p>
          {results.map((r, i) => (
            <div key={r.question_id} className="results-answer-item">
              <span className="answer-icon">{r.is_correct ? '✅' : '❌'}</span>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)', marginRight: 8 }}>Q{i + 1}</span>
                <span>
                  Your answer: <strong>{r.your_answer ? r.your_answer.toUpperCase() : '—'}</strong>
                  {!r.is_correct && (
                    <span style={{ color: 'var(--green-light)', marginLeft: 8 }}>
                      Correct: <strong>{r.correct_answer.toUpperCase()}</strong>
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Level() {
  const { exam, worldKey, levelNumber } = useParams();
  const navigate = useNavigate();
  const levelNum = parseInt(levelNumber, 10);

  const [questions,   setQuestions]   = useState([]);
  const [answers,     setAnswers]     = useState({});  // { [question_id]: 'a'|'b'|'c'|'d' }
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submission,  setSubmission]  = useState(null);
  const [error,       setError]       = useState('');

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    setError('');
    setAnswers({});
    setSubmitted(false);
    setSubmission(null);

    examsApi.questions(exam, worldKey, levelNum)
      .then((data) => setQuestions(data.questions || []))
      .catch((err) => {
        const code = err?.error?.code;
        if (code === 'level_locked' || code === 'beyond_world2_trial_cap' || code === 'trial_expired') {
          // Redirect back to world map — backend said no
          navigate(`/exam/${exam}`, { replace: true });
        } else {
          setError(err?.error?.message || 'Failed to load questions.');
        }
      })
      .finally(() => setLoading(false));
  }, [exam, worldKey, levelNum, navigate]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleSelect = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: answer }));
  };

  const answeredCount = Object.keys(answers).length;
  const progress      = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await examsApi.submit(exam, worldKey, levelNum, answers);
      setSubmission(result);
      setSubmitted(true);
    } catch (err) {
      setError(err?.error?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-screen" style={{ minHeight: '80vh' }}>
          <div className="spinner" />
        </div>
      </>
    );
  }

  if (error && !submitted) {
    return (
      <>
        <Navbar />
        <div className="level-page">
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
          <Link to={`/exam/${exam}`} className="btn btn-ghost">← Back to World Map</Link>
        </div>
      </>
    );
  }

  if (submitted && submission) {
    // Build result lookup by question_id for the review
    const resultsMap = {};
    (submission.results || []).forEach((r) => { resultsMap[r.question_id] = r; });

    return (
      <>
        <Navbar />
        <div className="level-page">
          <ResultsView
            submission={submission}
            exam={exam}
            worldKey={worldKey}
            levelNumber={levelNum}
            onRetry={fetchQuestions}
          />
        </div>
      </>
    );
  }

  const worldLabel = worldKey.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <Navbar />
      <div className="level-page">
        {/* Header with back + progress */}
        <div className="level-header">
          <button className="btn-back" onClick={() => navigate(`/exam/${exam}`)}>
            ← World Map
          </button>
          <div className="level-progress-bar">
            <div className="level-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="level-counter">{answeredCount}/{questions.length}</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {worldLabel} — Level {levelNum}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {questions.length} questions · Answer all then submit
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Questions */}
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            selectedAnswer={answers[String(q.id)]}
            onSelect={handleSelect}
            submitted={false}
            result={null}
          />
        ))}

        {/* Submit */}
        <div style={{
          position: 'sticky',
          bottom: 24,
          background: 'var(--bg)',
          paddingTop: 12,
          paddingBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          {answeredCount < questions.length && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} unanswered — unanswered questions count as incorrect.
            </p>
          )}
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={submitting || questions.length === 0}
            style={{ minWidth: 200 }}
          >
            {submitting ? 'Submitting…' : 'Submit Answers'}
          </button>
        </div>
      </div>
    </>
  );
}