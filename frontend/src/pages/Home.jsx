import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import { BookOpen, Target, TrendingUp, Zap, BarChart2, Award, Check, Minus } from 'lucide-react';

const WA_NUMBER  = '447346463512';
const WA_MESSAGE = encodeURIComponent('Hi, I have a question about DrFahm');

// ── Demo questions ────────────────────────────────────────────────────────────
const QUDURAT_DEMO_QUESTIONS = [
  {
    id: 'q1',
    question_text: 'If $\\frac{x}{y} = 7$, find the value of $\\frac{x + 3y}{2y}$',
    option_a: '5', option_b: '$\\frac{3}{7}$', option_c: '10', option_d: '21',
    correct_answer: 'a',
  },
  {
    id: 'q2',
    question_text: 'A car travels 120 km in 2 hours. What is its average speed in km/h?',
    option_a: '40', option_b: '60', option_c: '80', option_d: '100',
    correct_answer: 'b',
  },
  {
    id: 'q3',
    question_text: 'If $2x + 3 = 15$, what is the value of $x^{2}$?',
    option_a: '6', option_b: '12', option_c: '36', option_d: '144',
    correct_answer: 'c',
  },
];

const TAHSILI_DEMO_QUESTIONS = [
  {
    id: 't1',
    question_text: 'Which organelle is responsible for producing energy (ATP) in a cell?',
    option_a: 'Nucleus', option_b: 'Ribosome', option_c: 'Mitochondria', option_d: 'Golgi apparatus',
    correct_answer: 'c',
  },
  {
    id: 't2',
    question_text: 'What is the value of $\\sin(90°)$?',
    option_a: '0', option_b: '$\\frac{1}{2}$', option_c: '$\\frac{\\sqrt{2}}{2}$', option_d: '1',
    correct_answer: 'd',
  },
  {
    id: 't3',
    question_text: 'What type of bond holds the two strands of DNA together?',
    option_a: 'Ionic bonds', option_b: 'Hydrogen bonds', option_c: 'Covalent bonds', option_d: 'Peptide bonds',
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
  const ref   = useRef(null);
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

// ── Mini circular timer ───────────────────────────────────────────────────────
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
        <circle cx={24} cy={24} r={norm} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circum}`} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px', transition: 'stroke-dasharray 0.25s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color,
      }}>
        {secondsLeft}
      </div>
    </div>
  );
}

// ── Interactive demo widget ───────────────────────────────────────────────────
function DemoWidget({ onFinish, questions, examLabel }) {
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
    if (nextIdx >= questions.length) {
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
  }, [answers, onFinish, questions.length]);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
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
    const correct = key === questions[qIndex].correct_answer;
    advRef.current = setTimeout(() => advance(correct, qIndex + 1), 700);
  };

  const q    = questions[qIndex];
  const opts = [
    { key: 'a', text: q.option_a },
    { key: 'b', text: q.option_b },
    { key: 'c', text: q.option_c },
    { key: 'd', text: q.option_d },
  ];

  return (
    <div className="demo-widget">
      <div className="demo-header">
        <div className="demo-label">
          <span className="demo-sub">{examLabel} · Question {qIndex + 1} of {questions.length}</span>
        </div>
        <MiniTimer secondsLeft={timeLeft} total={DEMO_TIMER} />
      </div>

      <div className={`demo-qwrap ${animDir}`}>
        <p className="demo-question"><MathText text={q.question_text} /></p>
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

      <div className="demo-dots">
        {questions.map((_, i) => (
          <div key={i} className={`demo-dot ${i < qIndex ? 'done' : i === qIndex ? 'current' : ''}`} />
        ))}
      </div>
    </div>
  );
}

// ── Demo result — single primary CTA + text link ──────────────────────────────
function DemoResult({ answers, onStart, exam }) {
  const score = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const pct   = Math.round((score / total) * 100);
  const alt   = exam === 'qudurat' ? 'tahsili' : 'qudurat';

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

      {/* ── Single primary CTA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 20 }}>
        <button className="btn btn-green btn-lg btn-full" onClick={() => onStart(exam)}>
          Start free — {exam === 'qudurat' ? 'Qudurat' : 'Tahsili'}
        </button>
        <button
          onClick={() => onStart(alt)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#15803D', fontSize: '0.875rem', fontWeight: 600,
            fontFamily: 'Tajawal, sans-serif', padding: '4px 0',
          }}
        >
          or start with {alt === 'qudurat' ? 'Qudurat' : 'Tahsili'} →
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
        7-day free trial · No credit card required
      </p>
    </div>
  );
}

// ── Stats section ─────────────────────────────────────────────────────────────
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
    </div>
  );
}

// ── AnimatedCard ──────────────────────────────────────────────────────────────
function AnimatedCard({ children, className, style }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`${className} ${inView ? 'anim-in' : ''}`} style={style}>
      {children}
    </div>
  );
}

// ── Value cards ───────────────────────────────────────────────────────────────
const VALUE_CARDS = [
  {
    icon:  <BookOpen size={20} />,
    title: 'Know exactly what to study next',
    body:  'Follow a clear structured path based on your level — no guessing, no wasted sessions.',
  },
  {
    icon:  <Target size={20} />,
    title: 'Focus on what actually improves your score',
    body:  'Target weak areas instead of spending time on topics you already understand.',
  },
  {
    icon:  <TrendingUp size={20} />,
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

// ── Comparison ────────────────────────────────────────────────────────────────
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

// ── 3D Rotating cube — decorative element for problem section ─────────────────
function Cube3D() {
  return (
    <div className="cube3d-scene">
      <div className="cube3d-float">
        <div className="cube3d-halo" />
        {/* Outer cube */}
        <div className="cube3d-wrap">
          <div className="cube3d-face cube3d-front" />
          <div className="cube3d-face cube3d-back" />
          <div className="cube3d-face cube3d-left" />
          <div className="cube3d-face cube3d-right" />
          <div className="cube3d-face cube3d-top" />
          <div className="cube3d-face cube3d-bottom" />
        </div>
        {/* Inner counter-rotating cube */}
        <div className="cube3d-inner-wrap">
          <div className="cube3d-inner-face cube3d-front" />
          <div className="cube3d-inner-face cube3d-back" />
          <div className="cube3d-inner-face cube3d-left" />
          <div className="cube3d-inner-face cube3d-right" />
          <div className="cube3d-inner-face cube3d-top" />
          <div className="cube3d-inner-face cube3d-bottom" />
        </div>
      </div>
    </div>
  );
}

// ── SVG illustrations for problem cards ──────────────────────────────────────
const IllustrationNoPath = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background circle */}
    <circle cx="40" cy="40" r="36" fill="rgba(220,38,38,0.08)" />
    {/* Tangled arrows representing random/no structure */}
    {/* Arrow 1 — going right then blocked */}
    <path d="M16 32 L36 32" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
    <path d="M32 27 L36 32 L32 37" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Blocked line */}
    <line x1="39" y1="27" x2="39" y2="37" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
    {/* Arrow 2 — going down randomly */}
    <path d="M52 20 L52 36" stroke="#F97316" strokeWidth="3" strokeLinecap="round"/>
    <path d="M47 32 L52 36 L57 32" stroke="#F97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Arrow 3 — going diagonal, lost */}
    <path d="M20 50 L38 58" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
    <path d="M33 55 L38 58 L36 53" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Arrow 4 — looping back */}
    <path d="M55 46 Q68 46 68 56 Q68 66 55 66 L44 66" stroke="#F97316" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M48 62 L44 66 L48 70" stroke="#F97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Question mark in center */}
    <circle cx="28" cy="58" r="8" fill="rgba(220,38,38,0.15)" stroke="#EF4444" strokeWidth="1.5"/>
    <text x="28" y="62" textAnchor="middle" fill="#EF4444" fontSize="10" fontWeight="bold">?</text>
  </svg>
);

const IllustrationNoVisibility = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="36" fill="rgba(220,38,38,0.08)" />
    {/* Chart bars — going up like progress */}
    <rect x="14" y="52" width="10" height="16" rx="2" fill="#FCA5A5"/>
    <rect x="28" y="42" width="10" height="26" rx="2" fill="#F87171"/>
    <rect x="42" y="34" width="10" height="34" rx="2" fill="#EF4444"/>
    <rect x="56" y="24" width="10" height="44" rx="2" fill="#DC2626"/>
    {/* Fog overlay — semi transparent rectangles suggesting hidden data */}
    <rect x="10" y="20" width="60" height="46" rx="8" fill="rgba(13,31,53,0.75)"/>
    {/* Eye with line through it */}
    <ellipse cx="40" cy="40" rx="16" ry="10" stroke="rgba(252,165,165,0.6)" strokeWidth="2" fill="none"/>
    <circle cx="40" cy="40" r="5" fill="rgba(252,165,165,0.3)" stroke="#FCA5A5" strokeWidth="1.5"/>
    <circle cx="40" cy="40" r="2" fill="#FCA5A5"/>
    {/* Diagonal line through eye */}
    <line x1="26" y1="26" x2="54" y2="54" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const IllustrationWastedEffort = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="36" fill="rgba(220,38,38,0.08)" />
    {/* Clock face */}
    <circle cx="40" cy="40" r="22" stroke="#F87171" strokeWidth="2.5" fill="rgba(220,38,38,0.06)"/>
    <circle cx="40" cy="40" r="2.5" fill="#EF4444"/>
    {/* Clock hands */}
    <line x1="40" y1="40" x2="40" y2="23" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="40" y1="40" x2="52" y2="46" stroke="#F87171" strokeWidth="2" strokeLinecap="round"/>
    {/* Clock hour marks */}
    <line x1="40" y1="20" x2="40" y2="23" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round"/>
    <line x1="40" y1="57" x2="40" y2="60" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round"/>
    <line x1="20" y1="40" x2="23" y2="40" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round"/>
    <line x1="57" y1="40" x2="60" y2="40" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round"/>
    {/* X mark — effort wasted */}
    <circle cx="59" cy="20" r="10" fill="#0D1F35" stroke="#EF4444" strokeWidth="1.5"/>
    <line x1="54" y1="15" x2="64" y2="25" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="64" y1="15" x2="54" y2="25" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ── Problem bullets ───────────────────────────────────────────────────────────
const PROBLEM_BULLETS = [
  'Random prep with no clear structure or path',
  'No visibility into which topics are holding you back',
  'Hours studied ≠ score improvement without focus',
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

  // Reset demo when exam toggle changes
  const handleExamChange = (exam) => {
    setSelectedExam(exam);
    setDemoFinished(false);
    setDemoAnswers([]);
  };

  const handleStart = (exam) => {
    const target = exam || selectedExam;
    if (user) navigate(`/exam/${target}`);
    else      navigate(`/register?exam=${target}`);
  };

  const handleDemoFinish = (answers) => {
    setDemoAnswers(answers);
    setDemoFinished(true);
  };

  const demoQuestions = selectedExam === 'tahsili' ? TAHSILI_DEMO_QUESTIONS : QUDURAT_DEMO_QUESTIONS;
  const demoLabel     = selectedExam === 'tahsili' ? 'Tahsili · Science' : 'Qudurat · Math';

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

          <div className="home-hero-exam-toggle">
            <button
              className={`home-hero-exam-btn ${selectedExam === 'qudurat' ? 'active' : ''}`}
              onClick={() => handleExamChange('qudurat')}
            >
              Qudurat
            </button>
            <button
              className={`home-hero-exam-btn ${selectedExam === 'tahsili' ? 'active' : ''}`}
              onClick={() => handleExamChange('tahsili')}
            >
              Tahsili
            </button>
          </div>

          {/* ── Single universal CTA ── */}
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

        {/* Right: exam-aware demo widget */}
        <div className={`home-hero-visual ${heroVisible ? 'anim-in-delayed' : ''}`}>
          {demoFinished ? (
            <DemoResult answers={demoAnswers} onStart={handleStart} exam={selectedExam} />
          ) : (
            <DemoWidget
              key={selectedExam}
              questions={demoQuestions}
              examLabel={demoLabel}
              onFinish={handleDemoFinish}
            />
          )}
        </div>
      </section>

      {/* ── 2. STATS ─────────────────────────────────────────────────────── */}
      <section className="home-section home-section-stats">
        <StatsSection />
      </section>

      {/* ── 3. PROBLEM + REFRAME ─────────────────────────────────────────── */}
      <section className="prob-section">
        {/* Decorative background orbs */}
        <div className="prob-orb prob-orb-1" />
        <div className="prob-orb prob-orb-2" />
        <div className="prob-orb prob-orb-3" />
        {/* 3D floating cube */}
        <Cube3D />

        <div className="home-container" style={{ position: 'relative', zIndex: 1 }}>

          <div className="prob-header">
            <div className="prob-eyebrow">Why most students don't improve</div>
            <h2 className="prob-headline">
              The problem isn't <span className="prob-headline-accent">effort</span>.<br />It's structure.
            </h2>
            <p className="prob-subhead">
              Most students prepare the same way and wonder why their score stays flat.
            </p>
          </div>

          {/* Three problem cards — DrFrost large-icon style */}
          <div className="prob-cards">
            {[
              { num: '01', Illustration: IllustrationNoPath,        title: 'No clear path',   text: "Random prep with no structure means every session starts from scratch." },
              { num: '02', Illustration: IllustrationNoVisibility,  title: 'No visibility',   text: "You can't see which topics are actually holding your score back." },
              { num: '03', Illustration: IllustrationWastedEffort,  title: 'Wasted effort',   text: 'More hours studied does not automatically mean a better score.' },
            ].map((item, i) => (
              <div key={item.num} className="prob-card" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="prob-card-num">{item.num}</span>
                <div className="prob-card-svg-wrap">
                  <item.Illustration />
                </div>
                <h3 className="prob-card-title">{item.title}</h3>
                <p className="prob-card-text">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Transform divider */}
          <div className="prob-divider">
            <div className="prob-divider-line" />
            <div className="prob-divider-badge">The result</div>
            <div className="prob-divider-line" />
          </div>

          {/* Solution callout */}
          <div className="prob-solution">
            <div className="prob-solution-border" />
            <div className="prob-solution-inner">
              <div className="prob-solution-icon">→</div>
              <div>
                <p className="prob-solution-main">
                  Scores don't improve — even with real effort.
                </p>
                <p className="prob-solution-sub">
                  You don't need more questions. You need the right focus.
                </p>
              </div>
            </div>
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

      {/* ── 6. COMPARISON ────────────────────────────────────────────────── */}
      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-section-header">
            <h2 className="home-section-title">Better than random prep and crash courses</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.95rem' }}>
              Students across Saudi Arabia are using DrFahm to prepare for their next attempt.
            </p>
          </div>

          <div className="home-comparison-grid">
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
          <div ref={ctaRef} className={`home-cta-strip ${ctaInView ? 'anim-in' : ''}`}>
            <div className="home-cta-strip-glow" />
            <h2 className="home-cta-strip-title">
              Start your free trial and see what to fix from your first session.
            </h2>
            <p className="home-cta-strip-sub">
              Choose your exam, follow a structured plan, and start improving from day one.
            </p>

            {/* Single primary + text secondary */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-green btn-lg" onClick={() => handleStart(selectedExam)}>
                Start free — {selectedExam === 'tahsili' ? 'Tahsili' : 'Qudurat'}
              </button>
              <button
                onClick={() => handleStart(selectedExam === 'tahsili' ? 'qudurat' : 'tahsili')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#15803D', fontSize: '0.875rem', fontWeight: 600,
                  fontFamily: 'Tajawal, sans-serif',
                }}
              >
                or start with {selectedExam === 'tahsili' ? 'Qudurat' : 'Tahsili'} →
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
              <Link to="/pricing" className="home-footer-link">Pricing</Link>
              <Link to="/schools" className="home-footer-link">For Schools</Link>
              <Link to="/login"   className="home-footer-link">Log In</Link>
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`}
                className="home-footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a href="mailto:info@drfahm.com" className="home-footer-link">
                Support
              </a>
            </div>
          </div>
          <div className="home-footer-bottom">
            © {new Date().getFullYear()} DrFahm. All rights reserved.
          </div>
        </div>
      </footer>

      {/* WhatsApp float is rendered globally in App.jsx */}
    </>
  );
}