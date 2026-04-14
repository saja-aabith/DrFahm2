/**
 * LogoSVG.jsx
 * Built exactly from the provided brand SVG.
 *
 * D path:  M40 30 H80 A40 40 0 0 1 80 110 H40 Z          (green)
 * F path:  M85 30 H120 V45 H100 V65 H115 V80 H100 V110 H85 Z  (navy)
 * Dot:     circle between "Dr" and "Fahm"                 (green)
 *
 * LogoMark — DF monogram only, viewBox cropped to the mark
 * LogoFull — mark + "Dr.Fahm" wordmark (default export)
 *
 * Color props:
 *   dColor    — the D letterform  (light default: #1F7A3E | dark: #4ADE80)
 *   fColor    — the F letterform  (light default: #0F2233 | dark: #FFFFFF)
 *   textColor — "Dr" + "Fahm"     (light default: #0F2233 | dark: #FFFFFF)
 *   dotColor  — the dot           (light default: #1F7A3E | dark: #4ADE80)
 */

import React from 'react';

// ── Mark only ─────────────────────────────────────────────────────────────────
// Original mark occupies x=40–120, y=30–110 in the 600×150 viewBox.
// We crop to that region: viewBox="38 28 84 84" (2px padding each side).
export function LogoMark({
  height   = 36,
  dColor   = '#1F7A3E',   // D — green
  fColor   = '#0F2233',   // F — navy
  className = '',
}) {
  // mark is ~84×84 in source coords → square-ish
  const width = height;
  return (
    <svg
      width={width}
      height={height}
      viewBox="38 28 84 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* D — semicircular, green */}
      <path d="M40 30 H80 A40 40 0 0 1 80 110 H40 Z" fill={dColor} />
      {/* F — structured letterform, navy */}
      <path d="M85 30 H120 V45 H100 V65 H115 V80 H100 V110 H85 Z" fill={fColor} />
    </svg>
  );
}

// ── Full logo ─────────────────────────────────────────────────────────────────
export function LogoFull({
  height    = 34,
  dColor    = '#1F7A3E',
  fColor    = '#0F2233',
  textColor = '#0F2233',
  dotColor  = '#1F7A3E',
  className = '',
  style     = {},
}) {
  const gap      = Math.round(height * 0.4);
  const fontSize = Math.round(height * 0.76);
  const dotSize  = Math.round(height * 0.17);   // proportional dot

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
      <LogoMark height={height} dColor={dColor} fColor={fColor} />

      {/* Wordmark: Dr + dot + Fahm */}
      <span
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        `${Math.round(height * 0.12)}px`,
          lineHeight: 1,
        }}
      >
        <span style={{
          fontSize:      `${fontSize}px`,
          fontWeight:    700,
          letterSpacing: '-0.3px',
          fontFamily:    "'Tajawal', sans-serif",
          color:         textColor,
          lineHeight:    1,
          whiteSpace:    'nowrap',
        }}>
          Dr
        </span>

        {/* The dot — matches the SVG circle */}
        <span style={{
          display:         'inline-block',
          width:           `${dotSize}px`,
          height:          `${dotSize}px`,
          borderRadius:    '50%',
          background:      dotColor,
          flexShrink:      0,
          marginBottom:    `${Math.round(height * 0.04)}px`,  /* slight baseline lift */
        }} />

        <span style={{
          fontSize:      `${fontSize}px`,
          fontWeight:    700,
          letterSpacing: '-0.3px',
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