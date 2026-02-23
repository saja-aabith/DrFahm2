/**
 * ImageUpload — drag-and-drop + click-to-pick image upload component.
 *
 * Converts images to base64 data URLs for storage in the DB.
 * Enforces max file size (default 500KB).
 * Shows preview with remove button.
 *
 * Props:
 *   value      — current image_url (base64 or external URL)
 *   onChange   — (newValue: string|null) => void
 *   maxSizeKB  — max file size in KB (default 500)
 */

import React, { useState, useRef, useCallback } from 'react';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];

export default function ImageUpload({ value, onChange, maxSizeKB = 500 }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef(null);

  const processFile = useCallback((file) => {
    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PNG, JPEG, WebP, SVG, and GIF images are allowed.');
      return;
    }

    if (file.size > maxSizeKB * 1024) {
      setError(`Image must be under ${maxSizeKB}KB. This file is ${Math.round(file.size / 1024)}KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onChange(e.target.result); // data:image/...;base64,...
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsDataURL(file);
  }, [onChange, maxSizeKB]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  }, [processFile]);

  const handleRemove = useCallback(() => {
    onChange(null);
    setError('');
  }, [onChange]);

  // If there's already an image, show preview
  if (value) {
    return (
      <div className="admin-image-upload">
        <div className="admin-image-preview">
          <img src={value} alt="Question diagram" />
          <button
            type="button"
            className="admin-image-remove"
            onClick={handleRemove}
            title="Remove image"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-image-upload">
      <div
        className={`admin-image-dropzone ${dragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
      >
        <span className="admin-image-dropzone-icon">🖼️</span>
        <span className="admin-image-dropzone-text">
          <strong>Click to upload</strong> or drag & drop<br />
          PNG, JPEG, WebP, SVG · Max {maxSizeKB}KB
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error && (
        <div style={{ fontSize: '0.82rem', color: '#fca5a5', marginTop: 2 }}>{error}</div>
      )}
    </div>
  );
}