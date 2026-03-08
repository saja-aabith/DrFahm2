/**
 * LevelPage.jsx — Chunk H
 *
 * Route: /exam/:exam/world/:worldKey/level/:levelNumber
 *
 * Requires two additions to ../api (see bottom of file for exact signatures):
 *   exams.getQuestions(exam, worldKey, levelNumber)
 *   exams.submitLevel(exam, worldKey, levelNumber, answers)
 *
 * API contract (Chunk D):
 *   GET  questions → { questions: [{ id, qid, question_text, option_a…d, hint?, image_url?, … }] }
 *   POST submit    → { score, total, score_pct, passed, pass_threshold_pct,
 *                      world_completed, results: [{ question_id, qid, your_answer,
 *                      correct_answer, is_correct, hint? }] }
 *
 * Timer: question_count × 60 s, runs across whole level, auto-submits at 0.
 * Answer locking: once selected, cannot change.
 * Hints: shown only on results screen, on wrong-answer cards.
 *         Desktop → fixed right-side hint panel for focused question.
 *         Mobile  → inline below each wrong-answer card.
 * Correct answer celebration: sparkle CSS animation + "✓ Correct!" for ~700 ms on results.
 * LaTeX: all question_text and hint fields rendered through <MathText />.
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { exams as examsApi } from '../api';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';

// ── Inject game-specific styles once ─────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('level-page-styles')) {
  const s = document.createElement('style');
  s.id = 'level-page-styles';
  s.textContent = `
    /* ── Timer bar ── */
    .lp-timer-bar-wrap {
      position: sticky; top: 0; z-index: 20;
      height: 6px;
      background: rgba(255,255,255,0.06);
      border-radius: 0 0 4px 4px;
      overflow: hidden;
      margin-bottom: 0;
    }
    .lp-timer-bar-fill {
      height: 100%;
      border-radius: 0 0 4px 4px;
      transition: width 1s linear, background 1s;
    }
    .lp-timer-text {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
      font-size: 0.88rem;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    /* ── Question dot nav ── */
    .lp-dot-nav {
      display: flex; flex-wrap: wrap; gap: 6px;
      justify-content: center; padding: 10px 0;
    }
    .lp-dot {
      width: 28px; height: 28px; border-radius: 50%;
      border: 2px solid var(--border);
      background: transparent;
      font-size: 0.72rem; font-weight: 700;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      color: var(--text-muted);
    }
    .lp-dot.answered  { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.5); color: #3b82f6; }
    .lp-dot.current   { border-color: var(--violet-light, #a78bfa); background: rgba(139,92,246,0.15); color: var(--violet-light, #a78bfa); transform: scale(1.15); }
    .lp-dot.answered.current { border-color: #3b82f6; background: rgba(59,130,246,0.25); color: #3b82f6; transform: scale(1.15); }

    /* ── Option card ── */
    .lp-option {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 14px 18px; border-radius: 10px;
      border: 1.5px solid var(--border);
      background: var(--bg-card, rgba(255,255,255,0.03));
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, opacity 0.15s;
      text-align: left; width: 100%;
      margin-bottom: 10px;
    }
    .lp-option:hover:not(.locked) {
      border-color: rgba(139,92,246,0.4);
      background: rgba(139,92,246,0.06);
    }
    .lp-option.selected {
      border-color: rgba(59,130,246,0.6);
      background: rgba(59,130,246,0.1);
    }
    .lp-option.locked { cursor: default; }
    .lp-option-key {
      width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.82rem;
      border: 1.5px solid var(--border);
      background: rgba(255,255,255,0.04);
      color: var(--text-muted);
      transition: all 0.15s;
    }
    .lp-option.selected .lp-option-key {
      background: rgba(59,130,246,0.2);
      border-color: rgba(59,130,246,0.6);
      color: #60a5fa;
    }
    .lp-option-text {
      flex: 1; font-size: 0.93rem;
      color: var(--text-secondary);
      line-height: 1.55;
      padding-top: 2px;
    }
    .lp-option.selected .lp-option-text { color: var(--text-primary); }

    /* ── Results option states ── */
    .lp-option.res-correct {
      border-color: rgba(22,163,74,0.55);
      background: rgba(22,163,74,0.08);
    }
    .lp-option.res-correct .lp-option-key {
      background: rgba(22,163,74,0.2);
      border-color: rgba(22,163,74,0.6);
      color: #4ade80;
    }
    .lp-option.res-wrong-picked {
      border-color: rgba(220,38,38,0.45);
      background: rgba(220,38,38,0.07);
    }
    .lp-option.res-wrong-picked .lp-option-key {
      background: rgba(220,38,38,0.2);
      border-color: rgba(220,38,38,0.5);
      color: #f87171;
    }
    .lp-option.res-missed {
      border-color: rgba(22,163,74,0.3);
      background: rgba(22,163,74,0.04);
      opacity: 0.8;
    }
    .lp-option.res-dim { opacity: 0.35; }

    /* ── Sparkle animation ── */
    @keyframes sparkle-pop {
      0%   { transform: scale(0.9); opacity: 0; }
      40%  { transform: scale(1.08); opacity: 1; }
      70%  { transform: scale(1.02); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes star-spin {
      0%   { transform: rotate(0deg) scale(0); opacity: 0; }
      40%  { transform: rotate(20deg) scale(1.3); opacity: 1; }
      100% { transform: rotate(-10deg) scale(1); opacity: 0; }
    }
    .sparkle-badge {
      animation: sparkle-pop 0.5s cubic-bezier(.34,1.56,.64,1) forwards;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 20px;
      background: rgba(22,163,74,0.15);
      border: 1px solid rgba(22,163,74,0.4);
      color: #4ade80;
      font-weight: 700; font-size: 0.88rem;
    }
    .sparkle-star {
      animation: star-spin 0.6s ease-out forwards;
      display: inline-block;
    }

    /* ── Hint panel ── */
    .lp-hint-panel {
      background: rgba(217,119,6,0.07);
      border: 1px solid rgba(217,119,6,0.25);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .lp-hint-panel-title {
      font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #b45309; margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .lp-hint-text {
      font-size: 0.9rem; color: var(--text-secondary); line-height: 1.65;
    }

    /* ── Results layout ── */
    .lp-results-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .lp-results-layout { grid-template-columns: 1fr; }
    }
    .lp-hint-sidebar {
      position: sticky; top: 80px;
    }

    /* ── Score banner ── */
    .lp-score-banner {
      border-radius: 12px; padding: 24px 28px;
      margin-bottom: 24px;
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    }
    .lp-score-banner.passed {
      background: rgba(22,163,74,0.1);
      border: 1.5px solid rgba(22,163,74,0.35);
    }
    .lp-score-banner.failed {
      background: rgba(220,38,38,0.07);
      border: 1.5px solid rgba(220,38,38,0.25);
    }
    .lp-score-num {
      font-size: 2.6rem; font-weight: 800; line-height: 1;
    }
    .lp-score-banner.passed .lp-score-num { color: #4ade80; }
    .lp-score-banner.failed .lp-score-num { color: #f87171; }

    /* ── Result question card ── */
    .lp-result-card {
      border-radius: 10px; padding: 16px 18px; margin-bottom: 12px;
      border: 1.5px solid var(--border);
      background: var(--bg-card, rgba(255,255,255,0.03));
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .lp-result-card:hover { border-color: rgba(139,92,246,0.3); }
    .lp-result-card.focused { border-color: rgba(139,92,246,0.5); background: rgba(139,92,246,0.05); }
    .lp-result-card.correct-card { border-color: rgba(22,163,74,0.25); }
    .lp-result-card.wrong-card   { border-color: rgba(220,38,38,0.2); }

    /* ── Unanswered warning ── */
    .lp-unanswered-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 20px;
      background: rgba(217,119,6,0.1);
      border: 1px solid rgba(217,119,6,0.3);
      color: #b45309; font-size: 0.8rem; font-weight: 600;
    }

    /* ── Image ── */
    .lp-question-image {
      max-width: 100%; border-radius: 8px;
      border: 1px solid var(--border);
      margin-bottom: 16px; display: block;
    }
  `;
  document.head.appendChild(s);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OPTION_KEYS = ['a', 'b', 'c', 'd'];
const OPTION_LABELS = { a: 'A', b: 'B', c: 'C', d: 'D' };
const SECONDS_PER_QUESTION = 60;

const WORLD_TIER = {
  100: 'Bidaya — البداية',
  150: "Su'ood — الصعود",
  200: 'Tahadi — التحدي',
  250: 'Itqan — الإتقان',
  300: 'Qimma — القمة',
};

function worldLabel(worldKey) {
  if (!worldKey) return worldKey;
  const band = parseInt(worldKey.split('_')[1], 10);
  return WORLD_TIER[band] || worldKey;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(seconds) {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timerColor(pct) {
  if (pct > 0.5) return '#3b82f6';
  if (pct > 0.2) return '#d97706';
  return '#dc2626';
}

// ── SparkleCorrect ─────────────────────────────────────────────────────────────

function SparkleCorrect() {
  return (
    <span className="sparkle-badge">
      <span className="sparkle-star">✦</span>
      Correct!
      <span className="sparkle-star" style={{ animationDelay: '0.1s' }}>✦</span>
    </span>
  );
}

// ── Loading / Error screens ───────────────────────────────────────────────────

function FullScreen({ children }) {
  return (
    <>
      <Navbar />
      <div className="page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </>
  );
}

// ── EXAM SCREEN ───────────────────────────────────────────────────────────────

function ExamScreen({
  exam, worldKey, levelNumber,
  questions, answers, currentIdx,
  timeLeft, totalTime,
  onSelectAnswer, onNavigate, onSubmit,
}) {
  const q           = questions[currentIdx];
  const totalQ      = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unanswered  = totalQ - answeredCount;
  const timerPct    = totalTime > 0 ? timeLeft / totalTime : 0;
  const color       = timerColor(timerPct);
  const isLocked    = !!answers[q.id];
  const selected    = answers[q.id] || null;

  const allAnswered = answeredCount === totalQ;

  return (
    <>
      <Navbar />

      {/* Sticky timer bar */}
      <div className="lp-timer-bar-wrap">
        <div
          className="lp-timer-bar-fill"
          style={{ width: `${timerPct * 100}%`, background: color }}
        />
      </div>

      <div className="page" style={{ maxWidth: 740, paddingTop: 16 }}>

        {/* Top row: breadcrumb + timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Link
            to={`/exam/${exam}`}
            style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            ← {exam === 'qudurat' ? 'Qudurat' : 'Tahsili'}
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {worldLabel(worldKey)}
          </span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
            Level {levelNumber}
          </span>
          <span
            className="lp-timer-text"
            style={{ marginLeft: 'auto', color }}
            title="Time remaining"
          >
            ⏱ {fmtTime(timeLeft)}
          </span>
        </div>

        {/* Question counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Question <strong style={{ color: 'var(--text-secondary)' }}>{currentIdx + 1}</strong> of {totalQ}
          </span>
          {unanswered > 0 && (
            <span className="lp-unanswered-pill">
              ⚠ {unanswered} unanswered
            </span>
          )}
        </div>

        {/* Question card */}
        <div style={{
          background: 'var(--bg-card, rgba(255,255,255,0.04))',
          border: '1px solid var(--border)',
          borderRadius: 12, padding: '22px 24px', marginBottom: 16,
        }}>
          {q.image_url && (
            <img src={q.image_url} alt="" className="lp-question-image" />
          )}
          <div style={{ fontSize: '1.02rem', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 20 }}>
            <MathText text={q.question_text} />
          </div>

          {/* Options */}
          {OPTION_KEYS.map((key) => {
            const text = q[`option_${key}`];
            if (!text) return null;
            const isSelected = selected === key;
            return (
              <button
                key={key}
                className={`lp-option${isSelected ? ' selected' : ''}${isLocked ? ' locked' : ''}`}
                onClick={() => !isLocked && onSelectAnswer(q.id, key)}
                disabled={isLocked}
                aria-pressed={isSelected}
              >
                <span className="lp-option-key">{OPTION_LABELS[key]}</span>
                <span className="lp-option-text">
                  <MathText text={text} />
                </span>
                {isSelected && isLocked && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(100,116,139,0.6)', flexShrink: 0 }}>
                    locked
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Navigation row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigate(currentIdx - 1)}
            disabled={currentIdx === 0}
          >
            ← Prev
          </button>

          {/* Dot navigator */}
          <div className="lp-dot-nav" style={{ flex: 1 }}>
            {questions.map((qq, i) => {
              const isAns = !!answers[qq.id];
              const isCur = i === currentIdx;
              return (
                <button
                  key={qq.id}
                  className={`lp-dot${isAns ? ' answered' : ''}${isCur ? ' current' : ''}`}
                  onClick={() => onNavigate(i)}
                  title={`Question ${i + 1}${isAns ? ' (answered)' : ''}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigate(currentIdx + 1)}
            disabled={currentIdx === totalQ - 1}
          >
            Next →
          </button>
        </div>

        {/* Submit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
          {!allAnswered && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              You can submit with unanswered questions.
            </span>
          )}
          <button
            className={`btn ${allAnswered ? 'btn-violet' : 'btn-ghost'}`}
            style={{ padding: '10px 28px', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={onSubmit}
          >
            {allAnswered ? 'Submit ✓' : 'Submit anyway'}
          </button>
        </div>

      </div>
    </>
  );
}

// ── RESULTS SCREEN ────────────────────────────────────────────────────────────

function ResultsScreen({
  exam, worldKey, levelNumber,
  questions, results, passed,
  score, total, scorePercent, passThreshold,
  worldCompleted,
  onRetry,
}) {
  // Map question_id → result for quick lookup
  const resultMap = {};
  results.forEach((r) => { resultMap[r.question_id] = r; });

  // Map question_id → question for quick lookup
  const qMap = {};
  questions.forEach((q) => { qMap[q.id] = q; });

  // Focused wrong question (for desktop hint panel)
  const wrongResults = results.filter((r) => !r.is_correct);
  const [focusedId, setFocusedId] = useState(wrongResults[0]?.question_id ?? null);

  // Sparkle tracking: which correct question IDs have played
  const [sparkledIds, setSparkledIds] = useState(new Set());
  const sparkleTimers = useRef({});

  const handleCardClick = (questionId) => {
    const r = resultMap[questionId];
    if (!r) return;
    if (r.is_correct) {
      // Trigger sparkle if not yet played
      if (!sparkledIds.has(questionId)) {
        setSparkledIds((prev) => new Set([...prev, questionId]));
        sparkleTimers.current[questionId] = setTimeout(() => {
          setSparkledIds((prev) => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
        }, 700);
      }
    } else {
      setFocusedId(questionId);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = sparkleTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const focusedResult  = focusedId ? resultMap[focusedId]  : null;
  const focusedQuestion = focusedId ? qMap[focusedId] : null;
  const hintText = focusedResult?.hint || focusedQuestion?.hint || null;

  const nextLevelNumber = levelNumber < 10 ? levelNumber + 1 : null;

  return (
    <>
      <Navbar />
      <div className="page" style={{ paddingTop: 16 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <Link to={`/exam/${exam}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← {exam === 'qudurat' ? 'Qudurat' : 'Tahsili'}
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{worldLabel(worldKey)}</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Level {levelNumber} — Results</span>
        </div>

        {/* Score banner */}
        <div className={`lp-score-banner ${passed ? 'passed' : 'failed'}`}>
          <div>
            <div className="lp-score-num">{score}/{total}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Pass threshold: {passThreshold}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: passed ? '#4ade80' : '#f87171' }}>
              {passed ? '✓ Passed' : '✗ Not yet'}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {Math.round(scorePercent)}% correct
            </div>
          </div>

          {worldCompleted && (
            <div style={{
              marginLeft: 'auto',
              padding: '10px 18px', borderRadius: 10,
              background: 'rgba(22,163,74,0.15)',
              border: '1px solid rgba(22,163,74,0.35)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.3rem' }}>🏆</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4ade80', marginTop: 2 }}>
                World Complete!
              </div>
            </div>
          )}

          <div style={{ marginLeft: worldCompleted ? 0 : 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {passed && nextLevelNumber && !worldCompleted && (
              <Link
                to={`/exam/${exam}/world/${worldKey}/level/${nextLevelNumber}`}
                className="btn btn-green"
                style={{ fontWeight: 700 }}
              >
                Level {nextLevelNumber} →
              </Link>
            )}
            {passed && worldCompleted && (
              <Link to={`/exam/${exam}`} className="btn btn-green" style={{ fontWeight: 700 }}>
                Back to Map →
              </Link>
            )}
            {!passed && (
              <button className="btn btn-violet" style={{ fontWeight: 700 }} onClick={onRetry}>
                Try Again
              </button>
            )}
            <Link to={`/exam/${exam}`} className="btn btn-ghost btn-sm">
              Back to Map
            </Link>
          </div>
        </div>

        {/* Results layout */}
        <div className="lp-results-layout">

          {/* Left column: question list */}
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              {wrongResults.length === 0
                ? '✓ All questions correct!'
                : `Click a question to see hints. ${wrongResults.length} incorrect.`}
            </div>

            {questions.map((q, idx) => {
              const r = resultMap[q.id];
              if (!r) return null;

              const isCorrect   = r.is_correct;
              const yourAnswer  = r.your_answer;
              const correctAns  = r.correct_answer;
              const isSparkled  = sparkledIds.has(q.id);
              const isFocused   = focusedId === q.id;
              const hint        = r.hint || q.hint;

              return (
                <div
                  key={q.id}
                  className={`lp-result-card ${isCorrect ? 'correct-card' : 'wrong-card'} ${isFocused ? 'focused' : ''}`}
                  onClick={() => handleCardClick(q.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleCardClick(q.id)}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800,
                      background: isCorrect ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.15)',
                      color: isCorrect ? '#4ade80' : '#f87171',
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <MathText text={q.question_text.slice(0, 120) + (q.question_text.length > 120 ? '…' : '')} />
                    </span>
                    <span style={{ flexShrink: 0 }}>
                      {isCorrect
                        ? (isSparkled ? <SparkleCorrect /> : <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.9rem' }}>✓</span>)
                        : <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>✗</span>
                      }
                    </span>
                  </div>

                  {/* Options row */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: hint && !isCorrect ? 10 : 0 }}>
                    {OPTION_KEYS.map((key) => {
                      const text = q[`option_${key}`];
                      if (!text) return null;
                      const isYours   = yourAnswer === key;
                      const isCorrectOpt = correctAns === key;
                      const cls =
                        isCorrectOpt && isYours  ? 'res-correct' :
                        isYours && !isCorrectOpt ? 'res-wrong-picked' :
                        isCorrectOpt && !isYours && !isCorrect ? 'res-missed' :
                        'res-dim';
                      return (
                        <div
                          key={key}
                          className={`lp-option ${cls}`}
                          style={{ marginBottom: 0, padding: '8px 12px', fontSize: '0.85rem' }}
                        >
                          <span className="lp-option-key">{OPTION_LABELS[key]}</span>
                          <span className="lp-option-text" style={{ fontSize: '0.85rem' }}>
                            <MathText text={text} />
                          </span>
                          {isYours && !isCorrectOpt && (
                            <span style={{ flexShrink: 0, fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>✗ yours</span>
                          )}
                          {isCorrectOpt && !isYours && (
                            <span style={{ flexShrink: 0, fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>✓ answer</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile hint — inline below options */}
                  {hint && !isCorrect && (
                    <div className="lp-hint-panel" style={{ marginTop: 10 }}>
                      <div className="lp-hint-panel-title">
                        <span>💡</span> Hint
                      </div>
                      <div className="lp-hint-text">
                        <MathText text={hint} />
                      </div>
                    </div>
                  )}

                  {/* No answer case */}
                  {!yourAnswer && (
                    <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Not answered
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right column: desktop hint sidebar */}
          <div className="lp-hint-sidebar">
            {focusedResult && !focusedResult.is_correct && hintText ? (
              <div className="lp-hint-panel" style={{ padding: '18px 20px' }}>
                <div className="lp-hint-panel-title" style={{ marginBottom: 12 }}>
                  <span>💡</span>
                  Question {questions.findIndex((q) => q.id === focusedId) + 1} — Hint
                </div>
                <div className="lp-hint-text">
                  <MathText text={hintText} />
                </div>
              </div>
            ) : (
              <div style={{
                padding: '20px', borderRadius: 10,
                border: '1px dashed var(--border)',
                textAlign: 'center',
                color: 'var(--text-muted)', fontSize: '0.85rem',
              }}>
                {wrongResults.length === 0
                  ? '✓ Perfect score!'
                  : 'Click a wrong answer to see its hint here.'}
              </div>
            )}

            {/* Summary stats */}
            <div style={{
              marginTop: 16, padding: '14px 16px',
              background: 'var(--bg-card, rgba(255,255,255,0.03))',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Correct</span>
                <span style={{ fontWeight: 700, color: '#4ade80' }}>{score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wrong</span>
                <span style={{ fontWeight: 700, color: '#f87171' }}>{results.filter((r) => !r.is_correct && r.your_answer).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Skipped</span>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{results.filter((r) => !r.your_answer).length}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function LevelPage() {
  const { exam, worldKey, levelNumber: levelParam } = useParams();
  const navigate = useNavigate();
  const levelNumber = parseInt(levelParam, 10);

  // ── Fetch state ──────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Gameplay state ───────────────────────────────────────────────────────────
  const [answers,     setAnswers]    = useState({});  // { [questionId]: 'a'|'b'|'c'|'d' }
  const [currentIdx,  setCurrentIdx] = useState(0);
  const [submitting,  setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Timer state ──────────────────────────────────────────────────────────────
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [totalTime,  setTotalTime]  = useState(0);
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(false); // prevent double-submit from timer + user

  // ── Results state ────────────────────────────────────────────────────────────
  const [results,       setResults]       = useState(null);
  const [passed,        setPassed]        = useState(false);
  const [score,         setScore]         = useState(0);
  const [scorePercent,  setScorePercent]  = useState(0);
  const [passThreshold, setPassThreshold] = useState(70);
  const [worldCompleted, setWorldCompleted] = useState(false);

  // ── Validate params ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!['qudurat', 'tahsili'].includes(exam) || isNaN(levelNumber) || levelNumber < 1 || levelNumber > 10) {
      navigate('/dashboard', { replace: true });
    }
  }, [exam, levelNumber, navigate]);

  // ── Load questions ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!exam || !worldKey || isNaN(levelNumber)) return;
    setLoading(true);
    setLoadError('');
    examsApi.getQuestions(exam, worldKey, levelNumber)
      .then((data) => {
        const qs = data.questions || [];
        setQuestions(qs);
        const total = qs.length * SECONDS_PER_QUESTION;
        setTimeLeft(total);
        setTotalTime(total);
      })
      .catch((err) => {
        const msg = err?.error?.message || 'Failed to load questions.';
        const code = err?.error?.code;
        if (code === 'prereq_incomplete' || code === 'level_locked' || code === 'beyond_trial_cap' || code === 'no_entitlement') {
          setLoadError(msg + ' Returning to map…');
          setTimeout(() => navigate(`/exam/${exam}`, { replace: true }), 2200);
        } else {
          setLoadError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [exam, worldKey, levelNumber, navigate]);

  // ── Start timer once questions are loaded ────────────────────────────────────
  useEffect(() => {
    if (questions.length === 0 || results !== null) return; // don't start if already submitted

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            // Trigger submit with current answers — use a custom event since we can't
            // call handleSubmit directly from inside setTimeLeft
            window.dispatchEvent(new CustomEvent('level-timer-expired'));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line
  }, [questions.length]); // only re-run if questions change (new attempt)

  // ── Handle timer expiry ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => handleSubmit();
    window.addEventListener('level-timer-expired', handler);
    return () => window.removeEventListener('level-timer-expired', handler);
  // eslint-disable-next-line
  }, [answers]); // re-bind when answers changes so we always submit the latest state

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectAnswer = useCallback((questionId, key) => {
    setAnswers((prev) => {
      if (prev[questionId]) return prev; // locked — no-op
      const next = { ...prev, [questionId]: key };
      // Auto-advance to next unanswered question
      setCurrentIdx((ci) => {
        const nextUnansweredIdx = questions.findIndex(
          (q, i) => i > ci && !next[q.id]
        );
        if (nextUnansweredIdx !== -1) return nextUnansweredIdx;
        // All answered, or no unanswered after current: stay
        return ci;
      });
      return next;
    });
  }, [questions]);

  const handleNavigate = useCallback((idx) => {
    if (idx < 0 || idx >= questions.length) return;
    setCurrentIdx(idx);
  }, [questions.length]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    clearInterval(timerRef.current);
    setSubmitting(true);
    setSubmitError('');

    // Build answers payload — unanswered questions are omitted (backend scores as wrong)
    const payload = {};
    Object.entries(answers).forEach(([qId, ans]) => {
      payload[qId] = ans;
    });

    try {
      const data = await examsApi.submitLevel(exam, worldKey, levelNumber, payload);
      setResults(data.results);
      setPassed(data.passed);
      setScore(data.score);
      setScorePercent(data.score_pct ?? (data.total > 0 ? (data.score / data.total) * 100 : 0));
      setPassThreshold(data.pass_threshold_pct ?? 70);
      setWorldCompleted(data.world_completed ?? false);
    } catch (err) {
      setSubmitError(err?.error?.message || 'Submission failed. Please try again.');
      setSubmitting(false);
      // Restart timer so they can try again
      autoSubmitRef.current = false;
    }
  }, [submitting, answers, exam, worldKey, levelNumber]);

  const handleRetry = () => {
    // Reset all gameplay state for a fresh attempt
    setAnswers({});
    setCurrentIdx(0);
    setResults(null);
    setPassed(false);
    setScore(0);
    setScorePercent(0);
    setWorldCompleted(false);
    setSubmitting(false);
    setSubmitError('');
    autoSubmitRef.current = false;
    // Re-trigger question load (same questions, new timer)
    const total = questions.length * SECONDS_PER_QUESTION;
    setTimeLeft(total);
    setTotalTime(total);
    // Timer useEffect will restart because questions.length hasn't changed —
    // force it by clearing and re-starting manually
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            window.dispatchEvent(new CustomEvent('level-timer-expired'));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <FullScreen>
        <div className="spinner" />
      </FullScreen>
    );
  }

  if (loadError) {
    return (
      <FullScreen>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{loadError}</div>
          <Link to={`/exam/${exam}`} className="btn btn-ghost">← Back to Map</Link>
        </div>
      </FullScreen>
    );
  }

  if (questions.length === 0) {
    return (
      <FullScreen>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            No questions available for this level yet.
          </div>
          <Link to={`/exam/${exam}`} className="btn btn-ghost">← Back to Map</Link>
        </div>
      </FullScreen>
    );
  }

  if (results !== null) {
    return (
      <ResultsScreen
        exam={exam}
        worldKey={worldKey}
        levelNumber={levelNumber}
        questions={questions}
        results={results}
        passed={passed}
        score={score}
        total={questions.length}
        scorePercent={scorePercent}
        passThreshold={passThreshold}
        worldCompleted={worldCompleted}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <>
      {submitError && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, minWidth: 300 }}>
          <div className="alert alert-error">{submitError}</div>
        </div>
      )}
      <ExamScreen
        exam={exam}
        worldKey={worldKey}
        levelNumber={levelNumber}
        questions={questions}
        answers={answers}
        currentIdx={currentIdx}
        timeLeft={timeLeft}
        totalTime={totalTime}
        onSelectAnswer={handleSelectAnswer}
        onNavigate={handleNavigate}
        onSubmit={handleSubmit}
      />
    </>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// REQUIRED ADDITIONS TO ../api  (or wherever examsApi is exported from)
//
// These two functions must exist in the exams namespace.
// Mirror the pattern of worldMap() in the same file.
//
//   getQuestions: (exam, worldKey, levelNumber) =>
//     request(`/api/exams/${exam}/worlds/${worldKey}/levels/${levelNumber}/questions`)
//
//   submitLevel: (exam, worldKey, levelNumber, answers) =>
//     request(`/api/exams/${exam}/worlds/${worldKey}/levels/${levelNumber}/submit`, {
//       method: 'POST',
//       body: JSON.stringify({ answers }),
//     })
//
// "answers" is { [questionId: string]: 'a'|'b'|'c'|'d' }
// ════════════════════════════════════════════════════════════════════════════════