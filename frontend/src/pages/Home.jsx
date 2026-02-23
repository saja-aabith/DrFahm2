import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

// ── 3 hardcoded demo questions (no auth needed) ───────────────────────────────
const DEMO_QUESTIONS = [
  {
    id: 'd1',
    question_text: 'If x / y = 7, then (x + 3y) / (2y) = ........',
    option_a: '5',
    option_b: '3/7',
    option_c: '10',
    option_d: '21',
    correct_answer: 'a',
  },
  {
    id: 'd2',
    question_text: 'A car travels 120 km in 2 hours. What is its average speed in km/h?',
    option_a: '40',
    option_b: '60',
    option_c: '80',
    option_d: '100',
    correct_answer: 'b',
  },
  {
    id: 'd3',
    question_text: 'What is 15% of 200?',
    option_a: '25',
    option_b: '30',
    option_c: '35',
    option_d: '40',
    correct_answer: 'b',
  },
];

const DEMO_TIMER = 30;

// ── Animated counter ──────────────────────────────────────────────────────────
function useCounter(target, duration = 1600, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

// ── Intersection observer ─────────────────────────────────────────────────────
function useInView(threshold = 0.25) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ── Alternating exam name ─────────────────────────────────────────────────────
function AlternatingExam() {
  const [which, setWhich] = useState(0); // 0=Qudurat 1=Tahsili
  const [fade, setFade]   = useState(true);
  const exams = ['Qudurat', 'Tahsili'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setWhich(w => (w + 1) % 2);
        setFade(true);
      }, 320);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className="hero-exam-name"
      style={{
        opacity: fade ? 1 : 0,
        transform: fade ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.32s ease, transform 0.32s ease',
        display: 'inline-block',
        color: which === 0 ? 'var(--green-light)' : 'var(--violet-light)',
      }}
    >
      {exams[which]}
    </span>
  );
}

// ── Animated 0→100% in headline ───────────────────────────────────────────────
function AnimatedPercent({ start }) {
  const val = useCounter(100, 1800, start);
  return (
    <span className="hero-percent">{val}%</span>
  );
}

// ── Mini circular timer for demo ─────────────────────────────────────────────
function MiniTimer({ secondsLeft, total }) {
  const r      = 22;
  const stroke = 3;
  const norm   = r - stroke / 2;
  const circum = 2 * Math.PI * norm;
  const dash   = (secondsLeft / total) * circum;
  const color  = secondsLeft > 15 ? '#4ade80' : secondsLeft > 8 ? '#f59e0b' : '#f87171';
  return (
    <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
      <svg width={48} height={48} viewBox="0 0 48 48">
        <circle cx={24} cy={24} r={norm} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle cx={24} cy={24} r={norm} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circum}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px', transition: 'stroke-dasharray 0.25s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 800, color,
      }}>{secondsLeft}</div>
    </div>
  );
}

// ── Interactive demo widget ───────────────────────────────────────────────────
function DemoWidget({ onFinish }) {
  const [qIndex,    setQIndex]    = useState(0);
  const [selected,  setSelected]  = useState(null);
  const [locked,    setLocked]    = useState(false);
  const [timeLeft,  setTimeLeft]  = useState(DEMO_TIMER);
  const [animDir,   setAnimDir]   = useState('enter');
  const [answers,   setAnswers]   = useState([]);     // {correct: bool}[]
  const timerRef  = useRef(null);
  const advRef    = useRef(null);

  const advance = useCallback((correct, nextIdx) => {
    clearInterval(timerRef.current);
    clearTimeout(advRef.current);
    const newAnswers = [...answers, { correct }];
    if (nextIdx >= DEMO_QUESTIONS.length) {
      // Done — tell parent
      setTimeout(() => onFinish(newAnswers), 400);
      return;
    }
    setAnimDir('exit');
    setTimeout(() => {
      setQIndex(nextIdx);
      setSelected(null);
      setLocked(false);
      setTimeLeft(DEMO_TIMER);
      setAnimDir('enter');
      setAnswers(newAnswers);
    }, 240);
  }, [answers, onFinish]);

  // Timer
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setLocked(true);
          advRef.current = setTimeout(() => advance(false, qIndex + 1), 500);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qIndex, advance]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(advRef.current);
  }, []);

  const handleSelect = (key) => {
    if (locked) return;
    setLocked(true);
    setSelected(key);
    clearInterval(timerRef.current);
    const correct = key === DEMO_QUESTIONS[qIndex].correct_answer;
    advRef.current = setTimeout(() => advance(correct, qIndex + 1), 700);
  };

  const q    = DEMO_QUESTIONS[qIndex];
  const opts = [
    { key: 'a', text: q.option_a },
    { key: 'b', text: q.option_b },
    { key: 'c', text: q.option_c },
    { key: 'd', text: q.option_d },
  ];

  return (
    <div className="demo-widget">
      {/* Header */}
      <div className="demo-header">
        <div className="demo-label">
          <span className="demo-badge">LIVE DEMO</span>
          <span className="demo-sub">Qudurat Math · Question {qIndex + 1} of {DEMO_QUESTIONS.length}</span>
        </div>
        <MiniTimer secondsLeft={timeLeft} total={DEMO_TIMER} />
      </div>

      {/* Question */}
      <div className={`demo-qwrap ${animDir}`}>
        <p className="demo-question">{q.question_text}</p>
        <div className="demo-options">
          {opts.map(({ key, text }) => {
            let cls = '';
            if (locked && selected === key) {
              cls = key === q.correct_answer ? 'correct' : 'wrong';
            } else if (locked && key === q.correct_answer && selected !== null) {
              cls = 'correct';
            } else if (selected === key) {
              cls = 'selected';
            }
            return (
              <button key={key} className={`demo-option ${cls} ${locked ? 'locked' : ''}`}
                onClick={() => handleSelect(key)}>
                <span className="demo-option-letter">{key.toUpperCase()}</span>
                <span>{text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dot strip */}
      <div className="demo-dots">
        {DEMO_QUESTIONS.map((_, i) => (
          <div key={i} className={`demo-dot ${i < qIndex ? 'done' : i === qIndex ? 'current' : ''}`} />
        ))}
      </div>
    </div>
  );
}

// ── Demo result + CTA ─────────────────────────────────────────────────────────
function DemoResult({ answers, onStart }) {
  const score = answers.filter(a => a.correct).length;
  const total = answers.length;
  const pct   = Math.round((score / total) * 100);

  return (
    <div className="demo-result">
      <div className={`demo-result-circle ${pct === 100 ? 'perfect' : pct >= 67 ? 'good' : 'low'}`}>
        {pct}%
      </div>
      <p className="demo-result-msg">
        {pct === 100
          ? 'Perfect! You\'re ready for the full platform.'
          : pct >= 67
          ? 'Good start! The real platform has 100 levels to take you further.'
          : 'The full platform will build your skills from the ground up.'}
      </p>
      <p className="demo-result-sub">
        You answered {score}/{total} correctly. There are <strong>100 levels</strong> waiting.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
        <button className="btn btn-green btn-lg" onClick={() => onStart('qudurat')}>
          Start here — Qudurat
        </button>
        <button className="btn btn-violet btn-lg" onClick={() => onStart('tahsili')}>
          Start here — Tahsili
        </button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 12 }}>
        Free 7-day trial · No credit card
      </p>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsSection() {
  const [ref, inView] = useInView(0.3);
  const s1 = useCounter(94,    1600, inView);
  const s2 = useCounter(12000, 2000, inView);
  const s3 = useCounter(100,   1400, inView);
  return (
    <div ref={ref} className="home-stats-row">
      <div className="home-stat">
        <span className="home-stat-num">{s1}<span className="home-stat-unit">%</span></span>
        <span className="home-stat-label">of students improve their score</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-num">{s2.toLocaleString()}<span className="home-stat-unit">+</span></span>
        <span className="home-stat-label">questions in the bank</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-num">{s3}</span>
        <span className="home-stat-label">mastery levels per exam</span>
      </div>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: '01', title: 'Choose your exam', body: 'Qudurat or Tahsili — each has its own 10-world mastery map built from the official syllabus.' },
  { num: '02', title: 'Start your trial free', body: 'First 2 worlds are free. No card needed. See exactly how the system works before you commit.' },
  { num: '03', title: 'Master world by world', body: 'Each world has 10 levels. Score 100% to unlock the next. Skills stack on top of each other.' },
  { num: '04', title: 'Reach exam-ready', body: 'Complete all 10 worlds = full exam coverage. You\'ll know your gaps before exam day.' },
];

// ── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  { quote: 'I went from not knowing where to start to finishing all 10 verbal worlds in 3 weeks. The structure made the difference.', name: 'Rawan A.', role: 'Qudurat student', score: '+18 points' },
  { quote: 'Every other app gave me random questions. DrFahm makes me prove I fixed what I got wrong.', name: 'Fahad M.', role: 'Tahsili student', score: '+22 points' },
  { quote: 'I recommend DrFahm to all my students. The world map makes it easy to track who needs what.', name: 'Ms. Nora K.', role: 'Prep teacher, Riyadh', score: '95% pass rate' },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [heroVisible,   setHeroVisible]   = useState(false);
  const [counterStart,  setCounterStart]  = useState(false);
  const [demoFinished,  setDemoFinished]  = useState(false);
  const [demoAnswers,   setDemoAnswers]   = useState([]);

  useEffect(() => {
    const t1 = setTimeout(() => setHeroVisible(true), 60);
    const t2 = setTimeout(() => setCounterStart(true), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleStart = (exam) => {
    if (user) navigate(`/exam/${exam}`);
    else      navigate(`/register?exam=${exam}`);
  };

  const handleDemoFinish = (answers) => {
    setDemoAnswers(answers);
    setDemoFinished(true);
  };

  return (
    <>
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="home-hero-bg" />

        {/* Left: headline + CTAs */}
        <div className={`home-hero-content ${heroVisible ? 'anim-in' : ''}`}>
          <div className="home-hero-eyebrow">
            <span className="home-hero-dot" />
            Saudi National Exam Preparation
          </div>

          <h1 className="home-hero-title">
            The Blueprint to{' '}
            <AnimatedPercent start={counterStart} />{' '}
            in <AlternatingExam />
          </h1>

          <p className="home-hero-sub">
            The only structured mastery platform built for Qudurat &amp; Tahsili.
            No random practice — a proven path from where you are to exam-ready.
          </p>

          <div className="home-hero-actions">
            <button className="btn btn-green btn-lg" onClick={() => handleStart('qudurat')}>
              Start here — Qudurat
            </button>
            <button className="btn btn-violet btn-lg" onClick={() => handleStart('tahsili')}>
              Start here — Tahsili
            </button>
          </div>

          <div className="home-hero-trust">
            <span>✓ 7-day free trial</span>
            <span>✓ No credit card</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>

        {/* Right: interactive demo */}
        <div className={`home-hero-visual ${heroVisible ? 'anim-in-delayed' : ''}`}>
          {demoFinished
            ? <DemoResult answers={demoAnswers} onStart={handleStart} />
            : <DemoWidget onFinish={handleDemoFinish} />
          }
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section className="home-section home-section-stats">
        <div className="home-container">
          <StatsSection />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-section-header">
            <div className="home-section-tag">How It Works</div>
            <h2 className="home-section-title">A proven path from confused to confident</h2>
          </div>
          <div className="home-steps-grid">
            {STEPS.map((s, i) => {
              const [ref, inView] = useInViewHook();
              return (
                <div key={s.num} ref={ref}
                  className={`home-step ${inView ? 'anim-in' : ''}`}
                  style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="home-step-num">{s.num}</div>
                  <h3 className="home-step-title">{s.title}</h3>
                  <p className="home-step-body">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="home-section">
        <div className="home-container">
          <div className="home-section-header">
            <div className="home-section-tag">Results</div>
            <h2 className="home-section-title">Students who used the system</h2>
          </div>
          <div className="home-testimonial-grid">
            {TESTIMONIALS.map((t, i) => {
              const [ref, inView] = useInViewHook();
              return (
                <div key={t.name} ref={ref}
                  className={`home-testimonial-card ${inView ? 'anim-in' : ''}`}
                  style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="home-testimonial-score">{t.score}</div>
                  <p className="home-testimonial-quote">"{t.quote}"</p>
                  <div className="home-testimonial-author">
                    <div className="home-testimonial-avatar">{t.name[0]}</div>
                    <div>
                      <div className="home-testimonial-name">{t.name}</div>
                      <div className="home-testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-cta-strip">
            <div className="home-cta-strip-glow" />
            <h2 className="home-cta-strip-title">Your exam is closer than you think.</h2>
            <p className="home-cta-strip-sub">Start your free 7-day trial. No credit card. No commitment.</p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-green btn-lg" onClick={() => handleStart('qudurat')}>
                Start here — Qudurat
              </button>
              <button className="btn btn-violet btn-lg" onClick={() => handleStart('tahsili')}>
                Start here — Tahsili
              </button>
            </div>
            <p className="home-cta-strip-footnote">
              Already have an account? <Link to="/login" className="link">Log in</Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <span className="navbar-logo"><span className="logo-dr">Dr</span><span className="logo-fahm">Fahm</span></span>
              <p className="home-footer-tagline">Saudi exam mastery — world by world.</p>
            </div>
            <div className="home-footer-links">
              <Link to="/pricing"  className="home-footer-link">Pricing</Link>
              <Link to="/schools"  className="home-footer-link">For Schools</Link>
              <Link to="/login"    className="home-footer-link">Log In</Link>
              <Link to="/register" className="home-footer-link">Sign Up</Link>
            </div>
          </div>
          <div className="home-footer-bottom">
            © {new Date().getFullYear()} DrFahm. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}

// Hook used inside map (defined outside component to satisfy rules of hooks at module level)
function useInViewHook() {
  return useInView(0.1);
}