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

// ── Animated SVG illustrations ────────────────────────────────────────────────
const IllustrationNoPath = () => (
  <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes spin-slow { from{transform-origin:70px 70px;transform:rotate(0deg)} to{transform-origin:70px 70px;transform:rotate(360deg)} }
      @keyframes bounce-q1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes bounce-q2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes bounce-q3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      @keyframes arrow-flash { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes sign-wobble { 0%,100%{transform:rotate(0deg);transform-origin:70px 90px} 25%{transform:rotate(-4deg);transform-origin:70px 90px} 75%{transform:rotate(4deg);transform-origin:70px 90px} }
      .np-spin { animation: spin-slow 8s linear infinite; }
      .np-q1   { animation: bounce-q1 1.8s ease-in-out infinite; }
      .np-q2   { animation: bounce-q2 2.2s ease-in-out infinite 0.3s; }
      .np-q3   { animation: bounce-q3 2s ease-in-out infinite 0.6s; }
      .np-arr1 { animation: arrow-flash 1.4s ease-in-out infinite; }
      .np-arr2 { animation: arrow-flash 1.4s ease-in-out infinite 0.5s; }
      .np-arr3 { animation: arrow-flash 1.4s ease-in-out infinite 1s; }
      .np-signs{ animation: sign-wobble 3s ease-in-out infinite; }
    `}</style>
    <defs>
      <linearGradient id="np_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF1F2"/><stop offset="100%" stopColor="#FEE2E2"/></linearGradient>
      <linearGradient id="np_road" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818CF8"/><stop offset="100%" stopColor="#6366F1"/></linearGradient>
    </defs>
    <circle cx="70" cy="70" r="66" fill="url(#np_bg)"/>
    <ellipse cx="70" cy="112" rx="32" ry="6" fill="rgba(0,0,0,0.07)"/>
    {/* Road stem */}
    <rect x="64" y="88" width="12" height="24" rx="6" fill="url(#np_road)"/>
    <line x1="70" y1="98" x2="70" y2="106" stroke="white" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3"/>
    {/* Sign post */}
    <rect x="68" y="62" width="4" height="30" rx="2" fill="#92400E"/>
    {/* Rotating arrows group */}
    <g className="np-signs">
      {/* Left sign */}
      <rect x="28" y="56" width="34" height="13" rx="3" fill="#EF4444"/>
      <path d="M28 62.5 L22 56 L22 69 Z" fill="#EF4444"/>
      <line x1="34" y1="62" x2="54" y2="62" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M49 59 L54 62 L49 65" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Right sign */}
      <rect x="78" y="46" width="34" height="13" rx="3" fill="#10B981"/>
      <path d="M112 52.5 L118 46 L118 59 Z" fill="#10B981"/>
      <line x1="82" y1="52" x2="102" y2="52" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M88 49 L83 52 L88 55" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Up sign */}
      <rect x="48" y="30" width="28" height="13" rx="3" fill="#F59E0B"/>
      <path d="M62 30 L70 22 L78 30 Z" fill="#F59E0B"/>
      <text x="62" y="41" fill="white" fontSize="7" fontWeight="800" fontFamily="Arial" textAnchor="middle">↑</text>
    </g>
    {/* Spinning confused circle */}
    <circle cx="70" cy="70" r="10" fill="rgba(99,102,241,0.1)" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4 3" className="np-spin"/>
    {/* Bouncing question marks */}
    <g className="np-q1"><text x="18" y="42" fill="#F59E0B" fontSize="20" fontWeight="900" fontFamily="Arial">?</text></g>
    <g className="np-q2"><text x="108" y="36" fill="#EF4444" fontSize="16" fontWeight="900" fontFamily="Arial">?</text></g>
    <g className="np-q3"><text x="112" y="82" fill="#6366F1" fontSize="14" fontWeight="900" fontFamily="Arial">?</text></g>
    {/* Flashing arrows */}
    <g className="np-arr1"><path d="M14 72 L26 72" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/><path d="M22 68 L27 72 L22 76" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></g>
    <g className="np-arr2"><path d="M126 56 L114 56" stroke="#10B981" strokeWidth="3" strokeLinecap="round"/><path d="M118 52 L113 56 L118 60" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></g>
    <g className="np-arr3"><path d="M38 112 L28 100" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round"/><path d="M31 104 L27 99 L33 97" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></g>
  </svg>
);

const IllustrationNoVisibility = () => (
  <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes fog-drift1 { 0%,100%{transform:translateX(0)} 50%{transform:translateX(8px)} }
      @keyframes fog-drift2 { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-10px)} }
      @keyframes fog-drift3 { 0%,100%{transform:translateX(0)} 50%{transform:translateX(6px)} }
      @keyframes lock-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      @keyframes twinkle1 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} }
      @keyframes twinkle2 { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
      @keyframes twinkle3 { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
      @keyframes bar-grow  { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
      .nv-fog1  { animation: fog-drift1 3s ease-in-out infinite; }
      .nv-fog2  { animation: fog-drift2 4s ease-in-out infinite 0.5s; }
      .nv-fog3  { animation: fog-drift3 3.5s ease-in-out infinite 1s; }
      .nv-lock  { animation: lock-pulse 2s ease-in-out infinite; transform-origin:70px 72px; }
      .nv-star1 { animation: twinkle1 1.6s ease-in-out infinite; }
      .nv-star2 { animation: twinkle2 2s ease-in-out infinite 0.4s; }
      .nv-star3 { animation: twinkle3 1.8s ease-in-out infinite 0.8s; }
      .nv-bars  { animation: bar-grow 2.5s ease-in-out infinite; }
    `}</style>
    <defs>
      <linearGradient id="nv_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EFF6FF"/><stop offset="100%" stopColor="#F0FDF4"/></linearGradient>
      <linearGradient id="nv_b1" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#93C5FD"/></linearGradient>
      <linearGradient id="nv_b2" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#6EE7B7"/></linearGradient>
      <linearGradient id="nv_b3" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#FCD34D"/></linearGradient>
      <linearGradient id="nv_b4" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#C4B5FD"/></linearGradient>
    </defs>
    <circle cx="70" cy="70" r="66" fill="url(#nv_bg)"/>
    {/* Chart frame */}
    <rect x="18" y="32" width="104" height="80" rx="10" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
    {/* Colorful bars */}
    <g className="nv-bars">
      <rect x="28" y="84" width="18" height="20" rx="3" fill="url(#nv_b1)"/>
      <rect x="52" y="68" width="18" height="36" rx="3" fill="url(#nv_b2)"/>
      <rect x="76" y="54" width="18" height="50" rx="3" fill="url(#nv_b3)"/>
      <rect x="100" y="42" width="18" height="62" rx="3" fill="url(#nv_b4)"/>
    </g>
    {/* Animated fog layers */}
    <g className="nv-fog1"><ellipse cx="50" cy="70" rx="30" ry="18" fill="rgba(203,213,225,0.75)"/></g>
    <g className="nv-fog2"><ellipse cx="90" cy="62" rx="32" ry="20" fill="rgba(203,213,225,0.72)"/></g>
    <g className="nv-fog3"><ellipse cx="70" cy="82" rx="38" ry="16" fill="rgba(203,213,225,0.7)"/></g>
    <g className="nv-fog1"><ellipse cx="36" cy="82" rx="22" ry="14" fill="rgba(226,232,240,0.65)"/></g>
    <g className="nv-fog2"><ellipse cx="104" cy="78" rx="22" ry="13" fill="rgba(226,232,240,0.6)"/></g>
    {/* Pulsing padlock */}
    <g className="nv-lock">
      <rect x="52" y="62" width="36" height="28" rx="6" fill="#475569"/>
      <path d="M61 62 L61 54 Q61 44 70 44 Q79 44 79 54 L79 62" stroke="#475569" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <circle cx="70" cy="74" r="6" fill="#94A3B8"/>
      <rect x="68" y="74" width="4" height="8" rx="2" fill="#94A3B8"/>
    </g>
    {/* Twinkling stars */}
    <g className="nv-star1"><path d="M118 24 L120.5 18 L123 24 L129 26.5 L123 29 L120.5 35 L118 29 L112 26.5 Z" fill="#F59E0B"/></g>
    <g className="nv-star2"><path d="M14 96 L16 91 L18 96 L23 98 L18 100 L16 105 L14 100 L9 98 Z" fill="#3B82F6"/></g>
    <g className="nv-star3"><path d="M118 100 L120 96 L122 100 L126 102 L122 104 L120 108 L118 104 L114 102 Z" fill="#10B981"/></g>
  </svg>
);

const IllustrationWastedEffort = () => (
  <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes wheel-spin  { from{transform-origin:70px 76px;transform:rotate(0deg)} to{transform-origin:70px 76px;transform:rotate(360deg)} }
      @keyframes run-leg1    { 0%,100%{transform:rotate(0deg);transform-origin:70px 84px} 50%{transform:rotate(28deg);transform-origin:70px 84px} }
      @keyframes run-leg2    { 0%,100%{transform:rotate(0deg);transform-origin:70px 84px} 50%{transform:rotate(-28deg);transform-origin:70px 84px} }
      @keyframes run-arm1    { 0%,100%{transform:rotate(0deg);transform-origin:67px 68px} 50%{transform:rotate(30deg);transform-origin:67px 68px} }
      @keyframes run-arm2    { 0%,100%{transform:rotate(0deg);transform-origin:73px 68px} 50%{transform:rotate(-30deg);transform-origin:73px 68px} }
      @keyframes sweat-drop1 { 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(-8px,14px);opacity:0} }
      @keyframes sweat-drop2 { 0%{transform:translate(0,0);opacity:0.8} 100%{transform:translate(-6px,18px);opacity:0} }
      @keyframes sweat-drop3 { 0%{transform:translate(0,0);opacity:0.6} 100%{transform:translate(-10px,12px);opacity:0} }
      @keyframes score-flat  { 0%,100%{stroke-dashoffset:0} 50%{stroke-dashoffset:-8px} }
      @keyframes arrow-down  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }
      .we-wheel { animation: wheel-spin 1.8s linear infinite; }
      .we-leg1  { animation: run-leg1 0.55s ease-in-out infinite; }
      .we-leg2  { animation: run-leg2 0.55s ease-in-out infinite; }
      .we-arm1  { animation: run-arm1 0.55s ease-in-out infinite; }
      .we-arm2  { animation: run-arm2 0.55s ease-in-out infinite; }
      .we-sw1   { animation: sweat-drop1 1.1s ease-in infinite; }
      .we-sw2   { animation: sweat-drop2 1.1s ease-in infinite 0.35s; }
      .we-sw3   { animation: sweat-drop3 1.1s ease-in infinite 0.7s; }
      .we-arrow { animation: arrow-down 1s ease-in-out infinite; }
    `}</style>
    <defs>
      <linearGradient id="we_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF7ED"/><stop offset="100%" stopColor="#FFFBEB"/></linearGradient>
      <linearGradient id="we_wheel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F97316"/><stop offset="100%" stopColor="#EF4444"/></linearGradient>
      <linearGradient id="we_body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FBBF24"/><stop offset="100%" stopColor="#F59E0B"/></linearGradient>
    </defs>
    <circle cx="70" cy="70" r="66" fill="url(#we_bg)"/>
    {/* Spinning wheel */}
    <g className="we-wheel">
      <circle cx="70" cy="76" r="42" stroke="url(#we_wheel)" strokeWidth="7" fill="rgba(249,115,22,0.07)"/>
      <circle cx="70" cy="76" r="34" stroke="rgba(249,115,22,0.22)" strokeWidth="2" fill="none"/>
      <line x1="70" y1="34" x2="70" y2="118" stroke="rgba(249,115,22,0.18)" strokeWidth="2.5"/>
      <line x1="28" y1="76" x2="112" y2="76" stroke="rgba(249,115,22,0.18)" strokeWidth="2.5"/>
      <line x1="40" y1="46" x2="100" y2="106" stroke="rgba(249,115,22,0.13)" strokeWidth="2"/>
      <line x1="100" y1="46" x2="40" y2="106" stroke="rgba(249,115,22,0.13)" strokeWidth="2"/>
    </g>
    {/* Running figure */}
    {/* Head */}
    <circle cx="70" cy="54" r="9" fill="url(#we_body)" stroke="#F59E0B" strokeWidth="1.5"/>
    <circle cx="67" cy="52" r="1.5" fill="#92400E"/>
    <circle cx="73" cy="52" r="1.5" fill="#92400E"/>
    <path d="M67 57 Q70 59 73 57" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* Body */}
    <rect x="63" y="63" width="14" height="18" rx="5" fill="url(#we_body)"/>
    {/* Animated legs */}
    <g className="we-leg1"><rect x="63" y="80" width="7" height="18" rx="3.5" fill="#F59E0B"/></g>
    <g className="we-leg2"><rect x="70" y="80" width="7" height="18" rx="3.5" fill="#FBBF24"/></g>
    {/* Animated arms */}
    <g className="we-arm1"><rect x="51" y="63" width="14" height="6" rx="3" fill="#FBBF24"/></g>
    <g className="we-arm2"><rect x="75" y="65" width="14" height="6" rx="3" fill="#F59E0B"/></g>
    {/* Sweat drops */}
    <g className="we-sw1"><ellipse cx="52" cy="50" rx="3.5" ry="5" fill="#60A5FA" opacity="0.9"/></g>
    <g className="we-sw2"><ellipse cx="46" cy="42" rx="2.5" ry="4" fill="#60A5FA" opacity="0.7"/></g>
    <g className="we-sw3"><ellipse cx="57" cy="40" rx="2" ry="3" fill="#93C5FD" opacity="0.6"/></g>
    {/* Score flat-line chart */}
    <rect x="90" y="16" width="38" height="26" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
    <text x="109" y="25" fill="#94A3B8" fontSize="6" fontWeight="700" fontFamily="Arial" textAnchor="middle">SCORE</text>
    <polyline points="96,35 101,30 106,35 111,30 116,30 121,30" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Down arrow — animated */}
    <g className="we-arrow">
      <line x1="128" y1="30" x2="128" y2="42" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
      <path d="M124 39 L128 44 L132 39" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
    {/* Circular no-progress arrow */}
    <path d="M16 62 Q8 50 16 38 Q22 28 34 30" stroke="#F97316" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M30 26 L35 31 L30 36" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// ── Problem bullets ───────────────────────────────────────────────────────────
  <svg width="130" height="130" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="np_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF7ED"/>
        <stop offset="100%" stopColor="#FEE2E2"/>
      </linearGradient>
      <linearGradient id="np_road" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366F1"/>
        <stop offset="100%" stopColor="#8B5CF6"/>
      </linearGradient>
      <linearGradient id="np_sign" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F59E0B"/>
        <stop offset="100%" stopColor="#EF4444"/>
      </linearGradient>
    </defs>
    {/* Background circle */}
    <circle cx="65" cy="65" r="62" fill="url(#np_bg)"/>
    {/* Ground */}
    <ellipse cx="65" cy="108" rx="48" ry="8" fill="rgba(0,0,0,0.06)"/>
    {/* Forking road — 3 paths going different directions */}
    {/* Main road */}
    <path d="M65 100 L65 72" stroke="url(#np_road)" strokeWidth="10" strokeLinecap="round"/>
    {/* Left fork */}
    <path d="M65 72 Q40 66 22 48" stroke="#6366F1" strokeWidth="8" strokeLinecap="round" fill="none"/>
    {/* Right fork */}
    <path d="M65 72 Q90 66 108 48" stroke="#8B5CF6" strokeWidth="8" strokeLinecap="round" fill="none"/>
    {/* Middle fork straight */}
    <path d="M65 72 L65 40" stroke="#A78BFA" strokeWidth="8" strokeLinecap="round"/>
    {/* Road dashes */}
    <line x1="65" y1="100" x2="65" y2="94" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="65" y1="88" x2="65" y2="82" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    {/* Sign post */}
    <rect x="58" y="52" width="4" height="22" rx="2" fill="#92400E"/>
    {/* Three conflicting direction signs */}
    <rect x="42" y="44" width="26" height="12" rx="3" fill="url(#np_sign)"/>
    <path d="M42 50 L37 44 L42 38" fill="url(#np_sign)"/>
    <rect x="62" y="32" width="24" height="12" rx="3" fill="#EF4444"/>
    <path d="M86 38 L91 32 L86 26" fill="#EF4444"/>
    <rect x="50" y="20" width="22" height="11" rx="3" fill="#10B981"/>
    <path d="M72 25.5 L77 20 L72 14.5" fill="#10B981"/>
    {/* Question marks floating */}
    <text x="18" y="38" fill="#F59E0B" fontSize="18" fontWeight="900" fontFamily="Arial" opacity="0.8">?</text>
    <text x="100" y="32" fill="#EF4444" fontSize="14" fontWeight="900" fontFamily="Arial" opacity="0.7">?</text>
    <text x="108" y="72" fill="#6366F1" fontSize="12" fontWeight="900" fontFamily="Arial" opacity="0.6">?</text>
  </svg>
);

const IllustrationNoVisibility = () => (
  <svg width="130" height="130" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="nv_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EFF6FF"/>
        <stop offset="100%" stopColor="#F0FDF4"/>
      </linearGradient>
      <linearGradient id="nv_bar1" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#3B82F6"/>
        <stop offset="100%" stopColor="#60A5FA"/>
      </linearGradient>
      <linearGradient id="nv_bar2" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#10B981"/>
        <stop offset="100%" stopColor="#34D399"/>
      </linearGradient>
      <linearGradient id="nv_bar3" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#F59E0B"/>
        <stop offset="100%" stopColor="#FCD34D"/>
      </linearGradient>
      <linearGradient id="nv_bar4" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#8B5CF6"/>
        <stop offset="100%" stopColor="#A78BFA"/>
      </linearGradient>
      <linearGradient id="nv_fog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(241,245,249,0.97)"/>
        <stop offset="100%" stopColor="rgba(226,232,240,0.92)"/>
      </linearGradient>
    </defs>
    <circle cx="65" cy="65" r="62" fill="url(#nv_bg)"/>
    {/* Chart frame */}
    <rect x="16" y="28" width="98" height="72" rx="8" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
    {/* Colorful bars */}
    <rect x="26" y="72" width="16" height="20" rx="3" fill="url(#nv_bar1)"/>
    <rect x="47" y="56" width="16" height="36" rx="3" fill="url(#nv_bar2)"/>
    <rect x="68" y="44" width="16" height="48" rx="3" fill="url(#nv_bar3)"/>
    <rect x="89" y="34" width="16" height="58" rx="3" fill="url(#nv_bar4)"/>
    {/* Fog cloud covering bars */}
    <rect x="16" y="28" width="98" height="72" rx="8" fill="url(#nv_fog)"/>
    {/* Fog wisp shapes */}
    <ellipse cx="42" cy="58" rx="24" ry="14" fill="rgba(203,213,225,0.7)"/>
    <ellipse cx="80" cy="52" rx="28" ry="16" fill="rgba(203,213,225,0.65)"/>
    <ellipse cx="60" cy="72" rx="30" ry="12" fill="rgba(203,213,225,0.6)"/>
    <ellipse cx="95" cy="70" rx="18" ry="11" fill="rgba(203,213,225,0.55)"/>
    {/* Locked padlock icon */}
    <rect x="50" y="54" width="30" height="24" rx="5" fill="#475569" stroke="#334155" strokeWidth="1"/>
    <path d="M57 54 L57 47 Q57 40 65 40 Q73 40 73 47 L73 54" stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none"/>
    <circle cx="65" cy="64" r="5" fill="#94A3B8"/>
    <rect x="63.5" y="64" width="3" height="6" rx="1.5" fill="#94A3B8"/>
    {/* Stars/sparkles outside suggesting hidden insight */}
    <path d="M108 22 L110 17 L112 22 L117 24 L112 26 L110 31 L108 26 L103 24 Z" fill="#F59E0B" opacity="0.9"/>
    <path d="M14 88 L15.5 84 L17 88 L21 89.5 L17 91 L15.5 95 L14 91 L10 89.5 Z" fill="#3B82F6" opacity="0.8"/>
    <path d="M112 90 L113 87 L114 90 L117 91 L114 92 L113 95 L112 92 L109 91 Z" fill="#10B981" opacity="0.7"/>
  </svg>
);

const IllustrationWastedEffort = () => (
  <svg width="130" height="130" viewBox="0 0 130 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="we_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF7ED"/>
        <stop offset="100%" stopColor="#FEF3C7"/>
      </linearGradient>
      <linearGradient id="we_wheel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F97316"/>
        <stop offset="100%" stopColor="#EF4444"/>
      </linearGradient>
      <linearGradient id="we_arrow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#F59E0B"/>
        <stop offset="100%" stopColor="#EF4444"/>
      </linearGradient>
      <linearGradient id="we_person" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FBBF24"/>
        <stop offset="100%" stopColor="#F59E0B"/>
      </linearGradient>
    </defs>
    <circle cx="65" cy="65" r="62" fill="url(#we_bg)"/>
    {/* Hamster wheel / treadmill circle */}
    <circle cx="65" cy="72" r="40" stroke="url(#we_wheel)" strokeWidth="6" fill="rgba(249,115,22,0.06)"/>
    <circle cx="65" cy="72" r="33" stroke="rgba(249,115,22,0.25)" strokeWidth="2" fill="none"/>
    {/* Wheel spokes */}
    <line x1="65" y1="32" x2="65" y2="112" stroke="rgba(249,115,22,0.2)" strokeWidth="2"/>
    <line x1="25" y1="72" x2="105" y2="72" stroke="rgba(249,115,22,0.2)" strokeWidth="2"/>
    <line x1="37" y1="44" x2="93" y2="100" stroke="rgba(249,115,22,0.15)" strokeWidth="2"/>
    <line x1="93" y1="44" x2="37" y2="100" stroke="rgba(249,115,22,0.15)" strokeWidth="2"/>
    {/* Running figure */}
    {/* Body */}
    <ellipse cx="65" cy="63" rx="7" ry="9" fill="url(#we_person)"/>
    {/* Head */}
    <circle cx="65" cy="51" r="7" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1.5"/>
    {/* Running legs */}
    <path d="M60 71 L54 84 L58 85 L63 76 L67 85 L71 83 L66 71Z" fill="#F59E0B"/>
    {/* Running arms */}
    <path d="M58 60 L48 54" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
    <path d="M72 60 L80 66" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
    {/* Sweat drops */}
    <ellipse cx="44" cy="48" rx="3" ry="4" fill="#60A5FA" opacity="0.8"/>
    <ellipse cx="38" cy="40" rx="2" ry="3" fill="#60A5FA" opacity="0.6"/>
    <ellipse cx="50" cy="38" rx="2" ry="2.5" fill="#60A5FA" opacity="0.5"/>
    {/* Flat score line — no improvement */}
    <rect x="88" y="18" width="32" height="22" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
    <polyline points="93,33 98,28 103,33 108,28 113,28" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="100" y="24" fill="#64748B" fontSize="6" fontWeight="700" fontFamily="Arial" textAnchor="middle">SCORE</text>
    {/* Down trend arrow beside chart */}
    <path d="M122 26 L122 36" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M119 33 L122 37 L125 33" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Circular arrow showing no progress */}
    <path d="M14 65 Q8 55 14 45 Q20 35 30 38" stroke="url(#we_arrow)" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M26 34 L31 39 L27 44" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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