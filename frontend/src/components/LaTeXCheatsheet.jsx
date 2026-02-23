/**
 * LaTeXCheatsheet — collapsible reference for common LaTeX notation.
 * Used in admin question edit/create modals.
 *
 * Click any code snippet to copy it and optionally insert into a target field.
 */

import React, { useState, useCallback } from 'react';
import { LATEX_CHEATSHEET } from './MathText';

export default function LaTeXCheatsheet({ onInsert }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  const handleClick = useCallback((code) => {
    // Copy to clipboard
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);

    // If onInsert callback provided, call it
    if (onInsert) onInsert(code);
  }, [onInsert]);

  return (
    <div>
      <button
        type="button"
        className="latex-cheatsheet-toggle"
        onClick={() => setOpen(!open)}
      >
        <span>∑</span>
        {open ? 'Hide Math Reference ▲' : 'Math Reference ▼'}
      </button>

      {open && (
        <div className="latex-cheatsheet">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Wrap math in <code style={{ color: 'var(--violet-light)', background: 'rgba(124,58,237,0.1)', padding: '1px 4px', borderRadius: 3 }}>$...$</code> for inline
            or <code style={{ color: 'var(--violet-light)', background: 'rgba(124,58,237,0.1)', padding: '1px 4px', borderRadius: 3 }}>$$...$$</code> for centered display.
            Click any code to copy.
          </div>
          <div className="latex-cheatsheet-grid">
            {LATEX_CHEATSHEET.map((item, i) => (
              <div
                key={i}
                className="latex-cheatsheet-item"
                onClick={() => handleClick(item.code)}
                title={`Click to copy: ${item.code}`}
              >
                <span className="latex-cheatsheet-label">{item.label}</span>
                <span className="latex-cheatsheet-code">
                  {copied === item.code ? '✓ Copied' : item.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}