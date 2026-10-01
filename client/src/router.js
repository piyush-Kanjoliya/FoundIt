export function parseRoute() {
  const raw = window.location.hash.replace(/^#/, '') || '/board';
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart);
  return {
    name: parts[0] || 'board',
    id: parts[1] || '',
    params,
  };
}

export function href(name, {id = '', params} = {}) {
  const search = params && [...params].length ? `?${params}` : '';
  const rest = id ? `/${id}` : '';
  return `#/${name}${rest}${search}`;
}

export function go(name, options) {
  window.location.hash = href(name, options).slice(1);
}
