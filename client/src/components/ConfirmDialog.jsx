import Sheet from './Sheet.jsx';
import Button from './Button.jsx';

export default function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted">{body}</p>
      <div style={{display: 'flex', gap: 8, marginTop: 16}}>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
