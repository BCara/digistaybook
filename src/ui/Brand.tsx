/**
 * Brand assets for DigiStayBook.
 *
 * Uses the updated logo image.
 */

import logoLongUrl from "../assets/logo-long.png";

export function BrandMark({ height = 52 }: { height?: number }) {
  return (
    <img 
      src={logoLongUrl} 
      alt="DigiStayBook Logo" 
      height={height} 
      className="brand-mark" 
    />
  );
}

export function BrandLock({ href = "/" }: { href?: string }) {
  return (
    <a className="brand" href={href}>
      <BrandMark />
    </a>
  );
}

/**
 * Decorative QR-style mark for the QR display illustration. Real displays render a
 * scannable code for the property; this draws a correctly structured stand-in
 * (finder patterns, timing rows, deterministic data field) so the illustration
 * reads as a QR code without pretending to be a working one.
 */
const QR_MODULES = 25;
const QR_QUIET = 2;

function isFinderModule(x: number, y: number): boolean | null {
  const corners = [[0, 0], [QR_MODULES - 7, 0], [0, QR_MODULES - 7]];
  for (const [ox, oy] of corners) {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < -1 || dy < -1 || dx > 7 || dy > 7) continue;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false; // separator
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return ring !== 2;
  }
  return null;
}

function qrModules(): Array<[number, number]> {
  const filled: Array<[number, number]> = [];
  let seed = 0x5bd1;
  for (let y = 0; y < QR_MODULES; y += 1) {
    for (let x = 0; x < QR_MODULES; x += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const finder = isFinderModule(x, y);
      if (finder !== null) {
        if (finder) filled.push([x, y]);
        continue;
      }
      if (x === 6 || y === 6) {
        if ((x === 6 ? y : x) % 2 === 0) filled.push([x, y]); // timing patterns
        continue;
      }
      if (((seed >> 8) & 1) === 1) filled.push([x, y]);
    }
  }
  return filled;
}

export function QrPlaceholder({ size = 72 }: { size?: number }) {
  const span = QR_MODULES + QR_QUIET * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} role="presentation" focusable="false">
      <rect width={span} height={span} rx="2" fill="#fffdf9" />
      <g fill="var(--harbour-900)" shapeRendering="crispEdges">
        {qrModules().map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x + QR_QUIET} y={y + QR_QUIET} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}

const iconPaths = {
  wall: "M4 6.5h16M4 12h16M4 17.5h10",
  manual: "M5 4.5h9.5a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3ZM19 8.5v11",
  shield: "M12 3.5 5 6.3v5.4c0 4 2.8 7.6 7 8.8 4.2-1.2 7-4.8 7-8.8V6.3ZM9.3 12l2 2 3.4-3.6",
  dashboard: "M4 4.5h6.5v6H4Zm9.5 0H20v3.5h-6.5ZM4 13.5h6.5V20H4Zm9.5-2H20V20h-6.5Z",
  qr: "M4 4.5h5.5V10H4Zm10.5 0H20V10h-5.5ZM4 14h5.5v5.5H4Zm10.5 3.5h2m3 0h.5m-5.5-3.5h5.5",
  lock: "M6.5 10.5h11v9h-11ZM9 10.5V8a3 3 0 0 1 6 0v2.5",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
} as const;

export type IconName = keyof typeof iconPaths;

export function Icon({ name }: { name: IconName }) {
  return (
    <span className="card-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d={iconPaths[name]} />
      </svg>
    </span>
  );
}
