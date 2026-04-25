/**
 * LogoSVG.jsx — refreshed brand mark
 *
 * Components:
 *   LogoMark — DF monogram only (interlocked green D + navy F)
 *   LogoFull — mark + "Dr.Fahm" wordmark with green dot for the period
 *
 * Color props (all optional, sensible defaults for light backgrounds):
 *   dColor      — the D gradient start (default #4ADE80, dark mode #4ADE80)
 *   dColorDeep  — the D gradient end   (default #16A34A, dark mode #22C55E)
 *   fColor      — the F letterform     (default #1B2B4B, dark mode #FFFFFF)
 *   textColor   — "Dr" + "Fahm"        (default #1B2B4B, dark mode #FFFFFF)
 *   dotColor    — the period dot       (default #22C55E, dark mode #4ADE80)
 *
 * NOTE — to preserve the existing Navbar dark/light prop API, dColor/fColor
 * still accept the old prop names. dColorDeep is new and falls back to dColor
 * if not provided (renders a flat green instead of gradient — fine).
 */

import React from 'react';

// Stable IDs are fine — every LogoMark instance shares the same gradient/mask defs
// in the DOM. SVG reuses them by id reference. If you ever need multiple distinct
// gradients on one page (different green tones), pass a unique idSuffix prop.

// ── Mark only ─────────────────────────────────────────────────────────────────
export function LogoMark({
  height     = 36,
  dColor     = '#4ADE80',
  dColorDeep,                     // optional gradient end
  fColor     = '#1B2B4B',
  className  = '',
  idSuffix   = '',                // pass when rendering multiple variants on one page
}) {
  // Source artwork is 252w × 224h within viewBox "80 44 252 224"
  // Square the bounding box for symmetric rendering at any height
  const aspect = 252 / 224;
  const width  = Math.round(height * aspect);
  const gradId = `df-d-grad${idSuffix}`;
  const maskId = `df-d-mask${idSuffix}`;
  const deep   = dColorDeep || dColor;

  return (
    <svg
      width={width}
      height={height}
      viewBox="80 44 252 224"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={dColor} />
          <stop offset="100%" stopColor={deep}  />
        </linearGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width="400" height="320" fill="white" />
          <path
            d="M 98,52 L 248,52 Q 280,52 288,94 Q 294,120 294,152 Q 294,192 279,220 Q 260,256 218,260 L 110,260 L 98,260 Q 88,260 88,250 L 88,62 Q 88,52 98,52 Z"
            fill="black"
          />
        </mask>
      </defs>

      {/* Navy F — drawn first, masked where the D overlaps */}
      <g mask={`url(#${maskId})`}>
        <rect x="192" y="52" width="38" height="208" rx="10" fill={fColor} />
        <path
          d="M 192,52 L 314,52 Q 324,52 324,62 L 324,90 Q 324,100 314,90 L 192,90 Z"
          fill={fColor}
        />
        <path
          d="M 192,134 L 290,134 Q 300,134 300,144 L 300,168 Q 300,178 290,168 L 192,168 Z"
          fill={fColor}
        />
      </g>

      {/* Green D — gradient, on top */}
      <path
        d="M 98,52 L 248,52 Q 280,52 288,94 Q 294,120 294,152 Q 294,192 279,220 Q 260,256 218,260 L 110,260 L 98,260 Q 88,260 88,250 L 88,62 Q 88,52 98,52 Z"
        fill={`url(#${gradId})`}
      />
      {/* D inner cutout */}
      <path
        d="M 140,97 L 178,97 Q 212,99 230,128 Q 244,148 244,164 Q 244,188 226,210 Q 204,232 170,234 L 140,234 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── Full logo ─────────────────────────────────────────────────────────────────
export function LogoFull({
  height     = 34,
  dColor     = '#4ADE80',
  dColorDeep,
  fColor     = '#1B2B4B',
  textColor  = '#1B2B4B',
  dotColor   = '#22C55E',
  className  = '',
  style      = {},
  idSuffix   = '',
}) {
  const gap      = Math.round(height * 0.34);
  const fontSize = Math.round(height * 0.78);
  const dotSize  = Math.round(height * 0.16);

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
      <LogoMark
        height={height}
        dColor={dColor}
        dColorDeep={dColorDeep}
        fColor={fColor}
        idSuffix={idSuffix}
      />

      {/* Wordmark: Dr · dot · Fahm */}
      <span
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        `${Math.round(height * 0.14)}px`,
          lineHeight: 1,
        }}
      >
        <span style={{
          fontSize:      `${fontSize}px`,
          fontWeight:    800,
          letterSpacing: '-0.5px',
          fontFamily:    "'Tajawal', sans-serif",
          color:         textColor,
          lineHeight:    1,
          whiteSpace:    'nowrap',
        }}>
          Dr
        </span>

        {/* Green dot in place of the period */}
        <span style={{
          display:      'inline-block',
          width:        `${dotSize}px`,
          height:       `${dotSize}px`,
          borderRadius: '50%',
          background:   dotColor,
          flexShrink:   0,
          marginBottom: `${Math.round(height * 0.04)}px`,
        }} />

        <span style={{
          fontSize:      `${fontSize}px`,
          fontWeight:    800,
          letterSpacing: '-0.5px',
          fontFamily:    "'Tajawal', sans-serif",
          color:         textColor,
          lineHeight:    1,
          whiteSpace:    'nowrap',
        }}>
          Fahm
        </span>
      </span>
    </span>
  );
}

export default LogoFull;