import {useEffect, useRef} from 'react';

export default function Sheet({title, onClose, children}) {
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const nodes = [
        ...ref.current.querySelectorAll(
          'button:not(:disabled),input,textarea,select,a[href]'
        ),
      ];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet"
      >
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <h2>{title}</h2>
          <button className="btn btn-outline" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
