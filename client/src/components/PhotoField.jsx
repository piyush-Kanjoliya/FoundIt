import {useEffect, useRef, useState} from 'react';

export default function PhotoField({
  name = 'photo',
  label = 'Photo',
  hint = 'JPEG, PNG or WebP · up to 5 MB',
}) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);
  const url = useRef('');

  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    []
  );

  const clear = () => {
    if (input.current) input.current.value = '';
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
    setPreview('');
    setError('');
  };

  const choose = e => {
    const file = e.target.files?.[0];
    setError('');
    if (!file) return clear();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      clear();
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      clear();
      setError('Photos must be 5 MB or smaller.');
      return;
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(file);
    setPreview(url.current);
  };

  return (
    <div className="field">
      <span>{label}</span>
      <small className="muted">{hint}</small>
      {preview ? <img src={preview} alt="Selected preview" width="160" /> : null}
      <input
        ref={input}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        onChange={choose}
      />
      {preview ? (
        <button type="button" className="btn btn-outline" onClick={clear}>
          Remove photo
        </button>
      ) : null}
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
