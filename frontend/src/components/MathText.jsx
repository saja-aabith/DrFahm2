/**
 * MathText — renders text containing LaTeX math notation.
 *
 * Delimiters:
 *   $$...$$  → display math (centered, block)
 *   $...$    → inline math
 *
 * Plain text passes through unchanged. Existing questions without $
 * delimiters render normally — zero breaking changes.
 *
 * Requires: npm install katex
 * KaTeX CSS is imported here so it's only loaded when this component is used.
 */

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Parse text into segments of plain text and LaTeX.
 * Handles $$...$$ (display) first, then $...$ (inline).
 */
function parseSegments(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', value: text || '' }];

  const segments = [];
  // Split on display math first: $$...$$
  const displayParts = text.split(/(\$\$[\s\S]+?\$\$)/g);

  for (const part of displayParts) {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      segments.push({ type: 'display', value: part.slice(2, -2).trim() });
    } else {
      // Now split remaining on inline math: $...$
      const inlineParts = part.split(/(\$[^$\n]+?\$)/g);
      for (const ip of inlineParts) {
        if (ip.startsWith('$') && ip.endsWith('$') && ip.length > 2) {
          segments.push({ type: 'inline', value: ip.slice(1, -1).trim() });
        } else if (ip) {
          segments.push({ type: 'text', value: ip });
        }
      }
    }
  }

  return segments;
}

/**
 * Render a single LaTeX string to HTML using KaTeX.
 * Returns raw HTML string. Falls back to showing the LaTeX source on error.
 */
function renderLatex(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
      // Common macros for Saudi math exams
      macros: {
        '\\R': '\\mathbb{R}',
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
      },
    });
  } catch (e) {
    // Fallback: show the raw LaTeX in a styled span
    return `<span class="math-error" title="LaTeX error: ${e.message}">${latex}</span>`;
  }
}

/**
 * MathText component.
 *
 * Usage:
 *   <MathText text="Find $\frac{1}{2} + \frac{3}{4}$" />
 *   <MathText text="$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$" />
 *   <MathText text="Plain text with no math" />
 */
export default function MathText({ text, className = '', style = {} }) {
  const rendered = useMemo(() => {
    if (!text) return '';

    // Quick check: if there are no $ characters, skip parsing entirely
    if (!text.includes('$')) {
      return null; // signals to render as plain text
    }

    const segments = parseSegments(text);
    return segments.map((seg, i) => {
      if (seg.type === 'display') {
        return `<span class="math-display" key="${i}">${renderLatex(seg.value, true)}</span>`;
      }
      if (seg.type === 'inline') {
        return `<span class="math-inline">${renderLatex(seg.value, false)}</span>`;
      }
      // Plain text — escape HTML
      return seg.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }).join('');
  }, [text]);

  // No math delimiters found — render as plain text (no dangerouslySetInnerHTML)
  if (rendered === null) {
    return <span className={className} style={style}>{text}</span>;
  }

  return (
    <span
      className={`math-text ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

/**
 * LaTeX Cheatsheet data for admin panel tooltip.
 */
export const LATEX_CHEATSHEET = [
  { label: 'Fraction',       code: '\\frac{a}{b}',                  example: '\\frac{1}{2}' },
  { label: 'Square root',    code: '\\sqrt{x}',                     example: '\\sqrt{16}' },
  { label: 'Nth root',       code: '\\sqrt[n]{x}',                  example: '\\sqrt[3]{27}' },
  { label: 'Exponent',       code: 'x^{n}',                         example: 'x^{2}' },
  { label: 'Subscript',      code: 'x_{n}',                         example: 'a_{1}' },
  { label: 'Plus-minus',     code: '\\pm',                          example: '\\pm 5' },
  { label: 'Infinity',       code: '\\infty',                       example: '\\infty' },
  { label: 'Not equal',      code: '\\neq',                         example: 'a \\neq b' },
  { label: 'Less/greater',   code: '\\leq \\geq',                   example: 'x \\leq 10' },
  { label: 'Pi',             code: '\\pi',                          example: '2\\pi r' },
  { label: 'Theta',          code: '\\theta',                       example: '\\sin\\theta' },
  { label: 'Trig functions', code: '\\sin \\cos \\tan',             example: '\\sin(30°)' },
  { label: 'Degree symbol',  code: '^{\\circ}',                     example: '90^{\\circ}' },
  { label: 'Absolute value', code: '|x|',                           example: '|x-3|' },
  { label: 'Vector',         code: '\\vec{v}',                      example: '\\vec{AB}' },
  { label: 'Summation',      code: '\\sum_{i=1}^{n}',              example: '\\sum_{i=1}^{n} i' },
  { label: 'Integral',       code: '\\int_{a}^{b}',                example: '\\int_{0}^{1} x\\,dx' },
  { label: 'Greek letters',  code: '\\alpha \\beta \\gamma \\delta', example: '\\alpha + \\beta' },
  { label: 'Parentheses (big)', code: '\\left( \\right)',           example: '\\left(\\frac{a}{b}\\right)' },
  { label: 'Display block',  code: '$$...$$',                       example: '$$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$' },
  { label: 'Inline math',    code: '$...$',                         example: 'Find $x$ if $2x+3=7$' },
];