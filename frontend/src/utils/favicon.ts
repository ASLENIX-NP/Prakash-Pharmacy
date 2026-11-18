/**
 * Use the official static pharmacy icon for browser tabs and installed apps.
 * The configurable store logo remains available inside the application,
 * but must never overwrite the browser or desktop app icons.
 */
export function setBrowserFavicon(_imageSrc?: string | null): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll<HTMLLinkElement>(
    "link[rel*='icon']"
  ).forEach(link => link.remove());

  const icons = [
    { rel: 'icon', href: '/favicon.png?v=pp4', type: 'image/png' },
    { rel: 'shortcut icon', href: '/favicon.ico?v=pp4', type: 'image/x-icon' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png?v=pp4', type: 'image/png' },
  ];

  for (const icon of icons) {
    const link = document.createElement('link');
    link.rel = icon.rel;
    link.href = icon.href;
    link.type = icon.type;

    if (icon.rel === 'icon') {
      link.id = 'app-favicon';
    }

    document.head.appendChild(link);
  }
}