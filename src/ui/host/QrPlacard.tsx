import { useMemo } from "react";
import { qrCanvasSize, qrMatrix, qrPath } from "../../domain/qrCode";

/**
 * The placard, drawn as the card it will be printed as.
 *
 * A Host deciding whether to pay for a property is deciding whether to put
 * this object in their hallway, so the screen shows the object rather than a
 * sentence describing one. It is the same address, the same code and the same
 * words the printed kit will carry; what a running subscription buys is the
 * printable file and a wall for the code to lead to, not the sight of it.
 *
 * The card keeps paper-white and ink-black in both colour schemes, and is
 * deliberately not themed: a scanner needs dark modules on a light ground, an
 * inverted code is a code that will not read, and a printed card does not
 * have a dark mode.
 */
export function QrPlacard({ name, url }: { name: string; url: string }) {
  const matrix = useMemo(() => qrMatrix(url), [url]);
  const side = qrCanvasSize(matrix);
  // The address is printed under the code without its scheme: it is there for
  // a guest whose camera will not focus, and "https://" helps nobody type.
  const spoken = url.replace(/^https?:\/\//, "");

  return (
    <figure className="placard">
      <div className="placard-card">
        <p className="placard-lead">Everything you need for your stay</p>
        <h4 className="placard-name">{name}</h4>
        <svg
          className="placard-code"
          viewBox={`0 0 ${side} ${side}`}
          role="img"
          aria-label={`QR code for ${spoken}`}
          shapeRendering="crispEdges"
        >
          <rect width={side} height={side} fill="#ffffff" />
          <path d={qrPath(matrix)} fill="#14181b" />
        </svg>
        <p className="placard-invite">Scan to read the house guidance and to leave a memory behind.</p>
        <p className="placard-address">{spoken}</p>
        <p className="placard-mark">DigiStayBook</p>
      </div>
    </figure>
  );
}
