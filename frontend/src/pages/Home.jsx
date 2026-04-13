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
  <svg width="130" height="130" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(239,68,68,0.15)"/>
        <stop offset="100%" stopColor="rgba(239,68,68,0.02)"/>
      </radialGradient>
      <linearGradient id="arr1" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#EF4444"/>
        <stop offset="100%" stopColor="#F97316"/>
      </linearGradient>
    </defs>
    <circle cx="65" cy="65" r="60" fill="url(#bg1)"/>
    {/* Chaotic arrows pointing every direction */}
    {/* Right arrow — then blocked */}
    <path d="M22 50 L52 50" stroke="url(#arr1)" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M47 44 L54 50 L47 56" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <line x1="58" y1="43" x2="58" y2="57" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="54" y1="43" x2="62" y2="57" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
    {/* Down arrow */}
    <path d="M85 22 L85 52" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M79 47 L85 54 L91 47" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Left arrow — going backward */}
    <path d="M108 80 L78 80" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M83 74 L76 80 L83 86" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Looping arrow — going in circles */}
    <path d="M38 72 Q20 72 20 88 Q20 104 38 104 L55 104" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    <path d="M51 99 L57 105 L51 111" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Diagonal confused arrow */}
    <path d="M65 62 L95 92" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 4"/>
    <path d="M91 88 L96 93 L91 98" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Central question mark */}
    <circle cx="65" cy="65" r="14" fill="rgba(239,68,68,0.15)" stroke="#EF4444" strokeWidth="2"/>
    <text x="65" y="71" textAnchor="middle" fill="#EF4444" fontSize="16" fontWeight="900" fontFamily="Arial">?</text>
  </svg>
);

const IllustrationNoVisibility = () => (
  <svg width="130" height="130" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(239,68,68,0.15)"/>
        <stop offset="100%" stopColor="rgba(239,68,68,0.02)"/>
      </radialGradient>
      <linearGradient id="bar1" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#EF4444"/>
        <stop offset="100%" stopColor="#F87171"/>
      </linearGradient>
      <linearGradient id="bar2" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#DC2626"/>
        <stop offset="100%" stopColor="#EF4444"/>
      </linearGradient>
    </defs>
    <circle cx="65" cy="65" r="60" fill="url(#bg2)"/>
    {/* Bar chart bars underneath */}
    <rect x="20" y="85" width="16" height="28" rx="3" fill="url(#bar1)" opacity="0.4"/>
    <rect x="42" y="68" width="16" height="45" rx="3" fill="url(#bar1)" opacity="0.4"/>
    <rect x="64" y="52" width="16" height="61" rx="3" fill="url(#bar2)" opacity="0.4"/>
    <rect x="86" y="38" width="16" height="75" rx="3" fill="url(#bar2)" opacity="0.4"/>
    {/* Fog block covering everything */}
    <rect x="14" y="30" width="100" height="72" rx="10" fill="rgba(13,31,53,0.82)"/>
    {/* Large eye shape */}
    <path d="M25 66 Q65 36 105 66 Q65 96 25 66Z" stroke="rgba(252,165,165,0.5)" strokeWidth="2" fill="rgba(252,165,165,0.06)"/>
    {/* Iris */}
    <circle cx="65" cy="66" r="14" fill="rgba(239,68,68,0.12)" stroke="#F87171" strokeWidth="1.5"/>
    <circle cx="65" cy="66" r="7" fill="rgba(239,68,68,0.2)" stroke="#EF4444" strokeWidth="1.5"/>
    <circle cx="65" cy="66" r="3" fill="#EF4444"/>
    {/* Bold diagonal slash */}
    <line x1="24" y1="25" x2="106" y2="107" stroke="#EF4444" strokeWidth="4" strokeLinecap="round"/>
    <line x1="22" y1="23" x2="108" y2="109" stroke="rgba(239,68,68,0.25)" strokeWidth="8" strokeLinecap="round"/>
    {/* Question marks floating */}
    <text x="32" y="55" fill="rgba(252,165,165,0.5)" fontSize="13" fontWeight="700" fontFamily="Arial">?</text>
    <text x="88" y="50" fill="rgba(252,165,165,0.5)" fontSize="11" fontWeight="700" fontFamily="Arial">?</text>
    <text x="58" y="48" fill="rgba(252,165,165,0.35)" fontSize="9" fontWeight="700" fontFamily="Arial">?</text>
  </svg>
);

const IllustrationWastedEffort = () => (
  <svg width="130" height="130" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(239,68,68,0.15)"/>
        <stop offset="100%" stopColor="rgba(239,68,68,0.02)"/>
      </radialGradient>
      <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F87171"/>
        <stop offset="100%" stopColor="#EF4444"/>
      </linearGradient>
    </defs>
    <circle cx="65" cy="65" r="60" fill="url(#bg3)"/>
    {/* Hourglass outline */}
    <path d="M38 18 L92 18 L92 22 L70 50 L70 80 L92 108 L92 112 L38 112 L38 108 L60 80 L60 50 L38 22 Z" stroke="#F87171" strokeWidth="2.5" fill="rgba(239,68,68,0.06)" strokeLinejoin="round"/>
    {/* Top sand (almost empty) */}
    <path d="M42 24 L88 24 L72 46 L58 46 Z" fill="rgba(239,68,68,0.18)"/>
    <path d="M80 24 L88 24 L72 46 L68 46 Z" fill="rgba(239,68,68,0.35)"/>
    {/* Sand stream falling */}
    <line x1="65" y1="50" x2="65" y2="80" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3"/>
    {/* Bottom sand (filling up) */}
    <path d="M58 84 L72 84 L88 106 L42 106 Z" fill="rgba(239,68,68,0.25)"/>
    <path d="M58 84 L72 84 L80 98 L50 98 Z" fill="rgba(239,68,68,0.35)"/>
    {/* X badge — effort wasted */}
    <circle cx="96" cy="26" r="16" fill="#1a0a0a" stroke="#EF4444" strokeWidth="2"/>
    <line x1="88" y1="18" x2="104" y2="34" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="104" y1="18" x2="88" y2="34" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round"/>
    {/* Urgency lines beside hourglass */}
    <line x1="20" y1="38" x2="30" y2="38" stroke="rgba(249,115,22,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="16" y1="50" x2="28" y2="50" stroke="rgba(249,115,22,0.4)" strokeWidth="2" strokeLinecap="round"/>
    <line x1="20" y1="62" x2="30" y2="62" stroke="rgba(249,115,22,0.3)" strokeWidth="2" strokeLinecap="round"/>
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

  const [heroVisible, setHeroVisible] = useState(false);
  const [selectedExam, setSelectedExam] = useState('qudurat');
  const [demoFinished, setDemoFinished] = useState(false);
  const [demoAnswers, setDemoAnswers] = useState([]);

  const [ctaRef, ctaInView] = useInView(0.2);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleExamChange = (exam) => {
    setSelectedExam(exam);
    setDemoFinished(false);
    setDemoAnswers([]);
  };

  const handleStart = (exam) => {
    const target = exam || selectedExam;
    if (user) navigate(`/exam/${target}`);
    else navigate(`/register?exam=${target}`);
  };

  const handleDemoFinish = (answers) => {
    setDemoAnswers(answers);
    setDemoFinished(true);
  };

  const demoQuestions =
    selectedExam === 'tahsili' ? TAHSILI_DEMO_QUESTIONS : QUDURAT_DEMO_QUESTIONS;
  const demoLabel =
    selectedExam === 'tahsili' ? 'Tahsili · Science' : 'Qudurat · Math';

  return (
    <>
      <Navbar />

      <section className="home-hero home-hero-premium">
        <div className="home-hero-bg-orb orb-1" />
        <div className="home-hero-bg-orb orb-2" />
        <div className="home-hero-grid">
          <div className={`home-hero-content ${heroVisible ? 'anim-in' : ''}`}>
            <div className="home-hero-eyebrow premium-eyebrow">
              <span className="home-hero-dot" />
              Qudurat &amp; Tahsili preparation for Saudi students
            </div>

            <h1 className="home-hero-title premium-title">
              Prepare smarter.
              <br />
              Raise your score with a clear, structured path.
            </h1>

            <p className="home-hero-sub premium-sub">
              DrFahm helps students focus on the topics that matter most, track
              progress clearly, and stop wasting time on random prep.
            </p>

            <div className="home-hero-exam-toggle premium-toggle">
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

            <div className="home-hero-actions premium-actions">
              <button className="btn btn-green btn-lg hero-primary-btn" onClick={() => handleStart(selectedExam)}>
                Start free trial
              </button>

              <Link to="/pricing" className="hero-secondary-link">
                View pricing
              </Link>
            </div>

            <div className="home-hero-trust premium-trust">
              <span>7-day free trial</span>
              <span>No credit card required</span>
              <span>Cancel anytime</span>
            </div>

            <div className="hero-proof-row">
              <div className="hero-proof-card">
                <div className="hero-proof-number">6,000+</div>
                <div className="hero-proof-label">exam-style questions</div>
              </div>
              <div className="hero-proof-card">
                <div className="hero-proof-number">300</div>
                <div className="hero-proof-label">mastery levels</div>
              </div>
              <div className="hero-proof-card">
                <div className="hero-proof-number">2</div>
                <div className="hero-proof-label">core exams covered</div>
              </div>
            </div>
          </div>

          <div className={`home-hero-visual premium-hero-visual ${heroVisible ? 'anim-in-delayed' : ''}`}>
            <div className="hero-demo-shell">
              <div className="hero-demo-shell-top">
                <span className="hero-demo-pill">
                  Live practice preview
                </span>
                <span className="hero-demo-note">
                  Instant feedback feel
                </span>
              </div>

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
          </div>
        </div>
      </section>

      <section className="home-section home-section-stats">
        <StatsSection />
      </section>

      <section className="prob-section">
        <div className="prob-orb prob-orb-1" />
        <div className="prob-orb prob-orb-2" />
        <div className="prob-orb prob-orb-3" />
        <Cube3D />

        <div className="home-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="prob-header">
            <div className="prob-eyebrow">Why scores stay stuck</div>
            <h2 className="prob-headline">
              The issue is not
              {' '}
              <span className="prob-headline-accent">hard work</span>.
              <br />
              It is lack of structure.
            </h2>
            <p className="prob-subhead">
              Many students put in real effort, but without a focused system,
              progress stays unclear and improvement stays inconsistent.
            </p>
          </div>

          <div className="prob-cards">
            {[
              {
                num: '01',
                Illustration: IllustrationNoPath,
                title: 'No clear path',
                text: 'Random prep creates motion, but not real direction. Students keep working without knowing what comes next.',
              },
              {
                num: '02',
                Illustration: IllustrationNoVisibility,
                title: 'No visibility',
                text: 'Weak areas remain hidden, so students repeat what feels familiar instead of fixing what limits their score.',
              },
              {
                num: '03',
                Illustration: IllustrationWastedEffort,
                title: 'Wasted effort',
                text: 'More hours alone do not guarantee improvement. Quality of focus matters more than volume of practice.',
              },
            ].map((item, i) => (
              <div key={item.num} className="prob-card" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="prob-card-svg-wrap">
                  <item.Illustration />
                </div>
                <h3 className="prob-card-title">{item.title}</h3>
                <p className="prob-card-text">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="prob-divider">
            <div className="prob-divider-line" />
            <div className="prob-divider-badge">What students actually need</div>
            <div className="prob-divider-line" />
          </div>

          <div className="prob-solution">
            <div className="prob-solution-border" />
            <div className="prob-solution-inner">
              <div className="prob-solution-icon">→</div>
              <div>
                <p className="prob-solution-main">
                  A structured preparation path that tells them exactly what to do next.
                </p>
                <p className="prob-solution-sub">
                  That is where DrFahm changes the experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-section-header">
            <div className="home-section-tag">Why DrFahm works</div>
            <h2 className="home-section-title">Built to turn effort into measurable progress</h2>
          </div>

          <div className="home-value-grid">
            {VALUE_CARDS.map((card, i) => (
              <AnimatedCard
                key={card.title}
                className="home-value-card premium-surface-card"
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

      <section className="home-section">
        <div className="home-container">
          <div className="home-section-header">
            <div className="home-section-tag">Use case fit</div>
            <h2 className="home-section-title">Built for the way students actually prepare</h2>
          </div>

          <div className="home-situation-grid">
            {SITUATION_CARDS.map((card, i) => (
              <AnimatedCard
                key={card.title}
                className="home-situation-card premium-surface-card"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="home-value-icon">{card.icon}</div>
                <div className="home-situation-label">{card.label}</div>
                <h3 className="home-situation-title">{card.title}</h3>
                <p className="home-situation-body">{card.body}</p>
              </AnimatedCard>
            ))}
          </div>

          <p className="home-situation-support">
            Whether the exam is soon or still months away, clarity beats random repetition.
          </p>
        </div>
      </section>

      <section className="home-section home-section-alt">
        <div className="home-container">
          <div className="home-section-header">
            <div className="home-section-tag">Comparison</div>
            <h2 className="home-section-title">Better than random prep and generic crash courses</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.95rem' }}>
              DrFahm is designed to make every session feel purposeful.
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
            Doing more is not the same as improving more. Focus is what changes the result.
          </p>

          <div className="home-micro-cta">
            <button onClick={() => handleStart(selectedExam)}>
              Start your free trial now →
            </button>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-container">
          <div ref={ctaRef} className={`home-cta-strip premium-final-cta ${ctaInView ? 'anim-in' : ''}`}>
            <div className="home-cta-strip-glow" />
            <h2 className="home-cta-strip-title">
              Start your free trial and see what to improve from your very first session.
            </h2>
            <p className="home-cta-strip-sub">
              Choose your exam, follow a structured path, and prepare with far more clarity.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-green btn-lg hero-primary-btn" onClick={() => handleStart(selectedExam)}>
                Start free — {selectedExam === 'tahsili' ? 'Tahsili' : 'Qudurat'}
              </button>

              <button
                onClick={() => handleStart(selectedExam === 'tahsili' ? 'qudurat' : 'tahsili')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--cta-green)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
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
              Already have an account? <Link to="/login" className="link">Log in</Link>
            </p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <span className="navbar-logo">
                <span className="logo-dr">Dr</span>
                <span className="logo-fahm">Fahm</span>
              </span>
              <p className="home-footer-tagline">
                Premium exam preparation for Saudi students preparing for Qudurat and Tahsili.
              </p>
            </div>

            <div className="home-footer-links">
              <Link to="/pricing" className="home-footer-link">Pricing</Link>
              <Link to="/schools" className="home-footer-link">For Schools</Link>
              <Link to="/login" className="home-footer-link">Log In</Link>
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
    </>
  );
}