export default function EmptyState({title, body, action}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="muted">{body}</p>
      {action}
    </div>
  );
}
