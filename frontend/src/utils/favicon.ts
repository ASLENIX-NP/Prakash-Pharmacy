/**
 * Updates the browser tab favicon dynamically and reliably across all browsers.
 *
 * It automatically trims empty transparent margins so the actual logo emblem
 * fills 95% of the favicon canvas rather than appearing tiny in the tab.
 * It also compresses the result into a high-DPI 64x64 PNG (~2KB-4KB) so browsers
 * immediately accept and render it without hitting data URL size limits.
 */
export function setBrowserFavicon(imageSrc?: string | null): void {
  if (typeof document === 'undefined') return;

  const defaultFavicon = '/favicon.png';
  const rawSrc = imageSrc && imageSrc.trim() ? imageSrc.trim() : defaultFavicon;

  const replaceFaviconLinks = (href: string) => {
    // Remove all existing icon links to force browser tab to repaint immediately
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

  const img = new Image();
  if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) {
    img.crossOrigin = 'anonymous';
  }

  img.onload = () => {
    try {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      // Render onto an analysis canvas to detect the bounding box of the actual emblem
      const scanCanvas = document.createElement('canvas');
      const maxScan = 512;
      const scanScale = Math.min(1, maxScan / Math.max(naturalW, naturalH));
      const scanW = Math.max(1, Math.round(naturalW * scanScale));
      const scanH = Math.max(1, Math.round(naturalH * scanScale));

      scanCanvas.width = scanW;
      scanCanvas.height = scanH;
      const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

      if (!scanCtx) {
        replaceFaviconLinks(rawSrc);
        return;
      }

      scanCtx.drawImage(img, 0, 0, scanW, scanH);
      const imgData = scanCtx.getImageData(0, 0, scanW, scanH);
      const data = imgData.data;

      let minX = scanW;
      let maxX = 0;
      let minY = scanH;
      let maxY = 0;
      let foundContent = false;

      // Check if image corners are opaque white (common in JPEGs without alpha)
      const isCornerWhite = (idx: number) => {
        return data[idx] > 240 && data[idx + 1] > 240 && data[idx + 2] > 240 && data[idx + 3] > 200;
      };
      const hasWhiteBg =
        isCornerWhite(0) &&
        isCornerWhite((scanW - 1) * 4) &&
        isCornerWhite(((scanH - 1) * scanW) * 4);

      // Scan for visible content pixels
      for (let y = 0; y < scanH; y++) {
        for (let x = 0; x < scanW; x++) {
          const idx = (y * scanW + x) * 4;
          const alpha = data[idx + 3];

          let isPixelContent = false;
          if (hasWhiteBg) {
            // Content is anything not near-white
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            isPixelContent = alpha > 15 && !(r > 240 && g > 240 && b > 240);
          } else {
            // Content is anything not transparent
            isPixelContent = alpha > 15;
          }

          if (isPixelContent) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            foundContent = true;
          }
        }
      }

      // Convert back to original coordinate space
      const cropX = foundContent ? Math.floor(minX / scanScale) : 0;
      const cropY = foundContent ? Math.floor(minY / scanScale) : 0;
      const cropW = foundContent
        ? Math.min(naturalW - cropX, Math.ceil((maxX - minX + 1) / scanScale))
        : naturalW;
      const cropH = foundContent
        ? Math.min(naturalH - cropY, Math.ceil((maxY - minY + 1) / scanScale))
        : naturalH;

      // Draw the cropped emblem onto a 64x64 canvas, maximizing size with 2px padding
      const iconSize = 64;
      const canvas = document.createElement('canvas');
      canvas.width = iconSize;
      canvas.height = iconSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        replaceFaviconLinks(rawSrc);
        return;
      }

      ctx.clearRect(0, 0, iconSize, iconSize);

      // Maximize the emblem size inside the 64x64 square
      const targetBox = iconSize - 4; // 60px visible area
      const scale = Math.min(targetBox / cropW, targetBox / cropH);
      const drawW = cropW * scale;
      const drawH = cropH * scale;
      const drawX = (iconSize - drawW) / 2;
      const drawY = (iconSize - drawH) / 2;

      ctx.drawImage(img, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH);
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
