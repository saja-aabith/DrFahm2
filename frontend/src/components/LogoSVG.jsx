/**
 * LogoSVG.jsx
 * Inline SVG recreation of the DrFahm DF mark.
 * Uses SVG arc commands for geometrically precise letterforms.
 * No external dependency — works on any background.
 *
 * Exports:
 *   LogoMark  — DF monogram only
 *   LogoFull  — DF mark + "Dr.Fahm" wordmark (default export)
 */

import React from 'react';

/**
 * DF monogram — viewBox "0 0 84 46"
 *
 * D (x 0–38, h 46)
 *   Outer: left bar top → arc CW to bottom → close  (rx=20, ry=23 → max x = 18+20 = 38)
 *   Counter (evenodd cutout): inner top → arc CW to inner bottom → close (rx=11, ry=15)
 *
 * F (x 44–80, h 46)
 *   Single outline path tracing top bar + middle bar + vertical stroke.
 */
const D_PATH =
  'M0,0 H18 A20,23 0 0 1 18,46 H0 Z ' +
  'M9,8 H16 A11,15 0 0 1 16,38 H9 Z';

const F_PATH =
  'M44,0 H80 V9 H54 V20 H70 V29 H54 V46 H44 Z';

// ── DF monogram mark ──────────────────────────────────────────────────────────
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
      <path fillRule="evenodd" clipRule="evenodd" d={D_PATH} fill={color} />
      <path d={F_PATH} fill={color} />
    </svg>
  );
}

// ── Full logo: mark + "Dr.Fahm" wordmark ─────────────────────────────────────
export function LogoFull({
  height    = 34,
  markColor = '#15803D',
  textColor = '#0F172A',
  dotColor  = '#15803D',
  className = '',
  style     = {},
}) {
  const gap      = Math.round(height * 0.38);
  const fontSize = Math.round(height * 0.76);

  return (
    <span
      className={`logo-full-wrap ${className}`}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            `${gap}px`,
        textDecoration: 'none',
        lineHeight:     1,
        userSelect:     'none',
        ...style,
      }}
    >
      <LogoMark height={height} color={markColor} />
      {/* All colors set as inline styles — no CSS can override */}
      <span
        style={{
          fontSize:      `${fontSize}px`,
          fontWeight:    800,
          letterSpacing: '-0.5px',
          fontFamily:    "'Tajawal', sans-serif",
          color:         textColor,
          lineHeight:    1,
          whiteSpace:    'nowrap',
        }}
      >
        Dr<span style={{ color: dotColor }}>.</span>Fahm
      </span>
    </span>
  );
}

export default LogoFull;