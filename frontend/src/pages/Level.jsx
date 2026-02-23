import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';

const TIMER_SECONDS = 60;
const ADVANCE_DELAY = 700; // ms after selecting before moving to next question

// ── Circular timer ────────────────────────────────────────────────────────────
function CircularTimer({ secondsLeft, total }) {
  const radius  = 36;
  const stroke  = 4;
  const norm    = radius - stroke / 2;
  const circum  = 2 * Math.PI * norm;
  const frac    = secondsLeft / total;
  const dash    = frac * circum;

  // green → amber → red
  const color =
    frac > 0.5 ? '#22c55e' :
    frac > 0.25 ? '#f59e0b' :
    '#ef4444';

  const urgent = secondsLeft <= 10;

  return (
    <div className={`timer-wrap ${urgent ? 'timer-urgent' : ''}`}>
      <svg width={80} height={80} viewBox="0 0 80 80">
        {/* Track */}
        <circle cx={40} cy={40} r={norm} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        {/* Progress — starts at top (rotate -90deg) */}
        <circle cx={40} cy={40} r={norm} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circum}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px', transition: 'stroke-dasharray 0.25s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div className="timer-number" style={{ color }}>
        {secondsLeft}
      </div>
    </div>
  );
}

// ── Question image ────────────────────────────────────────────────────────────
function QuestionImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!src || errored) return null;

  return (
    <div className="qcard-image-wrap">
      {!loaded && <div className="qcard-image-skeleton" />}
      <img
        src={src}
        alt={alt || 'Question diagram'}
        className={`qcard-image ${loaded ? 'loaded' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        draggable={false}
      />
    </div>
  );
}

// ── Single question card ──────────────────────────────────────────────────────
function QuestionCard({ question, qIndex, total, selectedAnswer, onSelect, locked }) {
  const opts = [
    { key: 'a', text: question.option_a },
    { key: 'b', text: question.option_b },
    { key: 'c', text: question.option_c },
    { key: 'd', text: question.option_d },
  ];

  return (
    <div className="qcard">
      <div className="qcard-meta">
        <span className="qcard-num">Question {qIndex + 1} of {total}</span>
        {question.topic && <span className="qcard-topic">{question.topic}</span>}
      </div>

      {/* Question text with math rendering */}
      <div className="qcard-text">
        <MathText text={question.question_text} />
      </div>

      {/* Supporting image (diagram, graph, figure) */}
      <QuestionImage src={question.image_url} alt={`Diagram for question ${qIndex + 1}`} />

      {/* Answer options with math rendering */}
      <div className="qcard-options">
        {opts.map(({ key, text }) => {
          const isSelected = selectedAnswer === key;
          return (
            <button
              key={key}
              className={`qcard-option ${isSelected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => !locked && onSelect(key)}
              disabled={locked}
            >
              <span className="qcard-option-letter">{key.toUpperCase()}</span>
              <span className="qcard-option-text">
                <MathText text={text} />
              </span>
              {isSelected && <span className="qcard-option-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Results view ──────────────────────────────────────────────────────────────
function ResultsView({ submission, exam, worldKey, levelNumber, onRetry }) {
  const navigate = useNavigate();
  const { score_pct, passed, correct_count, total_questions, results } = submission;

  const isMastery = score_pct === 100;

  return (
    <div className="results-card">
      <div className="results-icon" style={{ fontSize: '3rem', marginBottom: 12 }}>
        {isMastery ? '🏆' : passed ? '✅' : '❌'}
      </div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
        {isMastery ? 'Perfect Score!' : passed ? 'Level Passed!' : 'Not Quite…'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        You scored <strong style={{ color: score_pct >= 70 ? 'var(--green-light)' : '#fca5a5' }}>{score_pct}%</strong>{' '}
        ({correct_count}/{total_questions} correct)
        {passed && !isMastery && <span> — 100% required for mastery</span>}
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {!passed && (
          <button className="btn btn-violet" onClick={onRetry}>Try Again</button>
        )}
        <button className="btn btn-ghost" onClick={() => navigate(`/exam/${exam}`)}>← World Map</button>
      </div>

      {results && results.length > 0 && (
        <div style={{ textAlign: 'left', maxWidth: 520, margin: '0 auto' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Answer Review</h3>
          {results.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--border)', fontSize: '0.9rem',
            }}>
              <span style={{ fontSize: '1.1rem' }}>{r.is_correct ? '✅' : '❌'}</span>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--text-secondary)', marginRight: 8 }}>Q{i + 1}</span>
                <span>
                  Your answer: <strong>{r.your_answer ? r.your_answer.toUpperCase() : <em style={{ color: 'var(--text-muted)' }}>No answer</em>}</strong>
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

// ── Main Level component ──────────────────────────────────────────────────────
export default function Level() {
  const { exam, worldKey, levelNumber } = useParams();
  const navigate  = useNavigate();
  const levelNum  = parseInt(levelNumber, 10);

  // Session state
  const [questions,   setQuestions]  = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');

  // One-at-a-time state
  const [qIndex,      setQIndex]     = useState(0);
  const [answers,     setAnswers]    = useState({});
  const [selected,    setSelected]   = useState(null);
  const [locked,      setLocked]     = useState(false);
  const [timeLeft,    setTimeLeft]   = useState(TIMER_SECONDS);
  const [animDir,     setAnimDir]    = useState('enter');

  // Submission state
  const [submitting,  setSubmitting] = useState(false);
  const [submission,  setSubmission] = useState(null);

  const timerRef   = useRef(null);
  const advanceRef = useRef(null);

  // ── Load questions ──
  const fetchQuestions = useCallback(() => {
    setLoading(true);
    setError('');
    setAnswers({});
    setQIndex(0);
    setSelected(null);
    setLocked(false);
    setTimeLeft(TIMER_SECONDS);
    setSubmission(null);

    const BASE  = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('access_token');

    fetch(`${BASE}/api/exams/${exam}/worlds/${worldKey}/levels/${levelNum}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          const code = data?.error?.code;
          if (['level_locked', 'beyond_world2_trial_cap', 'trial_expired'].includes(code)) {
            navigate(`/exam/${exam}`, { replace: true });
          } else {
            setError(data?.error?.message || 'Failed to load questions.');
          }
          return;
        }
        setQuestions(data.questions || []);
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false));
  }, [exam, worldKey, levelNum, navigate]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ── Submit answers to backend ──
  const submitAnswers = useCallback(async (finalAnswers) => {
    if (submitting) return;
    setSubmitting(true);
    const BASE  = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const token = localStorage.getItem('access_token');
    try {
      const res  = await fetch(`${BASE}/api/exams/${exam}/worlds/${worldKey}/levels/${levelNum}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setSubmission(data);
    } catch (err) {
      setError(err?.error?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [exam, worldKey, levelNum, submitting]);

  // ── Advance to next question or submit ──
  const advance = useCallback((finalAnswers, nextIndex, totalQs) => {
    clearInterval(timerRef.current);
    clearTimeout(advanceRef.current);

    if (nextIndex >= totalQs) {
      submitAnswers(finalAnswers);
    } else {
      setAnimDir('exit');
      setTimeout(() => {
        setQIndex(nextIndex);
        setSelected(null);
        setLocked(false);
        setTimeLeft(TIMER_SECONDS);
        setAnimDir('enter');
      }, 250);
    }
  }, [submitAnswers]);

  // ── Timer tick ──
  useEffect(() => {
    if (loading || submission || submitting || questions.length === 0) return;

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setLocked(true);
          setSelected(null);
          const finalAnswers = { ...answers };
          advanceRef.current = setTimeout(() => {
            advance(finalAnswers, qIndex + 1, questions.length);
          }, 500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [qIndex, loading, submission, submitting, questions.length, advance, answers]);

  // ── User selects an answer ──
  const handleSelect = useCallback((key) => {
    if (locked) return;
    setLocked(true);
    setSelected(key);
    clearInterval(timerRef.current);

    const q = questions[qIndex];
    const updatedAnswers = { ...answers, [String(q.id)]: key };
    setAnswers(updatedAnswers);

    advanceRef.current = setTimeout(() => {
      advance(updatedAnswers, qIndex + 1, questions.length);
    }, ADVANCE_DELAY);
  }, [locked, questions, qIndex, answers, advance]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(advanceRef.current);
  }, []);

  // ── Render ──
  if (loading || submitting) {
    return (
      <>
        <Navbar />
        <div className="loading-screen" style={{ minHeight: '80vh', flexDirection: 'column', gap: 16 }}>
          <div className="spinner" />
          {submitting && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Submitting your answers…</p>}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="level-page">
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
          <button className="btn btn-ghost" onClick={fetchQuestions}>Retry</button>
          <Link to={`/exam/${exam}`} className="btn btn-ghost" style={{ marginLeft: 8 }}>← World Map</Link>
        </div>
      </>
    );
  }

  if (submission) {
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

  if (questions.length === 0) {
    return (
      <>
        <Navbar />
        <div className="level-page">
          <div className="alert alert-info">No active questions in this level yet.</div>
          <Link to={`/exam/${exam}`} className="btn btn-ghost" style={{ marginTop: 12 }}>← World Map</Link>
        </div>
      </>
    );
  }

  const currentQ   = questions[qIndex];
  const worldLabel = worldKey.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const progress   = ((qIndex) / questions.length) * 100;

  return (
    <>
      <Navbar />
      <div className="level-page">

        {/* ── Top bar ── */}
        <div className="level-header">
          <button className="btn-back" onClick={() => navigate(`/exam/${exam}`)}>← World Map</button>
          <div className="level-progress-bar">
            <div className="level-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="level-counter">{qIndex + 1}/{questions.length}</span>
        </div>

        {/* ── Breadcrumb ── */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {worldLabel} · Level {levelNum}
            </h2>
          </div>
        </div>

        {/* ── Question + Timer layout ── */}
        <div className={`qcard-wrap ${animDir}`}>
          <div className="qcard-timer-row">
            <CircularTimer secondsLeft={timeLeft} total={TIMER_SECONDS} />
            {timeLeft === 0 && (
              <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>Time's up!</span>
            )}
          </div>
          <QuestionCard
            question={currentQ}
            qIndex={qIndex}
            total={questions.length}
            selectedAnswer={selected}
            onSelect={handleSelect}
            locked={locked}
          />
        </div>

        {/* ── Dot progress indicators ── */}
        <div className="qcard-dots">
          {questions.map((q, i) => {
            const answered = answers[String(q.id)] !== undefined;
            const isCurrent = i === qIndex;
            return (
              <div
                key={q.id}
                className={`qcard-dot ${isCurrent ? 'current' : answered ? 'done' : ''}`}
              />
            );
          })}
        </div>

      </div>
    </>
  );
}