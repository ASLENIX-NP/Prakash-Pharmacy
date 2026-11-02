/**
 * Updates the browser tab favicon dynamically and reliably across all browsers.
 * If imageSrc is a large Data URL, it creates a crisp 64x64 canvas thumbnail so
 * the base64 payload is < 4KB (browsers silently reject large/multi-MB data URL favicons).
 */
export function setBrowserFavicon(imageSrc?: string | null): void {
  if (typeof document === 'undefined') return;

  const defaultFavicon = '/favicon.png';
  const rawSrc = imageSrc && imageSrc.trim() ? imageSrc.trim() : defaultFavicon;

  const replaceFaviconLinks = (href: string) => {
    // Remove all existing icon links to force browser tab to repaint
    const existing = document.querySelectorAll<HTMLLinkElement>(
      "link[rel*='icon'], link[rel='apple-touch-icon']"
    );
    existing.forEach((el) => el.remove());

    const isSvg = href.startsWith('data:image/svg') || href.endsWith('.svg');
    const mimeType = isSvg ? 'image/svg+xml' : 'image/png';

    // Standard favicon
    const link = document.createElement('link');
    link.id = 'app-favicon';
    link.rel = 'icon';
    link.type = mimeType;
    link.href = href;
    document.head.appendChild(link);

    // Shortcut icon for legacy / Windows browsers
    const shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.href = href;
    document.head.appendChild(shortcut);

    // Apple touch icon
    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.href = href;
    document.head.appendChild(apple);
  };

  // If not a base64 data URL, set directly
  if (!rawSrc.startsWith('data:image')) {
    replaceFaviconLinks(rawSrc);
    return;
  }

  // When given a base64 Data URL, resize it on a 64x64 canvas.
  // Full-size uploaded photos are 500KB-2MB, which browsers reject as favicon hrefs.
  // The 64x64 canvas thumbnail is only ~2KB-4KB and renders instantly in browser tabs.
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        replaceFaviconLinks(rawSrc);
        return;
      }

      ctx.clearRect(0, 0, size, size);

      // Fit maintaining aspect ratio
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;

      ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
      const thumbnailDataUrl = canvas.toDataURL('image/png');
      replaceFaviconLinks(thumbnailDataUrl);
    } catch {
      replaceFaviconLinks(rawSrc);
    }
  };
  img.onerror = () => {
    replaceFaviconLinks(defaultFavicon);
  };
  img.src = rawSrc;
}
