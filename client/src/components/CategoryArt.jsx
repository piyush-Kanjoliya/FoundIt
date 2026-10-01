const ICONS = {
  'ID Cards': '🪪',
  'Room Keys': '🔑',
  Calculators: '🧮',
  'Lab Equipment': '🧪',
  Earphones: '🎧',
  Wallets: '👛',
};

export default function CategoryArt({category}) {
  return (
    <span aria-hidden="true" style={{fontSize: '3rem'}}>
      {ICONS[category] || '📦'}
    </span>
  );
}
