/**
 * LogoSVG.jsx — PNG-based brand logo
 *
 * Renders the brand artwork from /logo-full.png and /logo-mark.png
 * (placed in frontend/public).
 *
 * Components:
 *   LogoMark — DF monogram only (square, used in tight spaces / icons)
 *   LogoFull — full lockup: DF mark + "Dr.Fahm" wordmark (default export)
 *
 * Props (all optional):
 *   height    — display height in px
 *   dark      — if true, loads the light-on-dark variant where the navy F
 *               becomes warm white. Use this on dark backgrounds (footer etc).
 *   className — passthrough
 *   style     — passthrough
 *
 * Note: the legacy color props (dColor, fColor, textColor, dotColor) are
 * accepted but no-ops now. Kept in the signature so existing callers
 * (Navbar.jsx) don't break.
 */

import React from 'react';

// Aspect ratio of /logo-full.png — width 1294 ÷ height 220 = ~5.88
const FULL_ASPECT = 1294 / 220;

export function LogoMark({
  height    = 36,
  dark      = false,
  className = '',
  style     = {},
  // eslint-disable-next-line no-unused-vars
  dColor, dColorDeep, fColor, idSuffix,
}) {
  const src = dark ? '/logo-mark-dark.png' : '/logo-mark.png';
  return (
    <img
      src={src}
      alt="DrFahm"
      width={height}
      height={height}
      className={className}
      style={{
        display:   'inline-block',
        height:    `${height}px`,
        width:     `${height}px`,
        objectFit: 'contain',
        ...style,
      }}
      draggable={false}
    />
  );
}

export function LogoFull({
  height    = 34,
  dark      = false,
  className = '',
  style     = {},
  // eslint-disable-next-line no-unused-vars
  dColor, dColorDeep, fColor, textColor, dotColor, idSuffix,
}) {
  const width = Math.round(height * FULL_ASPECT);
  const src   = dark ? '/logo-full-dark.png' : '/logo-full.png';
  return (
    <img
      src={src}
      alt="DrFahm"
      width={width}
      height={height}
      className={`logo-full-wrap ${className}`}
      style={{
        display:    'inline-block',
        height:     `${height}px`,
        width:      'auto',
        objectFit:  'contain',
        userSelect: 'none',
        ...style,
      }}
      draggable={false}
    />
  );
}

export default LogoFull;