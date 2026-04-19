import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import { BookOpen, Target, TrendingUp, Zap, BarChart2, Award, Check, Minus } from 'lucide-react';
import { LogoFull } from '../components/LogoSVG';

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

// ── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'Very useful for practice, it helps students improve performance and aim for high scores, even up to 100%.',
    name:  'Ibrahim',
    role:  'Student',
    exam:  'qudurat',
  },
  {
    quote: 'This is the blueprint to achieve 100% in Qudurat and Tahsili.',
    name:  'Mohamed',
    role:  'High school teacher',
    exam:  'tahsili',
  },
  {
    quote: 'It\'s clear the questions have been carefully selected to deliver effective preparation for Qodurat and Tahsili.',
    name:  'Abdullah',
    role:  'School leader',
    exam:  'qudurat',
  },
];

// Duplicate set so the marquee loops seamlessly
const TESTI_LOOP = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS];

function TestimonialsStrip() {
  return (
    <div className="testi-strip" aria-label="Student testimonials">
      <div className="testi-track">
        {TESTI_LOOP.map((t, i) => (
          <div key={i} className="testi-card">
            <p className="testi-quote">{t.quote}</p>
            <div className="testi-footer">
              <div>
                <div className="testi-name">{t.name}</div>
                <div className="testi-role">{t.role}</div>
              </div>
              <span className={`testi-badge testi-badge-${t.exam}`}>
                {t.exam === 'qudurat' ? 'Qudurat' : 'Tahsili'}
              </span>
            </div>
          </div>
        ))}
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
    label: 'Aiming for 100%?',
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
    <circle cx="70" cy="54" r="9" fill="url(#we_body)" stroke="#F59E0B" strokeWidth="1.5"/>
    <circle cx="67" cy="52" r="1.5" fill="#92400E"/>
    <circle cx="73" cy="52" r="1.5" fill="#92400E"/>
    <path d="M67 57 Q70 59 73 57" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <rect x="63" y="63" width="14" height="18" rx="5" fill="url(#we_body)"/>
    <g className="we-leg1"><rect x="63" y="80" width="7" height="18" rx="3.5" fill="#F59E0B"/></g>
    <g className="we-leg2"><rect x="70" y="80" width="7" height="18" rx="3.5" fill="#FBBF24"/></g>
    <g className="we-arm1"><rect x="51" y="63" width="14" height="6" rx="3" fill="#FBBF24"/></g>
    <g className="we-arm2"><rect x="75" y="65" width="14" height="6" rx="3" fill="#F59E0B"/></g>
    {/* Sweat drops */}
    <g className="we-sw1"><ellipse cx="52" cy="50" rx="3.5" ry="5" fill="#60A5FA" opacity="0.9"/></g>
    <g className="we-sw2"><ellipse cx="46" cy="42" rx="2.5" ry="4" fill="#60A5FA" opacity="0.7"/></g>
    <g className="we-sw3"><ellipse cx="57" cy="40" rx="2" ry="3" fill="#93C5FD" opacity="0.6"/></g>
    {/* Score chart */}
    <rect x="90" y="16" width="38" height="26" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
    <text x="109" y="25" fill="#94A3B8" fontSize="6" fontWeight="700" fontFamily="Arial" textAnchor="middle">SCORE</text>
    <polyline points="96,35 101,30 106,35 111,30 116,30 121,30" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <g className="we-arrow">
      <line x1="128" y1="30" x2="128" y2="42" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
      <path d="M124 39 L128 44 L132 39" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </g>
    <path d="M16 62 Q8 50 16 38 Q22 28 34 30" stroke="#F97316" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M30 26 L35 31 L30 36" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// ── Problem bullets ───────────────────────────────────────────────────────────
const PROBLEM_BULLETS = [
  'Random prep with no clear structure or path',
  'No visibility into which topics are holding you back',
  'Hours studied does not equal score improvement without focus',
];

// ── Situation SVGs ────────────────────────────────────────────────────────────
const SvgFast = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes sf-tick { 0%,100%{transform:rotate(0deg);transform-origin:60px 60px} 4%{transform:rotate(-8deg);transform-origin:60px 60px} 8%{transform:rotate(0deg);transform-origin:60px 60px} }
      @keyframes sf-hand { 0%{transform:rotate(-60deg);transform-origin:60px 60px} 100%{transform:rotate(240deg);transform-origin:60px 60px} }
      @keyframes sf-num  { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes sf-flash{ 0%,80%{opacity:0} 85%,95%{opacity:1} 100%{opacity:0} }
      @keyframes sf-bolt { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-4px) scale(1.1)} }
      .sf-case  { animation: sf-tick 1s ease infinite; }
      .sf-hand  { animation: sf-hand 2s linear infinite; }
      .sf-num1  { animation: sf-num  1s ease infinite 0s; }
      .sf-num2  { animation: sf-num  1s ease infinite 0.33s; }
      .sf-num3  { animation: sf-num  1s ease infinite 0.66s; }
      .sf-flash { animation: sf-flash 2s ease infinite; }
      .sf-bolt  { animation: sf-bolt 0.8s ease-in-out infinite; }
    `}</style>
    <defs>
      <linearGradient id="sf_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF7ED"/><stop offset="100%" stopColor="#FEF3C7"/></linearGradient>
      <linearGradient id="sf_face" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#FEF9EE"/></linearGradient>
    </defs>
    <circle cx="60" cy="60" r="57" fill="url(#sf_bg)"/>
    <g className="sf-case">
      <circle cx="60" cy="65" r="36" fill="url(#sf_face)" stroke="#F97316" strokeWidth="3.5"/>
      <rect x="55" y="26" width="10" height="8" rx="3" fill="#F97316"/>
      <rect x="45" y="22" width="30" height="8" rx="4" fill="#F97316"/>
      <line x1="60" y1="33" x2="60" y2="37" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="60" y1="89" x2="60" y2="93" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="28" y1="65" x2="32" y2="65" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="88" y1="65" x2="92" y2="65" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
      <text x="60" y="54" textAnchor="middle" fill="#EF4444" fontSize="9" fontWeight="800" fontFamily="Arial" className="sf-num1">3</text>
      <text x="60" y="66" textAnchor="middle" fill="#F97316" fontSize="9" fontWeight="800" fontFamily="Arial" className="sf-num2">2</text>
      <text x="60" y="78" textAnchor="middle" fill="#FBBF24" fontSize="9" fontWeight="800" fontFamily="Arial" className="sf-num3">1</text>
    </g>
    <line x1="60" y1="65" x2="60" y2="40" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" className="sf-hand"/>
    <circle cx="60" cy="65" r="3.5" fill="#EF4444"/>
    <circle cx="60" cy="65" r="36" fill="rgba(249,115,22,0.15)" className="sf-flash"/>
    <g className="sf-bolt">
      <path d="M93 28 L87 42 L93 42 L87 56 L100 38 L94 38 Z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1"/>
    </g>
    <line x1="14" y1="50" x2="20" y2="50" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
    <line x1="12" y1="62" x2="19" y2="62" stroke="#EF4444" strokeWidth="2"   strokeLinecap="round" opacity="0.5"/>
    <line x1="14" y1="74" x2="20" y2="74" stroke="#FBBF24" strokeWidth="2"   strokeLinecap="round" opacity="0.4"/>
  </svg>
);

// ── SvgStuck — premium speedometer gauge ─────────────────────────────────────
const SvgStuck = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes ssg-shake {
        0%,18%,100%{transform:translate(0,0)}
        20%{transform:translate(-2.5px,0)}
        22%{transform:translate(2.5px,0)}
        24%{transform:translate(-1.5px,0)}
        26%{transform:translate(1.5px,0)}
        28%{transform:translate(0,0)}
      }
      @keyframes ssg-needle {
        0%,15%{transform:rotate(-78deg);transform-origin:60px 72px}
        18%,19%{transform:rotate(-80deg);transform-origin:60px 72px}
        20%,21%{transform:rotate(-76deg);transform-origin:60px 72px}
        22%,75%{transform:rotate(-78deg);transform-origin:60px 72px}
        80%{transform:rotate(-22deg);transform-origin:60px 72px}
        85%,90%{transform:rotate(-20deg);transform-origin:60px 72px}
        95%,100%{transform:rotate(-78deg);transform-origin:60px 72px}
      }
      @keyframes ssg-burst {
        0%,74%,100%{opacity:0;transform:scale(0.5)}
        80%,88%{opacity:1;transform:scale(1)}
        93%{opacity:0;transform:scale(1.3)}
      }
      @keyframes ssg-ring {
        0%,74%,100%{opacity:0;r:10}
        79%{opacity:0.7;r:18}
        88%{opacity:0.3;r:28}
        94%{opacity:0;r:36}
      }
      @keyframes ssg-label {
        0%,74%{fill:#64748B}
        80%,92%{fill:#4ADE80}
        97%,100%{fill:#64748B}
      }
      @keyframes ssg-score-in {
        0%,10%{opacity:0;transform:translateY(5px)}
        20%,70%{opacity:1;transform:translateY(0)}
        80%,100%{opacity:0;transform:translateY(-5px)}
      }
      .ssg-body  {animation:ssg-shake 5s ease-in-out infinite;}
      .ssg-ndl   {animation:ssg-needle 5s cubic-bezier(0.4,0,0.2,1) infinite;}
      .ssg-burst {animation:ssg-burst 5s ease infinite;}
      .ssg-ring  {animation:ssg-ring 5s ease infinite;}
      .ssg-lbl   {animation:ssg-label 5s ease infinite;}
      .ssg-score {animation:ssg-score-in 5s ease infinite;}
    `}</style>
    <defs>
      <linearGradient id="ssg_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EFF6FF"/>
        <stop offset="100%" stopColor="#E0F2FE"/>
      </linearGradient>
      <linearGradient id="ssg_face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF"/>
        <stop offset="100%" stopColor="#F8FAFC"/>
      </linearGradient>
      <linearGradient id="ssg_ndl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0F172A"/>
        <stop offset="100%" stopColor="#475569"/>
      </linearGradient>
      <radialGradient id="ssg_hub" cx="40%" cy="35%">
        <stop offset="0%" stopColor="#94A3B8"/>
        <stop offset="100%" stopColor="#1E293B"/>
      </radialGradient>
      <filter id="ssg_drop">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.18)"/>
      </filter>
    </defs>

    {/* Outer bg */}
    <circle cx="60" cy="60" r="57" fill="url(#ssg_bg)"/>

    {/* Gauge assembly — shakes when stuck */}
    <g className="ssg-body">

      {/* Gauge face */}
      <circle cx="60" cy="66" r="46" fill="url(#ssg_face)" stroke="#CBD5E1" strokeWidth="2" filter="url(#ssg_drop)"/>

      {/* Bezel ring */}
      <circle cx="60" cy="66" r="46" fill="none" stroke="#94A3B8" strokeWidth="3.5" strokeDasharray="2 4"/>

      {/* Colored arc — 190deg sweep, bottom-left to bottom-right */}
      {/* Green zone */}
      <path d="M 17 80 A 44 44 0 0 1 28 42" stroke="#22C55E" strokeWidth="11" strokeLinecap="butt" fill="none" opacity="0.9"/>
      {/* Yellow zone */}
      <path d="M 28 42 A 44 44 0 0 1 60 22" stroke="#EAB308" strokeWidth="11" strokeLinecap="butt" fill="none" opacity="0.9"/>
      {/* Orange zone */}
      <path d="M 60 22 A 44 44 0 0 1 92 42" stroke="#F97316" strokeWidth="11" strokeLinecap="butt" fill="none" opacity="0.9"/>
      {/* Red zone */}
      <path d="M 92 42 A 44 44 0 0 1 103 80" stroke="#EF4444" strokeWidth="11" strokeLinecap="butt" fill="none" opacity="0.9"/>

      {/* White inner border over arc ends */}
      <circle cx="60" cy="66" r="38" fill="url(#ssg_face)" stroke="#E2E8F0" strokeWidth="1"/>

      {/* Major tick marks */}
      {[
        [17,80,23,77],[28,42,32,46],[60,22,60,28],[92,42,88,46],[103,80,97,77]
      ].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="2.5" strokeLinecap="round"/>
      ))}

      {/* Minor tick marks */}
      {[
        [21,61,25,61],[22,71,26,71],
        [40,28,42,32],[50,23,51,27],
        [70,23,69,27],[80,28,78,32],
        [99,61,95,61],[98,71,94,71],
      ].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
      ))}

      {/* Zone labels */}
      <text x="11"  y="90" fill="#22C55E" fontSize="6" fontWeight="800" fontFamily="Arial">LOW</text>
      <text x="48"  y="17" fill="#EAB308" fontSize="6" fontWeight="800" fontFamily="Arial">MID</text>
      <text x="96"  y="90" fill="#EF4444" fontSize="6" fontWeight="800" fontFamily="Arial">HI</text>

      {/* Burst when breaking free */}
      <g className="ssg-burst">
        <circle cx="60" cy="72" r="14" fill="rgba(74,222,128,0.2)" stroke="#4ADE80" strokeWidth="2" strokeDasharray="3 2"/>
        <path d="M60 58 L62 65 L69 63 L64 69 L68 76 L61 72 L54 76 L58 69 L53 63 L60 65Z" fill="#FBBF24"/>
      </g>

      {/* Expanding ring */}
      <circle cx="60" cy="72" fill="none" stroke="#4ADE80" strokeWidth="2" className="ssg-ring" r="10"/>

      {/* Needle */}
      <g className="ssg-ndl">
        {/* Needle shadow */}
        <line x1="60" y1="72" x2="28" y2="51" stroke="rgba(0,0,0,0.12)" strokeWidth="4" strokeLinecap="round"/>
        {/* Needle body */}
        <line x1="60" y1="72" x2="28" y2="51" stroke="url(#ssg_ndl)" strokeWidth="3.5" strokeLinecap="round"/>
        {/* Needle counterweight */}
        <line x1="60" y1="72" x2="68" y2="78" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
      </g>

      {/* Center hub */}
      <circle cx="60" cy="72" r="9" fill="url(#ssg_hub)" stroke="#475569" strokeWidth="1.5"/>
      <circle cx="60" cy="72" r="4.5" fill="#0F172A"/>
      <circle cx="57.5" cy="69.5" r="1.8" fill="rgba(255,255,255,0.35)"/>
    </g>

    {/* Score readout — flat */}
    <g className="ssg-score">
      <rect x="32" y="98" width="56" height="17" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5"/>
      <circle cx="44" cy="106" r="3" fill="#EF4444" opacity="0.8"/>
      <text x="62" y="110" textAnchor="middle" fill="#94A3B8" fontSize="8" fontWeight="700" fontFamily="Arial">SAME SCORE</text>
    </g>

    {/* Stuck indicator arrows on sides */}
    <line x1="5"  y1="58" x2="12" y2="58" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
    <line x1="5"  y1="68" x2="12" y2="68" stroke="#EF4444" strokeWidth="2"   strokeLinecap="round" opacity="0.35"/>
    <line x1="108" y1="58" x2="115" y2="58" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
    <line x1="108" y1="68" x2="115" y2="68" stroke="#EF4444" strokeWidth="2"   strokeLinecap="round" opacity="0.35"/>
  </svg>
);

// ── SvgTrophy — premium championship trophy with 100% ────────────────────────
const SvgTrophy = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes st3-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes st3-shine { 0%,100%{transform:translateX(-70px) skewX(-18deg);opacity:0} 25%{opacity:0} 45%{opacity:0.75} 65%,100%{transform:translateX(170px) skewX(-18deg);opacity:0} }
      @keyframes st3-glow  { 0%,100%{opacity:0.2;r:28} 50%{opacity:0.5;r:35} }
      @keyframes st3-star1 { 0%,100%{transform:scale(1) rotate(0deg);opacity:0.85} 50%{transform:scale(1.3) rotate(18deg);opacity:1} }
      @keyframes st3-star2 { 0%,100%{transform:scale(0.85) rotate(0deg);opacity:0.65} 50%{transform:scale(1.2) rotate(-22deg);opacity:1} }
      @keyframes st3-star3 { 0%,100%{transform:scale(1.05) rotate(0deg);opacity:0.7} 50%{transform:scale(0.9) rotate(12deg);opacity:0.95} }
      @keyframes st3-c1 { 0%,100%{transform:translate(0,0) rotate(0deg);opacity:0.9} 50%{transform:translate(-5px,-9px) rotate(200deg);opacity:1} }
      @keyframes st3-c2 { 0%,100%{transform:translate(0,0) rotate(0deg);opacity:0.8} 50%{transform:translate(6px,-7px) rotate(-180deg);opacity:1} }
      @keyframes st3-c3 { 0%,100%{transform:translate(0,0) rotate(0deg);opacity:0.75} 50%{transform:translate(-4px,-11px) rotate(140deg);opacity:0.95} }
      @keyframes st3-c4 { 0%,100%{transform:translate(0,0) rotate(0deg);opacity:0.7} 50%{transform:translate(7px,-5px) rotate(-110deg);opacity:0.9} }
      @keyframes st3-pulse { 0%,100%{opacity:0.15} 50%{opacity:0.4} }
      .st3-float {animation:st3-float 2.6s ease-in-out infinite;}
      .st3-shine {animation:st3-shine 3.2s ease-in-out infinite 0.6s;}
      .st3-glow  {animation:st3-glow 2.6s ease-in-out infinite;}
      .st3-star1 {animation:st3-star1 1.9s ease-in-out infinite;transform-origin:18px 20px;}
      .st3-star2 {animation:st3-star2 2.3s ease-in-out infinite 0.4s;transform-origin:102px 14px;}
      .st3-star3 {animation:st3-star3 2.1s ease-in-out infinite 0.8s;transform-origin:10px 74px;}
      .st3-c1 {animation:st3-c1 2.1s ease-in-out infinite;}
      .st3-c2 {animation:st3-c2 2.4s ease-in-out infinite 0.25s;}
      .st3-c3 {animation:st3-c3 1.9s ease-in-out infinite 0.5s;}
      .st3-c4 {animation:st3-c4 2.2s ease-in-out infinite 0.1s;}
      .st3-pulse {animation:st3-pulse 2s ease-in-out infinite;}
    `}</style>
    <defs>
      <linearGradient id="st3_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFBEB"/>
        <stop offset="100%" stopColor="#FEF3C7"/>
      </linearGradient>
      <linearGradient id="st3_cup" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FDE68A"/>
        <stop offset="45%" stopColor="#FBBF24"/>
        <stop offset="100%" stopColor="#D97706"/>
      </linearGradient>
      <linearGradient id="st3_cup_inner" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0.04)"/>
        <stop offset="100%" stopColor="rgba(0,0,0,0.12)"/>
      </linearGradient>
      <linearGradient id="st3_stem" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F59E0B"/>
        <stop offset="100%" stopColor="#B45309"/>
      </linearGradient>
      <linearGradient id="st3_base1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FBBF24"/>
        <stop offset="100%" stopColor="#D97706"/>
      </linearGradient>
      <linearGradient id="st3_base2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#D97706"/>
        <stop offset="100%" stopColor="#92400E"/>
      </linearGradient>
      <linearGradient id="st3_hdl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#F59E0B"/>
        <stop offset="100%" stopColor="#FCD34D"/>
      </linearGradient>
      <linearGradient id="st3_shine_g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="rgba(255,255,255,0)"/>
        <stop offset="50%"  stopColor="rgba(255,255,255,0.75)"/>
        <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
      </linearGradient>
      <linearGradient id="st3_badge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.32)"/>
        <stop offset="100%" stopColor="rgba(255,255,255,0.12)"/>
      </linearGradient>
      <radialGradient id="st3_hl" cx="35%" cy="30%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.55)"/>
        <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
      </radialGradient>
      <clipPath id="st3_cup_clip">
        <path d="M 36 20 Q 34 70 60 80 Q 86 70 84 20 Z"/>
      </clipPath>
      <filter id="st3_dropshadow">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="rgba(180,83,9,0.35)"/>
      </filter>
    </defs>

    {/* Background */}
    <circle cx="60" cy="60" r="57" fill="url(#st3_bg)"/>

    {/* Ambient glow */}
    <circle cx="60" cy="54" fill="rgba(251,191,36,0.18)" stroke="none" className="st3-glow" r="28"/>

    {/* Pulse ring */}
    <circle cx="60" cy="54" r="40" fill="none" stroke="rgba(251,191,36,0.2)" strokeWidth="20" className="st3-pulse"/>

    {/* Trophy group — floats up/down */}
    <g className="st3-float" filter="url(#st3_dropshadow)">

      {/* Left handle — ornate curve */}
      <path d="M 36 28 Q 16 28 16 47 Q 16 62 36 60" stroke="url(#st3_hdl)" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M 36 28 Q 19 28 19 47 Q 19 60 36 58" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M 36 28 Q 23 28 23 47 Q 23 59 36 57" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>

      {/* Right handle — ornate curve */}
      <path d="M 84 28 Q 104 28 104 47 Q 104 62 84 60" stroke="url(#st3_hdl)" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M 84 28 Q 101 28 101 47 Q 101 60 84 58" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round" fill="none"/>

      {/* Cup body */}
      <path d="M 36 20 Q 34 70 60 80 Q 86 70 84 20 Z" fill="url(#st3_cup)"/>

      {/* Cup inner shading */}
      <path d="M 42 20 Q 41 65 60 74 Q 79 65 78 20 Z" fill="url(#st3_cup_inner)"/>

      {/* Cup left highlight strip */}
      <path d="M 43 22 Q 42 58 52 70" stroke="rgba(255,255,255,0.5)" strokeWidth="5" strokeLinecap="round" fill="none"/>

      {/* 100% badge ring */}
      <circle cx="60" cy="46" r="17" fill="url(#st3_badge)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>

      {/* Radial highlight inside badge */}
      <circle cx="60" cy="46" r="16" fill="url(#st3_hl)"/>

      {/* 100% text */}
      <text x="60" y="52" textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily="Arial" letterSpacing="-0.5">100%</text>

      {/* Shine sweep across cup */}
      <rect x="0" y="0" width="32" height="120" fill="url(#st3_shine_g)" clipPath="url(#st3_cup_clip)" className="st3-shine"/>

      {/* Stem */}
      <rect x="55" y="80" width="10" height="15" rx="2.5" fill="url(#st3_stem)"/>
      <rect x="56" y="80" width="3.5" height="15" rx="1.5" fill="rgba(255,255,255,0.18)"/>

      {/* Base tier 1 */}
      <rect x="42" y="94" width="36" height="9" rx="4.5" fill="url(#st3_base1)"/>
      <rect x="43" y="94" width="11" height="4" rx="2" fill="rgba(255,255,255,0.2)"/>

      {/* Base tier 2 — wide */}
      <rect x="36" y="101" width="48" height="8" rx="3.5" fill="url(#st3_base2)"/>
      <rect x="37" y="101" width="13" height="3.5" rx="1.5" fill="rgba(255,255,255,0.12)"/>
    </g>

    {/* Stars — outside trophy group so they don't cast shadow */}
    <g className="st3-star1">
      <path d="M18 20 L20.5 13 L23 20 L30 22.5 L23 25 L20.5 32 L18 25 L11 22.5 Z" fill="#FBBF24"/>
      <path d="M18 20 L20.5 13 L23 20 L30 22.5 L23 25 L20.5 32 L18 25 L11 22.5 Z" fill="url(#st3_hl)" opacity="0.4"/>
    </g>
    <g className="st3-star2">
      <path d="M102 14 L104 8 L106 14 L112 16.5 L106 19 L104 25 L102 19 L96 16.5 Z" fill="#FCD34D"/>
    </g>
    <g className="st3-star3">
      <path d="M10 74 L12 68 L14 74 L20 76.5 L14 79 L12 85 L10 79 L4 76.5 Z" fill="#F59E0B" opacity="0.85"/>
    </g>

    {/* Confetti dots */}
    <g className="st3-c1"><rect x="94" y="44" width="6" height="6" rx="1.5" fill="#EF4444" transform="rotate(15,97,47)"/></g>
    <g className="st3-c2"><rect x="107" y="60" width="5" height="5" rx="1.5" fill="#3B82F6" transform="rotate(-10,109,62)"/></g>
    <g className="st3-c3"><rect x="24"  y="44" width="5" height="5" rx="1.5" fill="#10B981" transform="rotate(20,26,46)"/></g>
    <g className="st3-c4"><rect x="10"  y="60" width="5" height="5" rx="1.5" fill="#8B5CF6" transform="rotate(-15,12,62)"/></g>
  </svg>
);

// ── Interactive situation section ─────────────────────────────────────────────
const SITUATIONS = [
  {
    id:      'fast',
    label:   'Need to improve fast?',
    title:   'Focus on the highest-impact areas first',
    body:    'Stop covering everything. Target what will move your score the most in the time you have left.',
    cta:     'Start — I need results fast',
    detail:  'Most students see score improvement after 2-3 focused sessions.',
    Svg:     SvgFast,
    color:   '#F97316',
  },
  {
    id:      'stuck',
    label:   'Stuck at the same score?',
    title:   'Find exactly what is holding you back',
    body:    'Identify the specific gaps keeping your score flat and fix them one by one — systematically.',
    cta:     'Start — I keep hitting a wall',
    detail:  'Students who target specific gaps improve faster than those who study broadly.',
    Svg:     SvgStuck,
    color:   '#3B82F6',
  },
  {
    id:      'top',
    label:   'Aiming for 100%?',
    title:   'Eliminate the last weak areas at the top of your range',
    body:    'Push past your current ceiling by fixing the small gaps that separate good from perfect.',
    cta:     'Start — I want 100%',
    detail:  'The final points require precision. DrFahm shows you exactly where they are.',
    Svg:     SvgTrophy,
    color:   '#F59E0B',
  },
];

function SituationSection({ onStart, selectedExam }) {
  const [active, setActive] = useState(0);
  const current = SITUATIONS[active];

  return (
    <section className="sit-section">
      <div className="home-container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="sit-header">
          <div className="sit-eyebrow">Which one is you?</div>
          <h2 className="sit-headline">
            Built for <span className="sit-headline-accent">your</span> situation
          </h2>
          <p className="sit-subhead">
            Whether your exam is in 2 weeks or 2 months — DrFahm adapts to where you are.
          </p>
        </div>

        {/* Selector tabs */}
        <div className="sit-tabs">
          {SITUATIONS.map((s, i) => (
            <button
              key={s.id}
              className={`sit-tab ${active === i ? 'active' : ''}`}
              style={active === i ? { borderColor: s.color, color: s.color } : {}}
              onClick={() => setActive(i)}
            >
              <span className="sit-tab-dot" style={{ background: active === i ? s.color : '#CBD5E1' }} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Active card */}
        <div className="sit-card" style={{ borderColor: current.color + '40' }}>
          <div className="sit-card-left">
            <div className="sit-card-label" style={{ color: current.color, background: current.color + '18', border: `1px solid ${current.color}40` }}>
              {current.label}
            </div>
            <h3 className="sit-card-title">{current.title}</h3>
            <p className="sit-card-body">{current.body}</p>
            <div className="sit-card-detail">
              <span className="sit-card-detail-icon">💡</span>
              {current.detail}
            </div>
            <button
              className="sit-card-cta"
              style={{ background: current.color }}
              onClick={() => onStart(selectedExam)}
            >
              {current.cta} →
            </button>
          </div>
          <div className="sit-card-right">
            <div className="sit-card-svg">
              <current.Svg />
            </div>
            <div className="sit-mini-dots">
              {SITUATIONS.map((s, i) => (
                <button
                  key={s.id}
                  className={`sit-mini-dot ${active === i ? 'active' : ''}`}
                  style={{ background: active === i ? s.color : '#CBD5E1' }}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
      <section className="hero-section">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-grid" aria-hidden="true" />

        <div className="hero-inner">
          <div className={`hero-content ${heroVisible ? 'anim-in' : ''}`}>
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              Qudurat &amp; Tahsili preparation for Saudi students
            </div>
            <h1 className="hero-title">
              Stop wasting time<br />
              on <span className="hero-title-accent">random prep.</span><br />
              Improve your score.
            </h1>
            <p className="hero-sub">
              DrFahm shows you exactly what to focus on so every hour you study actually improves your score.
            </p>
            <div className="hero-toggle">
              <button
                className={`hero-toggle-btn ${selectedExam === 'qudurat' ? 'active' : ''}`}
                onClick={() => handleExamChange('qudurat')}
              >
                Qudurat
              </button>
              <button
                className={`hero-toggle-btn ${selectedExam === 'tahsili' ? 'active' : ''}`}
                onClick={() => handleExamChange('tahsili')}
              >
                Tahsili
              </button>
            </div>
            <button className="hero-cta" onClick={() => handleStart(selectedExam)}>
              Start free trial — {selectedExam === 'tahsili' ? 'Tahsili' : 'Qudurat'}
              <span className="hero-cta-arrow">→</span>
            </button>
            <div className="hero-trust">
              <span>✓ 7-day free trial</span>
              <span>✓ No credit card</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>

          <div className={`hero-demo-wrap ${heroVisible ? 'anim-in-delayed' : ''}`}>
            <div className="hero-demo-glow" />
            <div className="hero-demo-frame">
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

      {/* ── 2. TESTIMONIALS ──────────────────────────────────────────────── */}
      <TestimonialsStrip />

      {/* ── 3. STATS ─────────────────────────────────────────────────────── */}
      <section className="home-section home-section-stats">
        <StatsSection />
      </section>

      {/* ── 3. PROBLEM + REFRAME ─────────────────────────────────────────── */}
      <section className="prob-section">
        <div className="prob-orb prob-orb-1" />
        <div className="prob-orb prob-orb-2" />
        <div className="prob-orb prob-orb-3" />
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

          <div className="prob-cards">
            {[
              { num: '01', Illustration: IllustrationNoPath,        title: 'No clear path',  text: "Random prep with no structure means every session starts from scratch." },
              { num: '02', Illustration: IllustrationNoVisibility,  title: 'No visibility',  text: "You can't see which topics are actually holding your score back." },
              { num: '03', Illustration: IllustrationWastedEffort,  title: 'Wasted effort',  text: 'More hours studied does not automatically mean a better score.' },
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
            <div className="prob-divider-badge">The result</div>
            <div className="prob-divider-line" />
          </div>

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
      <section className="val-section">
        <div className="home-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="val-header">
            <div className="val-eyebrow">How DrFahm works</div>
            <h2 className="val-headline">
              The <span className="val-headline-accent">structured</span> way to improve your score
            </h2>
            <p className="val-subhead">
              Every feature is designed around one goal: moving your score forward, efficiently.
            </p>
          </div>

          <div className="val-cards">
            {/* Card 1 — Structured path */}
            <div className="val-card">
              <div className="val-card-svg-wrap">
                <svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <style>{`
                    @keyframes dot-travel {
                      0%   { offset-distance: 0%;   opacity: 1; }
                      90%  { offset-distance: 100%; opacity: 1; }
                      95%  { opacity: 0; }
                      100% { offset-distance: 100%; opacity: 0; }
                    }
                    @keyframes path-draw {
                      from { stroke-dashoffset: 400; }
                      to   { stroke-dashoffset: 0; }
                    }
                    @keyframes node-pop {
                      0%,80%  { transform: scale(0.7); opacity: 0.3; }
                      85%     { transform: scale(1.2); opacity: 1; }
                      100%    { transform: scale(1);   opacity: 1; }
                    }
                    @keyframes checkmark-in {
                      0%,75%  { opacity: 0; transform: scale(0); }
                      85%     { opacity: 1; transform: scale(1.2); }
                      100%    { opacity: 1; transform: scale(1); }
                    }
                    @keyframes glow-pulse {
                      0%,100% { opacity: 0.4; r: 8px; }
                      50%     { opacity: 0.9; r: 12px; }
                    }
                    .val-road { animation: path-draw 2s ease forwards; stroke-dasharray: 400; }
                    .val-dot  {
                      offset-path: path('M 30 120 Q 50 90 75 75 Q 100 60 110 40');
                      animation: dot-travel 3s ease-in-out infinite;
                    }
                    .val-node1 { animation: node-pop 3s ease infinite 0.5s; transform-origin: 30px 120px; }
                    .val-node2 { animation: node-pop 3s ease infinite 1s;   transform-origin: 75px 75px; }
                    .val-node3 { animation: node-pop 3s ease infinite 1.8s; transform-origin: 110px 40px; }
                    .val-check { animation: checkmark-in 3s ease infinite 1.8s; transform-origin: 110px 40px; }
                    .val-glow  { animation: glow-pulse 1.5s ease-in-out infinite; }
                  `}</style>
                  <defs>
                    <linearGradient id="v1_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0FDF4"/><stop offset="100%" stopColor="#DCFCE7"/></linearGradient>
                    <linearGradient id="v1_road" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#86EFAC"/><stop offset="100%" stopColor="#15803D"/></linearGradient>
                  </defs>
                  <circle cx="75" cy="75" r="72" fill="url(#v1_bg)"/>
                  <ellipse cx="75" cy="138" rx="40" ry="6" fill="rgba(0,0,0,0.06)"/>
                  <path d="M 30 120 Q 50 90 75 75 Q 100 60 110 40" stroke="url(#v1_road)" strokeWidth="5" strokeLinecap="round" fill="none" className="val-road"/>
                  <path d="M 30 120 Q 50 90 75 75 Q 100 60 110 40" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 8" fill="none" opacity="0.6"/>
                  <g className="val-node1">
                    <circle cx="30" cy="120" r="10" fill="#15803D" stroke="white" strokeWidth="2.5"/>
                    <text x="30" y="124" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="Arial">1</text>
                  </g>
                  <g className="val-node2">
                    <circle cx="75" cy="75" r="10" fill="#15803D" stroke="white" strokeWidth="2.5"/>
                    <text x="75" y="79" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="Arial">2</text>
                  </g>
                  <g className="val-node3">
                    <circle cx="110" cy="40" r="12" fill="#15803D" stroke="#4ADE80" strokeWidth="3"/>
                    <text x="110" y="44" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="Arial" className="val-check">✓</text>
                  </g>
                  <circle cx="110" cy="40" className="val-glow" fill="rgba(74,222,128,0.3)" r="8"/>
                  <circle className="val-dot" r="7" fill="#FBBF24" stroke="white" strokeWidth="2.5"/>
                  <rect x="8" y="128" width="40" height="14" rx="4" fill="#15803D"/>
                  <text x="28" y="139" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="Arial">START</text>
                  <rect x="92" y="22" width="40" height="14" rx="4" fill="#FBBF24"/>
                  <text x="112" y="33" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="Arial">GOAL</text>
                </svg>
              </div>
              <h3 className="val-card-title">Know exactly what to study next</h3>
              <p className="val-card-text">Follow a clear structured path based on your level — no guessing, no wasted sessions.</p>
            </div>

            {/* Card 2 — Focus on weak areas */}
            <div className="val-card val-card-featured">
              <div className="val-card-svg-wrap">
                <svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <style>{`
                    @keyframes glass-scan {
                      0%   { transform: translate(0px,  0px);  }
                      20%  { transform: translate(10px, 8px);  }
                      40%  { transform: translate(4px,  22px); }
                      60%  { transform: translate(14px, 36px); }
                      75%  { transform: translate(6px,  36px); }
                      90%  { transform: translate(6px,  36px); }
                      100% { transform: translate(0px,  0px);  }
                    }
                    @keyframes topic-weak1 {
                      0%,30%  { fill: #E2E8F0; }
                      35%,85% { fill: #FEE2E2; }
                      90%,100%{ fill: #E2E8F0; }
                    }
                    @keyframes topic-weak2 {
                      0%,55%  { fill: #E2E8F0; }
                      62%,85% { fill: #FEE2E2; }
                      90%,100%{ fill: #E2E8F0; }
                    }
                    @keyframes topic-found {
                      0%,58%  { fill: #E2E8F0; stroke: transparent; stroke-width:0; }
                      65%,85% { fill: #FEE2E2; stroke: #EF4444; stroke-width: 2; }
                      90%,100%{ fill: #DCFCE7; stroke: #15803D; stroke-width: 2; }
                    }
                    @keyframes label-weak1 { 0%,30%{fill:#94A3B8} 35%,85%{fill:#EF4444} 90%,100%{fill:#94A3B8} }
                    @keyframes label-weak2 { 0%,55%{fill:#94A3B8} 62%,85%{fill:#EF4444} 90%,100%{fill:#94A3B8} }
                    @keyframes label-found { 0%,58%{fill:#94A3B8} 65%,84%{fill:#EF4444} 85%,100%{fill:#15803D} }
                    @keyframes check-appear { 0%,84%{opacity:0} 90%,100%{opacity:1} }
                    @keyframes exclaim-pulse {
                      0%,30%  { opacity:0 }
                      35%,50% { opacity:1; transform:scale(1.2); transform-origin:108px 56px; }
                      55%,84% { opacity:1; transform:scale(1);   transform-origin:108px 56px; }
                      90%,100%{ opacity:0 }
                    }
                    @keyframes exclaim2-pulse {
                      0%,55%  { opacity:0 }
                      62%,75% { opacity:1; transform:scale(1.2); transform-origin:108px 86px; }
                      80%,84% { opacity:1; transform:scale(1);   transform-origin:108px 86px; }
                      90%,100%{ opacity:0 }
                    }
                    @keyframes glow-ring {
                      0%,58%  { opacity:0; r:28; }
                      65%,75% { opacity:0.6; r:32; }
                      82%,84% { opacity:0.3; r:36; }
                      90%,100%{ opacity:0; r:28; }
                    }
                    @keyframes score-jump {
                      0%,85% { opacity:0; transform:translateY(0); }
                      90%    { opacity:1; transform:translateY(-6px); }
                      100%   { opacity:0; transform:translateY(-14px); }
                    }
                    .mg-glass   { animation: glass-scan 4s cubic-bezier(0.4,0,0.2,1) infinite; }
                    .t-row1     { animation: topic-weak1 4s ease infinite; }
                    .t-row2     { animation: topic-weak2 4s ease infinite; }
                    .t-row3     { animation: topic-found 4s ease infinite; }
                    .l-row1     { animation: label-weak1 4s ease infinite; }
                    .l-row2     { animation: label-weak2 4s ease infinite; }
                    .l-row3     { animation: label-found 4s ease infinite; }
                    .chk        { animation: check-appear 4s ease infinite; }
                    .exc1       { animation: exclaim-pulse  4s ease infinite; }
                    .exc2       { animation: exclaim2-pulse 4s ease infinite; }
                    .glow-r     { animation: glow-ring 4s ease infinite; }
                    .score-pop  { animation: score-jump 4s ease infinite; }
                  `}</style>
                  <defs>
                    <linearGradient id="v2b_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF7ED"/><stop offset="100%" stopColor="#FFFBEB"/></linearGradient>
                    <linearGradient id="mg_handle" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#92400E"/><stop offset="100%" stopColor="#B45309"/></linearGradient>
                    <linearGradient id="mg_lens" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="rgba(219,234,254,0.85)"/><stop offset="100%" stopColor="rgba(191,219,254,0.6)"/></linearGradient>
                    <filter id="mg_shadow"><feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.18)"/></filter>
                  </defs>
                  <circle cx="75" cy="75" r="72" fill="url(#v2b_bg)"/>
                  <ellipse cx="75" cy="138" rx="40" ry="6" fill="rgba(0,0,0,0.06)"/>
                  <rect x="22" y="28" width="100" height="92" rx="10" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
                  <rect x="22" y="28" width="100" height="22" rx="10" fill="#F8FAFC"/>
                  <rect x="22" y="39"  width="100" height="11" fill="#F8FAFC"/>
                  <text x="72" y="43" textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="700" fontFamily="Arial">TOPIC PERFORMANCE</text>
                  <rect x="30" y="58" width="84" height="16" rx="4" className="t-row1"/>
                  <rect x="34" y="62" width="44" height="8" rx="3" fill="#CBD5E1"/>
                  <rect x="84" y="62" width="24" height="8" rx="3" fill="#CBD5E1"/>
                  <text x="96" y="69" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="Arial" className="l-row1">62%</text>
                  <text x="36" y="69" fontSize="7" fontFamily="Arial" fill="#64748B">Algebra</text>
                  <text x="108" y="62" fontSize="11" fontWeight="900" fontFamily="Arial" className="exc1">!</text>
                  <rect x="30" y="80" width="84" height="16" rx="4" className="t-row2"/>
                  <rect x="34" y="84" width="52" height="8" rx="3" fill="#CBD5E1"/>
                  <rect x="92" y="84" width="16" height="8" rx="3" fill="#CBD5E1"/>
                  <text x="100" y="91" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="Arial" className="l-row2">44%</text>
                  <text x="36" y="91" fontSize="7" fontFamily="Arial" fill="#64748B">Geometry</text>
                  <text x="108" y="84" fontSize="11" fontWeight="900" fontFamily="Arial" className="exc2">!</text>
                  <rect x="30" y="102" width="84" height="16" rx="4" className="t-row3"/>
                  <rect x="34" y="106" width="28" height="8" rx="3" fill="#CBD5E1"/>
                  <rect x="68" y="106" width="40" height="8" rx="3" fill="#CBD5E1"/>
                  <text x="88" y="113" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="Arial" className="l-row3">38%</text>
                  <text x="36" y="113" fontSize="7" fontFamily="Arial" fill="#64748B">Fractions</text>
                  <text x="109" y="114" fontSize="11" fontWeight="900" fontFamily="Arial" fill="#15803D" className="chk">✓</text>
                  <circle cx="75" cy="113" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" className="glow-r" r="28"/>
                  <g className="score-pop">
                    <rect x="52" y="90" width="46" height="16" rx="6" fill="#15803D"/>
                    <text x="75" y="101" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="Arial">+18 pts!</text>
                  </g>
                  <g className="mg-glass" filter="url(#mg_shadow)">
                    <line x1="87" y1="87" x2="98" y2="98" stroke="url(#mg_handle)" strokeWidth="7" strokeLinecap="round"/>
                    <circle cx="72" cy="72" r="22" stroke="#3B82F6" strokeWidth="4" fill="none"/>
                    <circle cx="72" cy="72" r="19" fill="url(#mg_lens)"/>
                    <circle cx="65" cy="65" r="5" fill="rgba(255,255,255,0.5)"/>
                    <circle cx="63" cy="63" r="2" fill="rgba(255,255,255,0.7)"/>
                  </g>
                </svg>
              </div>
              <h3 className="val-card-title">Focus on what actually moves your score</h3>
              <p className="val-card-text">Target weak areas instead of spending time on topics you already understand.</p>
              <div className="val-card-badge">Most impactful</div>
            </div>

            {/* Card 3 — See progress */}
            <div className="val-card">
              <div className="val-card-svg-wrap">
                <svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <style>{`
                    @keyframes bar1-grow { 0%,10%{height:0;y:110} 40%,100%{height:30;y:80} }
                    @keyframes bar2-grow { 0%,25%{height:0;y:110} 55%,100%{height:50;y:60} }
                    @keyframes bar3-grow { 0%,40%{height:0;y:110} 70%,100%{height:68;y:42} }
                    @keyframes bar4-grow { 0%,55%{height:0;y:110} 85%,100%{height:85;y:25} }
                    @keyframes trend-draw { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
                    @keyframes star-bounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.1)} }
                    @keyframes score-count { 0%,50%{opacity:0} 70%,100%{opacity:1} }
                    .vb1 { animation: bar1-grow 3s ease-in-out infinite; }
                    .vb2 { animation: bar2-grow 3s ease-in-out infinite; }
                    .vb3 { animation: bar3-grow 3s ease-in-out infinite; }
                    .vb4 { animation: bar4-grow 3s ease-in-out infinite; }
                    .vtrend { animation: trend-draw 3s ease-in-out infinite; stroke-dasharray: 200; }
                    .vstar  { animation: star-bounce 2s ease-in-out infinite; transform-origin: 110px 32px; }
                    .vscore { animation: score-count 3s ease-in-out infinite; }
                  `}</style>
                  <defs>
                    <linearGradient id="v3_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EFF6FF"/><stop offset="100%" stopColor="#DBEAFE"/></linearGradient>
                    <linearGradient id="v3_b1" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#93C5FD"/></linearGradient>
                    <linearGradient id="v3_b2" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#2563EB"/><stop offset="100%" stopColor="#60A5FA"/></linearGradient>
                    <linearGradient id="v3_b3" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#1D4ED8"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient>
                    <linearGradient id="v3_b4" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#15803D"/><stop offset="100%" stopColor="#4ADE80"/></linearGradient>
                  </defs>
                  <circle cx="75" cy="75" r="72" fill="url(#v3_bg)"/>
                  <ellipse cx="75" cy="138" rx="40" ry="6" fill="rgba(0,0,0,0.06)"/>
                  <rect x="18" y="20" width="110" height="96" rx="8" fill="white" stroke="#BFDBFE" strokeWidth="1.5"/>
                  <line x1="28" y1="110" x2="118" y2="110" stroke="#E2E8F0" strokeWidth="1"/>
                  <line x1="28" y1="90"  x2="118" y2="90"  stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3"/>
                  <line x1="28" y1="70"  x2="118" y2="70"  stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3"/>
                  <line x1="28" y1="50"  x2="118" y2="50"  stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3"/>
                  <rect x="30" y="80" width="16" height="30" rx="4" fill="url(#v3_b1)" className="vb1"/>
                  <rect x="52" y="60" width="16" height="50" rx="4" fill="url(#v3_b2)" className="vb2"/>
                  <rect x="74" y="42" width="16" height="68" rx="4" fill="url(#v3_b3)" className="vb3"/>
                  <rect x="96" y="25" width="16" height="85" rx="4" fill="url(#v3_b4)" className="vb4"/>
                  <polyline points="38,94 60,78 82,55 104,32" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" className="vtrend"/>
                  <circle cx="38"  cy="94" r="4" fill="#FBBF24"/>
                  <circle cx="60"  cy="78" r="4" fill="#FBBF24"/>
                  <circle cx="82"  cy="55" r="4" fill="#FBBF24"/>
                  <circle cx="104" cy="32" r="5" fill="#FBBF24" stroke="white" strokeWidth="2"/>
                  <g className="vstar">
                    <rect x="92" y="18" width="36" height="18" rx="6" fill="#FBBF24"/>
                    <text x="110" y="30" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="Arial" className="vscore">+42 pts</text>
                  </g>
                </svg>
              </div>
              <h3 className="val-card-title">See your progress clearly</h3>
              <p className="val-card-text">Track improvement step by step and build confidence as you prepare for exam day.</p>
            </div>
          </div>

          <div className="val-cta">
            <button className="btn btn-green btn-lg" onClick={() => handleStart(selectedExam)}>
              Start your free trial now →
            </button>
            <p className="val-cta-sub">7-day free trial · No credit card required</p>
          </div>
        </div>
      </section>

      {/* ── 5. BUILT FOR YOUR SITUATION ──────────────────────────────────── */}
      <SituationSection onStart={handleStart} selectedExam={selectedExam} />

      {/* ── 6. COMPARISON ────────────────────────────────────────────────── */}
      <section className="cmp-section">
        <div className="home-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="cmp-header">
            <div className="cmp-eyebrow">The difference is clear</div>
            <h2 className="cmp-headline">
              Better than random prep<br />and crash courses
            </h2>
            <p className="cmp-subhead">
              Students across Saudi Arabia are switching to DrFahm because structure beats volume every time.
            </p>
          </div>

          <div className="cmp-grid">
            <div className="cmp-col cmp-col-bad">
              <div className="cmp-col-header">
                <div className="cmp-col-icon cmp-col-icon-bad">✕</div>
                <h3 className="cmp-col-title cmp-col-title-bad">Typical preparation</h3>
              </div>
              <div className="cmp-items">
                {COMPARISON_LEFT.map((item, i) => (
                  <div key={item} className="cmp-item cmp-item-bad" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="cmp-item-icon cmp-item-icon-bad">✕</div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cmp-vs">
              <div className="cmp-vs-line" />
              <div className="cmp-vs-badge">VS</div>
              <div className="cmp-vs-line" />
            </div>

            <div className="cmp-col cmp-col-good">
              <div className="cmp-col-header">
                <div className="cmp-col-icon cmp-col-icon-good">✓</div>
                <h3 className="cmp-col-title cmp-col-title-good">DrFahm</h3>
              </div>
              <div className="cmp-items">
                {COMPARISON_RIGHT.map((item, i) => (
                  <div key={item} className="cmp-item cmp-item-good" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="cmp-item-icon cmp-item-icon-good">✓</div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cmp-footer">
            <p className="cmp-closing">
              Doing more isn't the same as improving. <strong>Focus is what moves your score.</strong>
            </p>
            <button className="btn btn-green btn-lg" onClick={() => handleStart(selectedExam)}>
              Start your free trial now →
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="fcta-section" ref={ctaRef}>
        <div className="fcta-particles" aria-hidden="true">
          {[...Array(12)].map((_, i) => (
            <div key={i} className={`fcta-particle fcta-p${i + 1}`} />
          ))}
        </div>
        <div className="fcta-orb fcta-orb-1" />
        <div className="fcta-orb fcta-orb-2" />

        <div className="home-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="fcta-inner">
            <div className="fcta-eyebrow">
              <span className="fcta-eyebrow-dot" />
              Free 7-day trial — no credit card required
            </div>
            <h2 className="fcta-headline">
              Start your free trial.<br />
              <span className="fcta-headline-accent">See what to fix from session one.</span>
            </h2>
            <p className="fcta-sub">
              Choose your exam, follow a structured plan, and start improving from day one.
            </p>
            <div className="fcta-trust-row">
              {['✓ 7-day free trial', '✓ No credit card', '✓ Cancel anytime', '✓ Instant access'].map((t) => (
                <span key={t} className="fcta-trust-pill">{t}</span>
              ))}
            </div>
            <div className="fcta-buttons">
              <button className="fcta-btn-primary" onClick={() => handleStart(selectedExam)}>
                Start free — {selectedExam === 'tahsili' ? 'Tahsili' : 'Qudurat'}
              </button>
              <button className="fcta-btn-secondary"
                onClick={() => handleStart(selectedExam === 'tahsili' ? 'qudurat' : 'tahsili')}>
                or start with {selectedExam === 'tahsili' ? 'Qudurat' : 'Tahsili'} →
              </button>
            </div>
            <p className="fcta-login">
              Already have an account?{' '}
              <Link to="/login" className="fcta-login-link">Log in</Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── 8. FOOTER ────────────────────────────────────────────────────── */}
      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <LogoFull
                height={26}
                markColor="var(--brand-sand)"
                fColor="rgba(245,242,236,0.85)"
                textColor="rgba(245,242,236,0.85)"
                dotColor="var(--brand-sand)"
              />
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
    </>
  );
}