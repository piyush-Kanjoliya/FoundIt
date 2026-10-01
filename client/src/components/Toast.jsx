export default function ToastStack({toasts, onDismiss}) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div className="toast" role="status" key={t.id}>
          {t.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
