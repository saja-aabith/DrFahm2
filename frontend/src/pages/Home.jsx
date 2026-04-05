import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import { BookOpen, Target, TrendingUp, Zap, BarChart2, Award, Check, Minus } from 'lucide-react';

// ── Demo questions with proper LaTeX ─────────────────────────────────────────
const DEMO_QUESTIONS = [
  {
    id: 'd1',
    question_text: 'If $\\frac{x}{y} = 7$, find the value of $\\frac{x + 3y}{2y}$',
    option_a: '5',
    option_b: '$\\frac{3}{7}$',
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
    question_text: 'If $2x + 3 = 15$, what is the value of $x^{2}$?',
    option_a: '6',
    option_b: '12',
    option_c: '36',
    option_d: '144',
    correct_answer: 'c',
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
        <circle cx={24} cy={24} r={norm} fill="none" stroke="rgba(28,39,51,0.08)" strokeWidth={stroke} />
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
  const [qIndex,   setQIndex]   = useState(0);
  const [selected, setSelected] = useState(null);
  const [locked,   setLocked]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEMO_TIMER);
  const [animDir,  setAnimDir]  = useState('enter');
  const [answers,  setAnswers]  = useState([]);
  const timerRef = useRef(null);
  const advRef   = useRef(null);

  const advance = useCallback((correct, nextIdx) => {
    clearInterval(timerRef.current);
    clearTimeout(advRef.current);
    const newAnswers = [...answers, { correct }];
    if (nextIdx >= DEMO_QUESTIONS.length) {
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
        <p className="demo-question">
          <MathText text={q.question_text} />
        </p>
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
              <button
                key={key}
                className={`demo-option ${cls} ${locked ? 'locked' : ''}`}
                onClick={() => handleSelect(key)}
              >
                <span className="demo-option-letter">{key.toUpperCase()}</span>
                <span><MathText text={text} /></span>
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
          ? 'Perfect. The full platform has a structured path to take you further.'
          : pct >= 67
          ? 'Good start. The full platform will show you exactly what to improve next.'
          : 'The full platform builds your skills from the ground up, step by step.'}
      </p>
      <p className="demo-result-sub">
        {score}/{total} correct. Start the full structured path free.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
        <button className="btn btn-green btn-lg" onClick={() => onStart('qudurat')}>
          Start free — Qudurat
        </button>
        <button className="btn btn-ghost btn-lg" onClick={() => onStart('tahsili')}>
          Start free — Tahsili
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>
        7-day free trial · No credit card required
      </p>
    </div>
  );
}

// ── Stats section — real, verifiable numbers only ─────────────────────────────
function StatsSection() {
  const [ref, inView] = useInView(0.3);
  const questions = useCounter(6000, 2000, inView);
  const levels    = useCounter(300,  1400, inView);
  return (
    <div ref={ref} className="home-stats-row">
      <div className="home-stat">
        <span className="home-stat-num">
          {questions.toLocaleString()}<span className="home-stat-unit">+</span>
        </span>
        <span className="home-stat-label">exam-style questions</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-num">{levels}</span>
        <span className="home-stat-label">structured mastery levels</span>
      </div>
      <div className="home-stat-divider" />
      <div className="home-stat">
        <span className="home-stat-num">2</span>
        <span className="home-stat-label">national exams covered</span>
      </div>
    </div>
  );
}

// ── AnimatedCard — fixes hooks-in-map violation ───────────────────────────────
// Calling hooks inside .map() violates Rules of Hooks.
// Each card gets its own component so useInView runs at component top level.
function AnimatedCard({ children, className, style }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`${className} ${inView ? 'anim-in' : ''}`} style={style}>
      {children}
    </div>
  );
}

// ── Core value cards ──────────────────────────────────────────────────────────
const VALUE_CARDS = [
  {
    icon: <BookOpen size={20} />,
    title: 'Know exactly what to study next',
    body:  'Follow a clear structured path based on your level — no guessing, no wasted sessions.',
  },
  {
    icon: <Target size={20} />,
    title: 'Focus on what actually improves your score',
    body:  'Target weak areas instead of spending time on topics you already understand.',
  },
  {
    icon: <TrendingUp size={20} />,
    title: 'See your progress clearly',
    body:  'Track improvement step by step and build confidence as you prepare for exam day.',
  },
];

// ── Situation cards ───────────────────────────────────────────────────────────
const SITUATION_CARDS = [
  {
    icon:  <Zap size={18} />,
    label: 'Need to improve fast?',
    title: 'Focus on the highest-impact areas first',
    body:  'Stop covering everything. Target what will move your score the most.',
  },
  {
    icon:  <BarChart2 size={18} />,
    label: 'Stuck at the same score?',
    title: 'Find what is holding you back',
    body:  'Identify the specific gaps that keep your score from improving and fix them systematically.',
  },
  {
    icon:  <Award size={18} />,
    label: 'Aiming for 90+?',
    title: 'Refine your performance',
    body:  'Push past your current ceiling by eliminating the weak areas at the top of your range.',
  },
];

// ── Comparison items ──────────────────────────────────────────────────────────
const COMPARISON_LEFT = [
  'Random questions with no clear structure',
  'No path based on your actual level',
  'Progress is hard to measure',
  'Weak areas stay hidden',
  'More time studied does not always mean better scores',
];

const COMPARISON_RIGHT = [
  'Structured path built from your current level',
  'Focus only on what will improve your score',
  'Clear progress tracked at every step',
  'Weak areas identified and directly targeted',
  'Every session is directed at your result',
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [heroVisible,  setHeroVisible]  = useState(false);
  const [selectedExam, setSelectedExam] = useState('qudurat');
  const [demoFinished, setDemoFinished] = useState(false);
  const [demoAnswers,  setDemoAnswers]  = useState([]);

  const [ctaRef, ctaInView] = useInView(0.2);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleStart = (exam) => {
    const target = exam || selectedExam;
    if (user) navigate(`/exam/${target}`);
    else      navigate(`/register?exam=${target}`);
  };

  const handleDemoFinish = (answers) => {
    setDemoAnswers(answers);
    setDemoFinished(true);
  };

  return (
    <>
      <Navbar />

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <section className="home-hero">
        <div className={`home-hero-content ${heroVisible ? 'anim-in' : ''}`}>

          <div className="home-hero-eyebrow">
            <span className="home-hero-dot" />
            Qudurat &amp; Tahsili preparation for Saudi students
          </div>

          <h1 className="home-hero-title">
            Stop wasting time on random prep. Improve your score with a clear plan.
          </h1>

          <p className="home-hero-sub">
            DrFahm shows you exactly what to focus on so every hour you study actually improves your score.
          </p>

          {/* Exam selector — small toggle, not two competing buttons */}
          <div className="home-hero-exam-toggle">
            <button
              className={`home-hero-exam-btn ${selectedExam === 'qudurat' ? 'active' : ''}`}
              onClick={() => setSelectedExam('qudurat')}
            >
              Qudurat
            </button>
            <button
              className={`home-hero-exam-btn ${selectedExam === 'tahsili' ? 'active' : ''}`}
              onClick={() => setSelectedExam('tahsili')}
            >
              Tahsili
            </button>
          </div>

          <div className="home-hero-actions">
            <button className="btn btn-green btn-lg" onClick={() => handleStart(selectedExam)}>
              Start free trial
            </button>
          </div>

          <div className="home-hero-trust">
            <span>✓ 7-day free trial</span>
            <span>✓ No credit card required</span>
            <span>✓ Cancel anytime</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 14 }}>
            Start seeing what to fix from your first session.
          </p>
        </div>

        {/* Right: interactive demo — shows structured questions, not just a question bank */}
        <div className={`home-hero-visual ${heroVisible ? 'anim-in-delayed' : ''}`}>
          {demoFinished
            ? <DemoResult answers={demoAnswers} onStart={handleStart} />
            : <DemoWidget onFinish={handleDemoFinish} />
          }
        </div>
      </section>

      {/* ── 2. STATS — verifiable numbers only ───────────────────────────── */}
      <section className="home-section home-section-stats">
        <div className="home-container">
          <StatsSection />
        </div>
      </section>

      {/* ── 3. PROBLEM + REFRAME ─────────────────────────────────────────── */}
      <section className="home-section">
        <div className="home-container">
          <div className="home-problem-wrap">
            <div style={{ marginBottom: 32 }}>
              <div className="home-section-tag">Why most students don't improve</div>
              <h2 className="home-section-title" style={{ marginTop: 14, textAlign: 'left' }}>
                The problem isn't effort. It's structure.
              </h2>
            </div>

            <p className="home-problem-para">
              Most students prepare randomly. They jump between topics, repeat the same mistakes, and never clearly see what they need to fix.
            </p>
            <p className="home-problem-para">
              Crash courses feel intense, but intensity isn't the same as improvement. Focus is.
            </p>
            <p className="home-problem-para">
              That's why progress feels slow, even when you're putting in real effort.
            </p>

            <div className="home-problem-highlight">
              You don't need more questions. You need the right focus.
            </div>

            <p className="home-problem-para">
              Without a clear plan, it's easy to spend weeks studying without moving your score enough.
            </p>
            <p className="home-problem-closing">
              Working harder isn't the problem. Working without structure is.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. CORE VALUE ────────────────────────────────────────────────── */}
      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">What makes DrFahm different</h2>
          </div>
          <div className="home-value-grid">
            {VALUE_CARDS.map((card, i) => (
              <AnimatedCard
                key={card.title}
                className="home-value-card"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="home-value-icon">{card.icon}</div>
                <h3 className="home-value-title">{card.title}</h3>
                <p className="home-value-body">{card.body}</p>
              </AnimatedCard>
            ))}
          </div>
          <div className="home-micro-cta">
            <button onClick={() => handleStart(selectedExam)}>
              Start your free trial now →
            </button>
          </div>
        </div>
      </section>

      {/* ── 5. BUILT FOR YOUR SITUATION ──────────────────────────────────── */}
      <section className="home-section">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">Built for your situation</h2>
          </div>
          <div className="home-situation-grid">
            {SITUATION_CARDS.map((card, i) => (
              <AnimatedCard
                key={card.title}
                className="home-situation-card"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="home-situation-label">{card.label}</div>
                <h3 className="home-situation-title">{card.title}</h3>
                <p className="home-situation-body">{card.body}</p>
              </AnimatedCard>
            ))}
          </div>
          <p className="home-situation-support">
            Whether your exam is in 2 weeks or 2 months, focus matters more than volume.
          </p>
        </div>
      </section>

      {/* ── 6. COMPARISON — no fabricated testimonials ───────────────────── */}
      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">Better than random prep and crash courses</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.95rem' }}>
              Students across Saudi Arabia are using DrFahm to prepare for their next attempt.
            </p>
          </div>

          <div className="home-comparison-grid">
            {/* Left: typical prep (muted) */}
            <div className="home-comparison-col col-negative">
              <div className="home-comparison-col-title">Typical preparation</div>
              <div className="home-comparison-items">
                {COMPARISON_LEFT.map((item) => (
                  <div key={item} className="home-comparison-item">
                    <Minus size={15} className="home-comparison-icon" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: DrFahm (positive) */}
            <div className="home-comparison-col col-positive">
              <div className="home-comparison-col-title">DrFahm</div>
              <div className="home-comparison-items">
                {COMPARISON_RIGHT.map((item) => (
                  <div key={item} className="home-comparison-item">
                    <Check size={15} className="home-comparison-icon" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="home-comparison-closing">
            Doing more isn't the same as improving. Focus is what moves your score.
          </p>

          <div className="home-micro-cta">
            <button onClick={() => handleStart(selectedExam)}>
              Start your free trial now →
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="home-section">
        <div className="home-container">
          <div
            ref={ctaRef}
            className={`home-cta-strip ${ctaInView ? 'anim-in' : ''}`}
          >
            <div className="home-cta-strip-glow" />
            <h2 className="home-cta-strip-title">
              Start your free trial and see what to fix from your first session.
            </h2>
            <p className="home-cta-strip-sub">
              Choose your exam, follow a structured plan, and start improving from day one.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-green btn-lg" onClick={() => handleStart('qudurat')}>
                Start free — Qudurat
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => handleStart('tahsili')}>
                Start free — Tahsili
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>
              No credit card required
            </p>
            <p className="home-cta-strip-footnote">
              Already have an account?{' '}
              <Link to="/login" className="link">Log in</Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── 8. FOOTER ────────────────────────────────────────────────────── */}
      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <span className="navbar-logo">
                <span className="logo-dr">Dr</span><span className="logo-fahm">Fahm</span>
              </span>
              <p className="home-footer-tagline">
                Built for Saudi students preparing for Qudurat &amp; Tahsili.
              </p>
            </div>
            <div className="home-footer-links">
              <Link to="/pricing"  className="home-footer-link">Pricing</Link>
              <Link to="/schools"  className="home-footer-link">For Schools</Link>
              <Link to="/login"    className="home-footer-link">Log In</Link>
              <a
                href="https://wa.me/XXXXXX"
                className="home-footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a href="mailto:support@drfahm.com" className="home-footer-link">
                Support
              </a>
            </div>
          </div>
          <div className="home-footer-bottom">
            © {new Date().getFullYear()} DrFahm. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ── FLOATING WHATSAPP — mandatory for KSA market ─────────────────── */}
      <div className="whatsapp-float">
        <a
          href="https://wa.me/XXXXXX"
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-float-btn"
          aria-label="Chat with us on WhatsApp"
        >
          {/* Official WhatsApp icon path */}
          <svg
            className="whatsapp-float-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span className="whatsapp-float-label">Ask us anything</span>
        </a>
      </div>
    </>
  );
}