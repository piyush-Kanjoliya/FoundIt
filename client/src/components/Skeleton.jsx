export default function Skeleton({count = 6}) {
  return (
    <div className="item-grid">
      {Array.from({length: count}, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
