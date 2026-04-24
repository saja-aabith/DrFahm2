import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { exams as examsApi } from '../api';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';

// ── Inject styles ─────────────────────────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('level-page-styles')) {
  const s = document.createElement('style');
  s.id = 'level-page-styles';
  s.textContent = `
    .lp-timer-bar-wrap {
      position: sticky; top: 0; z-index: 20;
      height: 6px; background: rgba(255,255,255,0.06);
      border-radius: 0 0 4px 4px; overflow: hidden;
    }
    .lp-timer-bar-fill { height: 100%; border-radius: 0 0 4px 4px; transition: width 1s linear, background 1s; }
    .lp-timer-text { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; font-size: 0.88rem; font-weight: 600; letter-spacing: 0.5px; }

    .lp-dot-nav { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 10px 0; }
    .lp-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); background: transparent; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: var(--text-muted); }
    .lp-dot.answered    { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.5); color: #3b82f6; }
    .lp-dot.correct-dot { background: rgba(22,163,74,0.15);  border-color: rgba(22,163,74,0.5);  color: #4ade80; }
    .lp-dot.wrong-dot   { background: rgba(220,38,38,0.12);  border-color: rgba(220,38,38,0.4);  color: #f87171; }
    .lp-dot.current     { border-color: var(--violet-light,#a78bfa); background: rgba(139,92,246,0.15); color: var(--violet-light,#a78bfa); transform: scale(1.15); }
    .lp-dot.correct-dot.current { border-color: #4ade80; background: rgba(22,163,74,0.25); color: #4ade80; transform: scale(1.15); }
    .lp-dot.wrong-dot.current   { border-color: #f87171; background: rgba(220,38,38,0.2);  color: #f87171; transform: scale(1.15); }

    .lp-option { display: flex; align-items: flex-start; gap: 14px; padding: 14px 18px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg-card, rgba(255,255,255,0.03)); cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: start; width: 100%; margin-bottom: 10px; }
    .lp-option:hover:not(.locked) { border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.06); }
    .lp-option.selected  { border-color: rgba(59,130,246,0.6); background: rgba(59,130,246,0.1); }
    .lp-option.locked    { cursor: default; }

    .lp-option.flash-correct { border-color: rgba(22,163,74,0.7) !important; background: rgba(22,163,74,0.12) !important; animation: correct-glow 0.5s ease-out; }
    @keyframes correct-glow {
      0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.5); transform: scale(1); }
      30%  { box-shadow: 0 0 0 8px rgba(22,163,74,0.2); transform: scale(1.01); }
      100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); transform: scale(1); }
    }
    .lp-option.flash-wrong { border-color: rgba(220,38,38,0.55) !important; background: rgba(220,38,38,0.08) !important; animation: wrong-shake 0.35s ease-out; }
    @keyframes wrong-shake {
      0%   { transform: translateX(0); }
      20%  { transform: translateX(-6px); }
      40%  { transform: translateX(5px); }
      60%  { transform: translateX(-4px); }
      80%  { transform: translateX(3px); }
      100% { transform: translateX(0); }
    }

    @keyframes sparkle-pop {
      0%   { transform: scale(0.7); opacity: 0; }
      50%  { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes star-spin {
      0%   { transform: rotate(0deg) scale(0); opacity: 0; }
      50%  { transform: rotate(25deg) scale(1.4); opacity: 1; }
      100% { transform: rotate(-10deg) scale(1); opacity: 0.8; }
    }
    .lp-sparkle-badge { animation: sparkle-pop 0.4s cubic-bezier(.34,1.56,.64,1) forwards; display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; background: rgba(22,163,74,0.15); border: 1px solid rgba(22,163,74,0.4); color: #4ade80; font-weight: 700; font-size: 0.82rem; margin-inline-start: auto; flex-shrink: 0; }
    .lp-sparkle-star  { animation: star-spin 0.55s ease-out forwards; display: inline-block; }

    .lp-option-key { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; border: 1.5px solid var(--border); background: rgba(255,255,255,0.04); color: var(--text-muted); transition: all 0.15s; }
    .lp-option.selected      .lp-option-key { background: rgba(59,130,246,0.2);  border-color: rgba(59,130,246,0.6);  color: #60a5fa; }
    .lp-option.flash-correct .lp-option-key { background: rgba(22,163,74,0.2);   border-color: rgba(22,163,74,0.6);   color: #4ade80; }
    .lp-option.flash-wrong   .lp-option-key { background: rgba(220,38,38,0.15);  border-color: rgba(220,38,38,0.5);   color: #f87171; }
    .lp-option-text { flex: 1; font-size: 0.93rem; color: var(--text-secondary); line-height: 1.55; padding-top: 2px; }
    .lp-option.flash-correct .lp-option-text { color: var(--text-primary); }

    .lp-hint-panel { background: rgba(217,119,6,0.07); border: 1px solid rgba(217,119,6,0.25); border-radius: 10px; padding: 14px 16px; animation: hint-slide-in 0.3s ease-out; margin-top: 4px; }
    @keyframes hint-slide-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    .lp-hint-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #b45309; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .lp-hint-body  { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.65; }

    .lp-next-btn {
      margin-top: 14px; width: 100%; padding: 12px 0;
      border-radius: 10px; border: 1.5px solid rgba(139,92,246,0.4);
      background: rgba(139,92,246,0.08); color: var(--violet-light, #a78bfa);
      font-weight: 700; font-size: 0.95rem; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      animation: hint-slide-in 0.3s ease-out;
    }
    .lp-next-btn:hover { background: rgba(139,92,246,0.15); border-color: rgba(139,92,246,0.6); }

    .lp-unanswered-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3); color: #b45309; font-size: 0.8rem; font-weight: 600; }

    .lp-results-card { max-width: 520px; margin: 0 auto; background: var(--bg-card, rgba(255,255,255,0.04)); border: 1.5px solid var(--border); border-radius: 14px; padding: 32px 36px; text-align: center; }
    .lp-score-big   { font-size: 3.2rem; font-weight: 800; line-height: 1; margin-bottom: 4px; }
    .lp-stat-row    { display: flex; justify-content: center; gap: 32px; margin: 20px 0; flex-wrap: wrap; }
    .lp-stat-item   { text-align: center; }
    .lp-stat-value  { font-size: 1.4rem; font-weight: 700; }
    .lp-stat-label  { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
    .lp-ranking-card { margin-top: 20px; padding: 14px 18px; border-radius: 10px; background: rgba(139,92,246,0.07); border: 1px solid rgba(139,92,246,0.2); }

    .lp-question-image { max-width: 100%; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 16px; display: block; }

    .lp-burst-overlay {
      position: fixed; inset: 0; z-index: 999;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .lp-burst-ring {
      position: absolute;
      border-radius: 50%;
      border: 4px solid rgba(22,163,74,0.6);
      animation: burst-ring 0.6s ease-out forwards;
    }
    @keyframes burst-ring {
      0%   { width: 0;     height: 0;     opacity: 1;   transform: translate(-50%,-50%) scale(1); }
      100% { width: 280px; height: 280px; opacity: 0;   transform: translate(-50%,-50%) scale(1); }
    }
    .lp-burst-ring-2 {
      animation-delay: 0.08s;
      border-color: rgba(74,222,128,0.4);
    }
    .lp-burst-badge {
      position: relative; z-index: 2;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      animation: burst-badge 0.55s cubic-bezier(.34,1.56,.64,1) forwards;
    }
    @keyframes burst-badge {
      0%   { opacity: 0; transform: scale(0.3) rotate(-8deg); }
      60%  { opacity: 1; transform: scale(1.12) rotate(3deg); }
      100% { opacity: 1; transform: scale(1) rotate(0deg); }
    }
    .lp-burst-checkmark {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, #16a34a, #22c55e);
      display: flex; align-items: center; justify-content: center;
      font-size: 2.2rem; color: white;
      box-shadow: 0 0 0 0 rgba(22,163,74,0.5);
      animation: burst-pulse 0.55s ease-out forwards;
    }
    @keyframes burst-pulse {
      0%   { box-shadow: 0 0 0 0   rgba(22,163,74,0.6); }
      50%  { box-shadow: 0 0 0 20px rgba(22,163,74,0.2); }
      100% { box-shadow: 0 0 0 40px rgba(22,163,74,0);   }
    }
    .lp-burst-label {
      font-size: 1.5rem; font-weight: 900; color: #4ade80;
      text-shadow: 0 2px 12px rgba(22,163,74,0.5);
      letter-spacing: 1px;
      animation: burst-label 0.5s cubic-bezier(.34,1.56,.64,1) 0.1s both;
    }
    @keyframes burst-label {
      0%   { opacity: 0; transform: translateY(8px) scale(0.8); }
      100% { opacity: 1; transform: translateY(0)   scale(1);   }
    }
    .lp-confetti-dot {
      position: absolute;
      width: 10px; height: 10px; border-radius: 50%;
      animation: confetti-fly 0.7s ease-out forwards;
    }
    @keyframes confetti-fly {
      0%   { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
      100% { opacity: 0; transform: var(--confetti-end) scale(0.4) rotate(180deg); }
    }
    .lp-burst-overlay.fading {
      animation: burst-fade 0.25s ease-in forwards;
    }
    @keyframes burst-fade {
      from { opacity: 1; }
      to   { opacity: 0; }
    }

    /* Floating in-game language toggle — bottom trailing edge, above timer, below submit overlay */
    .lp-lang-toggle-float {
      position: fixed;
      bottom: 16px;
      inset-inline-end: 16px;
      z-index: 30;
    }
  `;
  document.head.appendChild(s);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OPTION_KEYS   = ['a', 'b', 'c', 'd'];
const OPTION_LABELS = { a: 'A', b: 'B', c: 'C', d: 'D' };
const SECONDS_PER_QUESTION = 60;

// Tier i18n key per band (matches level.tier.* in translation files)
const WORLD_TIER_KEY = {
  100: 'bidaya',
  150: 'suood',
  200: 'tahadi',
  250: 'itqan',
  300: 'qimma',
};

function worldLabel(wk, t) {
  if (!wk) return wk;
  const band    = parseInt(wk.split('_')[1], 10);
  const tierKey = WORLD_TIER_KEY[band];
  return tierKey ? t(`level.tier.${tierKey}`) : wk;
}

function fmtTime(s) {
  if (s <= 0) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const CONF_COLOR = {
  high:   '#15803d',
  medium: '#0891b2',
  low:    '#b45309',
};

function timerColor(pct) {
  if (pct > 0.5) return '#3b82f6';
  if (pct > 0.2) return '#d97706';
  return '#dc2626';
}

// ── Floating language toggle ──────────────────────────────────────────────────

function LangToggleFloat() {
  const { t, i18n } = useTranslation();
  const toggle = () => i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  return (
    <button
      className="lang-toggle lp-lang-toggle-float"
      onClick={toggle}
      aria-label={t('auth.lang_toggle_aria')}
    >
      <span className={i18n.language === 'en' ? 'lang-active' : ''}>EN</span>
      <span className="lang-sep" />
      <span className={i18n.language === 'ar' ? 'lang-active' : ''}>AR</span>
    </button>
  );
}

// ── Sparkle correct badge ─────────────────────────────────────────────────────

function SparkleCorrect() {
  const { t } = useTranslation();
  return (
    <span className="lp-sparkle-badge">
      <span className="lp-sparkle-star">✦</span>
      {t('level.sparkle_correct')}
    </span>
  );
}

// ── Correct sound (Web Audio API — no external files needed) ─────────────────

function playCorrectSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const start = ctx.currentTime + i * 0.12;
      const end   = start + 0.22;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, end);

      osc.start(start);
      osc.stop(end);
    });

    const shimmer  = ctx.createOscillator();
    const shimGain = ctx.createGain();
    shimmer.connect(shimGain);
    shimGain.connect(ctx.destination);
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(1567.98, ctx.currentTime + 0.24);
    shimGain.gain.setValueAtTime(0, ctx.currentTime + 0.24);
    shimGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.26);
    shimGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    shimmer.start(ctx.currentTime + 0.24);
    shimmer.stop(ctx.currentTime + 0.55);
  } catch {
    // Audio not available — silent fallback
  }
}

// ── Correct burst overlay ─────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#4ade80','#facc15','#60a5fa','#f472b6','#a78bfa','#fb923c'];
const CONFETTI_POSITIONS = [
  { x: -110, y: -90  }, { x: 110,  y: -90  }, { x: -130, y: 10   },
  { x: 130,  y: 10   }, { x: -80,  y: 100  }, { x: 80,   y: 100  },
  { x: -40,  y: -120 }, { x: 40,   y: -120 }, { x: 0,    y: 120  },
  { x: -150, y: -30  }, { x: 150,  y: -30  }, { x: -60,  y: 80   },
];

function CorrectBurst({ onDone }) {
  const { t } = useTranslation();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 650);
    const doneTimer = setTimeout(onDone, 900);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div className={`lp-burst-overlay${fading ? ' fading' : ''}`}>
      <div className="lp-burst-ring"   style={{ position: 'absolute', left: '50%', top: '50%' }} />
      <div className="lp-burst-ring lp-burst-ring-2" style={{ position: 'absolute', left: '50%', top: '50%' }} />

      {CONFETTI_POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="lp-confetti-dot"
          style={{
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            left: '50%', top: '50%',
            marginLeft: -5, marginTop: -5,
            '--confetti-end': `translate(${pos.x}px, ${pos.y}px)`,
            animationDelay: `${i * 0.03}s`,
          }}
        />
      ))}

      <div className="lp-burst-badge">
        <div className="lp-burst-checkmark">✓</div>
        <div className="lp-burst-label">{t('level.correct_label')}</div>
      </div>
    </div>
  );
}

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
  questions, answers, feedback, currentIdx, timeLeft, totalTime,
  onSelectAnswer, onNavigate, onSubmit,
}) {
  const { t } = useTranslation();
  const q             = questions[currentIdx];
  const totalQ        = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unanswered    = totalQ - answeredCount;
  const timerPct      = totalTime > 0 ? timeLeft / totalTime : 0;
  const color         = timerColor(timerPct);
  const isLocked      = !!answers[q.id];
  const selected      = answers[q.id] || null;
  const qFeedback     = feedback[q.id] || null;
  const allAnswered   = answeredCount === totalQ;

  const nextUnansweredIdx = questions.findIndex((qq, i) => i > currentIdx && !answers[qq.id]);
  const nextTarget        = nextUnansweredIdx !== -1 ? nextUnansweredIdx : currentIdx + 1;
  const showWrongNext     = isLocked && qFeedback === 'wrong' && currentIdx < totalQ - 1;

  const arrow    = t('common.arrow');
  const examName = t(`common.${exam}`);

  return (
    <>
      <Navbar />
      <div className="lp-timer-bar-wrap">
        <div className="lp-timer-bar-fill" style={{ width: `${timerPct * 100}%`, background: color }} />
      </div>
      <div className="page" style={{ maxWidth: 740, paddingTop: 16 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Link to={`/exam/${exam}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← {examName}
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{worldLabel(worldKey, t)}</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
            {t('level.breadcrumb_level', { n: levelNumber })}
          </span>
          <span className="lp-timer-text" style={{ marginInlineStart: 'auto', color }}>⏱ {fmtTime(timeLeft)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {t('level.question_of')}{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>{currentIdx + 1}</strong>
            {' '}{t('level.of')} {totalQ}
          </span>
          {unanswered > 0 && (
            <span className="lp-unanswered-pill">
              {t('level.unanswered_pill', { count: unanswered })}
            </span>
          )}
        </div>

        <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', marginBottom: 16 }}>
          {q.image_url && <img src={q.image_url} alt="" className="lp-question-image" />}
          {/* question_text is English-only per DB schema */}
          <div style={{ fontSize: '1.02rem', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 20 }} dir="ltr">
            <MathText text={q.question_text} />
          </div>

          {OPTION_KEYS.map((key) => {
            const text = q[`option_${key}`];
            if (!text) return null;
            const isSelected = selected === key;
            let flashClass = '';
            if (isLocked && isSelected) {
              flashClass = qFeedback === 'correct' ? ' flash-correct' : ' flash-wrong';
            }
            return (
              <button
                key={key}
                className={`lp-option${isSelected ? ' selected' : ''}${isLocked ? ' locked' : ''}${flashClass}`}
                onClick={() => !isLocked && onSelectAnswer(q.id, key)}
                disabled={isLocked}
                aria-pressed={isSelected}
              >
                <span className="lp-option-key">{OPTION_LABELS[key]}</span>
                {/* option text is English-only per DB schema */}
                <span className="lp-option-text" dir="ltr"><MathText text={text} /></span>
                {isSelected && qFeedback === 'correct' && <SparkleCorrect />}
              </button>
            );
          })}

          {isLocked && qFeedback === 'wrong' && (
            <>
              {q.hint && (
                <div className="lp-hint-panel">
                  <div className="lp-hint-title"><span>💡</span> {t('level.hint_title')}</div>
                  {/* hint text is English-only per DB schema */}
                  <div className="lp-hint-body" dir="ltr"><MathText text={q.hint} /></div>
                </div>
              )}
              {showWrongNext && (
                <button className="lp-next-btn" onClick={() => onNavigate(nextTarget)}>
                  {t('level.next', { arrow })}
                </button>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(currentIdx - 1)} disabled={currentIdx === 0}>
            {t('level.prev_btn')}
          </button>
          <div className="lp-dot-nav" style={{ flex: 1 }}>
            {questions.map((qq, i) => {
              const fb = feedback[qq.id];
              const dotClass = fb === 'correct' ? 'correct-dot' : fb === 'wrong' ? 'wrong-dot' : (answers[qq.id] ? 'answered' : '');
              return (
                <button
                  key={qq.id}
                  className={`lp-dot ${dotClass} ${i === currentIdx ? 'current' : ''}`}
                  onClick={() => onNavigate(i)}
                  title={t('level.dot_title', { n: i + 1 })}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(currentIdx + 1)} disabled={currentIdx === totalQ - 1}>
            {t('level.next_btn')}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
          {!allAnswered && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {t('level.submit_hint_incomplete')}
            </span>
          )}
          <button
            className={`btn ${allAnswered ? 'btn-violet' : 'btn-ghost'}`}
            style={{ padding: '10px 28px', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={onSubmit}
          >
            {allAnswered ? t('level.submit_all') : t('level.submit_anyway')}
          </button>
        </div>

      </div>
    </>
  );
}

// ── RESULTS SCREEN ────────────────────────────────────────────────────────────

function ResultsScreen({
  exam, worldKey, levelNumber,
  passed, score, total, scorePercent,
  passThreshold, worldCompleted, timeTakenSeconds, onRetry,
  predictedScore,
}) {
  const { t } = useTranslation();
  const nextLevel  = levelNumber < 10 ? levelNumber + 1 : null;
  const scoreColor = passed ? '#4ade80' : '#f87171';

  const arrow    = t('common.arrow');
  const examName = t(`common.${exam}`);

  const headline = worldCompleted
    ? t('level.results.world_complete_title')
    : passed
      ? t('level.results.level_passed_title')
      : t('level.results.not_passed_title');

  return (
    <>
      <Navbar />
      <div className="page" style={{ paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link to={`/exam/${exam}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← {examName}
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{worldLabel(worldKey, t)}</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
            {t('level.breadcrumb_results', { n: levelNumber })}
          </span>
        </div>

        <div className="lp-results-card">
          <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>
            {worldCompleted ? '🏆' : passed ? '✅' : '❌'}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4, color: scoreColor }}>
            {headline}
          </div>
          <div className="lp-score-big" style={{ color: scoreColor }}>{Math.round(scorePercent)}%</div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {t('level.results.stat_correct', { score, total, threshold: passThreshold })}
          </div>

          <div className="lp-stat-row">
            <div className="lp-stat-item">
              <div className="lp-stat-value" style={{ color: 'var(--text-primary)' }}>{fmtTime(timeTakenSeconds)}</div>
              <div className="lp-stat-label">{t('level.results.stat_time')}</div>
            </div>
            <div className="lp-stat-item">
              <div className="lp-stat-value" style={{ color: scoreColor }}>{score}/{total}</div>
              <div className="lp-stat-label">{t('level.results.stat_score')}</div>
            </div>
            <div className="lp-stat-item">
              <div className="lp-stat-value" style={{ color: 'var(--text-secondary)' }}>{total - score}</div>
              <div className="lp-stat-label">{t('level.results.stat_missed')}</div>
            </div>
          </div>

          {predictedScore?.score != null && (
            <div style={{
              marginTop: 4, padding: '14px 18px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>
                {t('level.results.predicted_title', { exam: examName })}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1,
                color: CONF_COLOR[predictedScore.confidence] || 'var(--text-primary)' }}>
                {predictedScore.score}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 5 }}>
                {predictedScore.based_on_levels === 1
                  ? t('level.results.confidence_level',  { confidence: predictedScore.confidence })
                  : t('level.results.confidence_levels', { confidence: predictedScore.confidence, count: predictedScore.based_on_levels })}
              </div>
              {Object.keys(predictedScore.sections || {}).length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10,
                  paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  {Object.entries(predictedScore.sections).map(([sec, s]) => (
                    <div key={sec} style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem',
                        color: CONF_COLOR[predictedScore.confidence] || 'var(--text-primary)' }}>{s}%</div>
                      {/* Section keys from backend are English — stay English until backend provides AR */}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)',
                        textTransform: 'capitalize', marginTop: 2 }}>{sec}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="lp-ranking-card">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>
              {t('level.results.ranking_title')}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('level.results.ranking_placeholder')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {passed && nextLevel && !worldCompleted && (
              <Link to={`/exam/${exam}/world/${worldKey}/level/${nextLevel}`} className="btn btn-green" style={{ fontWeight: 700 }}>
                {t('level.results.next_level_btn', { n: nextLevel, arrow })}
              </Link>
            )}
            {passed && worldCompleted && (
              <Link to={`/exam/${exam}`} className="btn btn-green" style={{ fontWeight: 700 }}>
                {t('level.results.back_to_map_btn', { arrow })}
              </Link>
            )}
            {!passed && (
              <button className="btn btn-violet" style={{ fontWeight: 700 }} onClick={onRetry}>
                {t('level.results.try_again')}
              </button>
            )}
            <Link to={`/exam/${exam}`} className="btn btn-ghost btn-sm">
              {t('level.back_to_map')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function LevelPage() {
  const { t } = useTranslation();
  const { exam, worldKey, levelNumber: levelParam } = useParams();
  const navigate    = useNavigate();
  const levelNumber = parseInt(levelParam, 10);

  const [questions,       setQuestions]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [loadError,       setLoadError]       = useState('');
  const [answers,         setAnswers]         = useState({});
  const [feedback,        setFeedback]        = useState({});
  const [showBurst,       setShowBurst]       = useState(false);
  const [currentIdx,      setCurrentIdx]      = useState(0);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitError,     setSubmitError]     = useState('');
  const [timeLeft,        setTimeLeft]        = useState(0);
  const [totalTime,       setTotalTime]       = useState(0);
  const timerRef      = useRef(null);
  const autoSubmitRef = useRef(false);
  const startTimeRef  = useRef(null);
  const [timeTakenSeconds, setTimeTakenSeconds] = useState(0);
  const [results,         setResults]         = useState(null);
  const [passed,          setPassed]          = useState(false);
  const [score,           setScore]           = useState(0);
  // submittedTotal: actual question count for this level from the submit response.
  // Fixes score display bug where questions.length was the cumulative count.
  const [submittedTotal,  setSubmittedTotal]  = useState(0);
  // M2: predicted score from the submit response (no extra round-trip needed)
  const [predictedScore,  setPredictedScore]  = useState(null);
  const [scorePercent,    setScorePercent]    = useState(0);
  const [passThreshold,   setPassThreshold]   = useState(100);
  const [worldCompleted,  setWorldCompleted]  = useState(false);

  useEffect(() => {
    if (!['qudurat', 'tahsili'].includes(exam) || isNaN(levelNumber) || levelNumber < 1 || levelNumber > 10) {
      navigate('/dashboard', { replace: true });
    }
  }, [exam, levelNumber, navigate]);

  // ── Reset all gameplay state when navigating between levels ────────────────
  // React Router does NOT remount LevelPage when only URL params change.
  // Without this, old `results`, `score`, etc. from the previous level persist
  // into the next level — making it appear "auto-passed" immediately.
  useEffect(() => {
    setLoading(true);           // prevents "no questions" flash during reset
    setQuestions([]);
    setAnswers({});
    setFeedback({});
    setShowBurst(false);
    setCurrentIdx(0);
    setResults(null);
    setPassed(false);
    setScore(0);
    setSubmittedTotal(0);
    setPredictedScore(null);
    setScorePercent(0);
    setWorldCompleted(false);
    setSubmitting(false);
    setSubmitError('');
    setTimeTakenSeconds(0);
    setLoadError('');
    autoSubmitRef.current = false;
    clearInterval(timerRef.current);
    startTimeRef.current = null;
  }, [exam, worldKey, levelNumber]);
  // ────────────────────────────────────────────────────────────────────────────

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
        startTimeRef.current = Date.now();
      })
      .catch((err) => {
        const msg  = err?.error?.message || t('level.load_failed');
        const code = err?.error?.code;
        if (['prereq_incomplete', 'level_locked', 'beyond_trial_cap', 'no_entitlement'].includes(code)) {
          setLoadError(msg + t('level.load_failed_redirect_suffix'));
          setTimeout(() => navigate(`/exam/${exam}`, { replace: true }), 2200);
        } else {
          setLoadError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [exam, worldKey, levelNumber, navigate, t]);

  useEffect(() => {
    if (questions.length === 0 || results !== null) return;
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
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line
  }, [questions.length]);

  useEffect(() => {
    const handler = () => handleSubmit();
    window.addEventListener('level-timer-expired', handler);
    return () => window.removeEventListener('level-timer-expired', handler);
  // eslint-disable-next-line
  }, [answers]);

  const answersRef   = useRef(answers);
  const questionsRef = useRef(questions);
  useEffect(() => { answersRef.current   = answers;   }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const handleSelectAnswer = useCallback((questionId, key) => {
    if (answersRef.current[questionId]) return;

    const q         = questionsRef.current.find((qq) => qq.id === questionId);
    const isCorrect = q && q.correct_answer === key;

    setAnswers((prev) => ({ ...prev, [questionId]: key }));
    setFeedback((fb)  => ({ ...fb,  [questionId]: isCorrect ? 'correct' : 'wrong' }));

    if (isCorrect) {
      playCorrectSound();
      setShowBurst(true);
    }
  }, []);

  const handleNavigate = useCallback((idx) => {
    if (idx < 0 || idx >= questionsRef.current.length) return;
    setCurrentIdx(idx);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    clearInterval(timerRef.current);
    // M1: capture elapsed seconds for leaderboard tiebreaker
    const elapsed = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    setTimeTakenSeconds(elapsed);
    setSubmitting(true);
    setSubmitError('');
    const payload = {};
    Object.entries(answers).forEach(([qId, ans]) => { payload[qId] = ans; });
    try {
      // M1: pass elapsed so backend stores duration_seconds on first passing attempt
      const data = await examsApi.submitLevel(exam, worldKey, levelNumber, payload, elapsed);
      setResults(true);
      setPassed(data.passed);
      setScore(data.score);
      // Score display fix: use data.total (questions in this level) not questions.length
      // (questions.length was the cumulative count before the question range fix)
      setSubmittedTotal(data.total ?? questionsRef.current.length);
      setPredictedScore(data.predicted_score ?? null);
      setScorePercent(data.score_pct ?? (data.total > 0 ? (data.score / data.total) * 100 : 0));
      setPassThreshold(data.pass_threshold_pct ?? 100);
      setWorldCompleted(data.world_completed ?? false);
    } catch (err) {
      setSubmitError(err?.error?.message || t('level.submit_failed'));
      autoSubmitRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [submitting, answers, exam, worldKey, levelNumber, t]);

  const handleRetry = useCallback(() => {
    setAnswers({});
    setFeedback({});
    setShowBurst(false);
    setCurrentIdx(0);
    setResults(null);
    setPassed(false);
    setScore(0);
    setSubmittedTotal(0);
    setScorePercent(0);
    setWorldCompleted(false);
    setSubmitting(false);
    setSubmitError('');
    setTimeTakenSeconds(0);
    autoSubmitRef.current = false;
    startTimeRef.current  = Date.now();
    const total = questionsRef.current.length * SECONDS_PER_QUESTION;
    setTimeLeft(total);
    setTotalTime(total);
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
  }, []);

  if (loading) return <FullScreen><div className="spinner" /></FullScreen>;

  if (loadError) {
    return (
      <FullScreen>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{loadError}</div>
          <Link to={`/exam/${exam}`} className="btn btn-ghost">{t('level.back_to_map')}</Link>
        </div>
      </FullScreen>
    );
  }

  if (questions.length === 0) {
    return (
      <FullScreen>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{t('level.no_questions')}</div>
          <Link to={`/exam/${exam}`} className="btn btn-ghost">{t('level.back_to_map')}</Link>
        </div>
      </FullScreen>
    );
  }

  if (results !== null) {
    return (
      <>
        <ResultsScreen
          exam={exam} worldKey={worldKey} levelNumber={levelNumber}
          passed={passed} score={score}
          total={submittedTotal || questions.length}
          scorePercent={scorePercent} passThreshold={passThreshold}
          worldCompleted={worldCompleted} timeTakenSeconds={timeTakenSeconds}
          onRetry={handleRetry}
          predictedScore={predictedScore}
        />
        <LangToggleFloat />
      </>
    );
  }

  return (
    <>
      {submitError && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, minWidth: 300 }}>
          <div className="alert alert-error">{submitError}</div>
        </div>
      )}
      {submitting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '24px 32px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div className="spinner" style={{ marginBottom: 12 }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('level.submitting')}</div>
          </div>
        </div>
      )}

      {showBurst && (
        <CorrectBurst
          onDone={() => {
            setShowBurst(false);
            setCurrentIdx((ci) => {
              const qs   = questionsRef.current;
              const ans  = answersRef.current;
              const next = qs.findIndex((qq, i) => i > ci && !ans[qq.id]);
              return next !== -1 ? next : ci;
            });
          }}
        />
      )}

      <ExamScreen
        exam={exam} worldKey={worldKey} levelNumber={levelNumber}
        questions={questions} answers={answers} feedback={feedback}
        currentIdx={currentIdx} timeLeft={timeLeft} totalTime={totalTime}
        onSelectAnswer={handleSelectAnswer} onNavigate={handleNavigate} onSubmit={handleSubmit}
      />
      <LangToggleFloat />
    </>
  );
}