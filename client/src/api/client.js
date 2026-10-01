export async function api(path, options = {}) {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: isForm
      ? options.headers
      : {'Content-Type': 'application/json', ...options.headers},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const post = (path, body, method = 'POST') =>
  api(path, {method, body: JSON.stringify(body)});
