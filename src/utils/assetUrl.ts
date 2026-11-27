export function resolveAssetUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const base = import.meta.env.BASE_URL || './';
  const cleanPath = trimmed.replace(/^\/+/, '');

  if (base === './' || base === '.') {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/admin')
    ) {
      return `/${cleanPath}`;
    }
    return `./${cleanPath}`;
  }

  return `${base.endsWith('/') ? base : `${base}/`}${cleanPath}`;
}
