/**
 * LogoSVG.jsx
 * Inline SVG recreation of the DrFahm logo.
 * No external image dependency — works on any background.
 *
 * Exports:
 *   LogoMark  — the DF monogram only
 *   LogoFull  — DF mark + "Dr.Fahm" wordmark (default export)
 */

import React from 'react';

// ── DF monogram ───────────────────────────────────────────────────────────────
// ViewBox 0 0 84 46
//   D: x 0–37,  even-odd hollow letterform
//   F: x 43–77, solid letterform

export function LogoMark({ height = 36, color = '#15803D', className = '' }) {
  const width = Math.round((84 / 46) * height);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 84 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* D — outer shape minus counter = hollow letterform */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 0L0 46L17 46Q38 46 38 23Q38 0 17 0Z
           M8 7L15 7Q29 7 29 23Q29 39 15 39L8 39Z"
        fill={color}
      />
      {/* F — solid */}
      <path
        d="M43 0L43 46L52 46L52 28L69 28L69 21L52 21L52 9L77 9L77 0Z"
        fill={color}
      />
    </svg>
  );
}

// ── Full logo: mark + wordmark ────────────────────────────────────────────────
export function LogoFull({
  height     = 34,
  markColor  = '#15803D',   // DF icon color
  textColor  = '#0F172A',   // "DrFahm" wordmark color
  dotColor   = '#15803D',   // the dot between Dr and Fahm
  className  = '',
  style      = {},
}) {
  const gap      = Math.round(height * 0.38);
  const fontSize = Math.round(height * 0.74);

  return (
    <span
      className={`logo-full-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap}px`,
        textDecoration: 'none',
        lineHeight: 1,
        userSelect: 'none',
        ...style,
      }}
    >
      <LogoMark height={height} color={markColor} />
      <span
        className="logo-full-text"
        style={{
          fontSize:    `${fontSize}px`,
          fontWeight:  800,
          letterSpacing: '-0.4px',
          fontFamily:  "'Tajawal', sans-serif",
          color:       textColor,
          lineHeight:  1,
          whiteSpace:  'nowrap',
        }}
      >
        Dr<span style={{ color: dotColor }}>.</span>Fahm
      </span>
    </span>
  );
}

export default LogoFull;
