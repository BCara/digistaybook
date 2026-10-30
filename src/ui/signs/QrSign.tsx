import { useMemo, type ReactNode } from "react";
import { qrCanvasSize, qrMatrix, qrPath } from "../../domain/qrCode";
import { wifiQrPayload } from "../../domain/wifi";
import { collageExtras, spokenLink, type SignStyle } from "../../domain/signStyles";
import "./signFonts";
import "./signStyles.css";

export type QrSignContent = {
  name: string;
  /** The address the code opens, already checked by `signLink`. */
  link: string;
  /** The line under the code. */
  message: string;
  wifi: { network: string; password: string } | null;
  /** A visitor's own photo, as an object URL; the style's photo otherwise. */
  photo?: string | null;
};

/**
 * One printable QR sign in one of the eighteen styles.
 *
 * Every style carries the same content in the same order, the way the
 * product's placard (host/QrPlacard.tsx) does: lead, name, code, message,
 * address, Wi-Fi code, mark. What changes is only the type and the drawing or
 * photograph around them, which is why a code that reads on one reads on all.
 */
export function QrSign({ style, content, thumb = false }: { style: SignStyle; content: QrSignContent; thumb?: boolean }) {
  const { name, link, message, wifi } = content;
  const photo = content.photo || (style.photo && (thumb ? style.photo.thumb : style.photo.src)) || "";
  const extras = collageExtras.map(extra => (thumb ? extra.thumb : extra.src));

  // The designs are set for a name about the length of "Seabreeze Cottage";
  // a longer one is drawn smaller rather than pushing the code off the card.
  const fit = Math.max(0.55, Math.min(1, 20 / Math.max(name.length, 1)));
  const nameEl = (
    <p className="nm" style={fit < 1 ? { zoom: fit } : undefined}>
      {name}
    </p>
  );
  const lead = style.lead ? <p className={style.id === "farmhouse" || style.id === "chalkboard" || style.id === "postcard" ? "sign-big" : "sign-lead"}>{style.lead}</p> : null;
  const code = <div className="sign-qrbox"><Code data={link} className="sign-code" label={`QR code for ${spokenLink(link)}`} /></div>;
  const inv = <p className="sign-inv">{message}</p>;
  const addr = <p className="sign-addr">{spokenLink(link)}</p>;
  const wifiEl = wifi ? (
    <div className="sign-wifi">
      <Code data={wifiQrPayload(wifi)} className="sign-wcode" label={`QR code to join the Wi-Fi network ${wifi.network}`} />
      <p><b>Join the Wi-Fi</b>Scan with your camera to connect to {wifi.network}</p>
    </div>
  ) : null;
  const mark = <p className="sign-mark">DigiStayBook</p>;
  const img = (src: string, alt = "") => <img className="sign-ph" src={src} alt={alt} loading={thumb ? "lazy" : "eager"} />;

  let body: ReactNode;
  switch (style.id) {
    case "coastal":
      body = <>{lead}{nameEl}{code}{inv}{addr}{wifiEl}<Waves />{mark}</>;
      break;
    case "farmhouse":
      body = <>{lead}{nameEl}<p className="sign-orn">— ✦ —</p>{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "modern":
      body = <><i className="dot" />{lead}{nameEl}<hr /><div className="row">{code}<div>{inv}{addr}</div></div>{wifiEl}{mark}</>;
      break;
    case "boho-arch":
      body = <><div className="arch">{lead}{nameEl}{code}{inv}</div>{addr}{wifiEl}{mark}<i className="sun s1" /><i className="sun s2" /></>;
      break;
    case "botanical":
      body = <><Crest /><Corner side="l" /><Corner side="r" />{lead}{nameEl}{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "cabin":
      body = <><Peaks />{lead}{nameEl}{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "mid-century":
      body = <><i className="c1" /><i className="c2" /><i className="c3" />{lead}{nameEl}{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "letterpress":
      body = <><div className="frame"><span>◆</span><span>◆</span><span>◆</span><span>◆</span></div>{lead}{nameEl}<p className="sign-orn">❦</p>{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "desert-sun":
      body = <>{lead}{nameEl}<DesertScene />{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "color-block":
      body = <><div className="top">{lead}{nameEl}</div>{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "chalkboard":
      body = <>{lead}{nameEl}<ChalkArrow />{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "postcard":
      body = <><div className="stamp"><b>SCAN</b><small>&amp; STAY</small></div>{lead}{nameEl}{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "photo-header":
      body = <><div className="hero">{img(photo, style.photo?.alt)}<div className="over">{lead}{nameEl}</div></div>{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "polaroid":
      body = <><div className="pola">{img(photo, style.photo?.alt)}{nameEl}</div>{code}{inv}{addr}{wifiEl}{mark}</>;
      break;
    case "coast-photo":
      body = <>{img(photo, style.photo?.alt)}<div className="panel">{lead}{nameEl}{code}{inv}{addr}{wifiEl}{mark}</div></>;
      break;
    case "sunset-photo":
      body = <>{img(photo, style.photo?.alt)}{lead}{nameEl}{code}{inv}<div className="foot">{addr}{wifiEl}</div>{mark}</>;
      break;
    case "collage":
      body = <><div className="grid4">{img(photo, style.photo?.alt)}{img(extras[0]!)}{img(extras[1]!)}</div>{lead}{nameEl}<div className="row">{code}<div className="side">{inv}{addr}</div></div>{wifiEl}{mark}</>;
      break;
    case "arch-photo":
      body = <><div className="archph">{img(photo, style.photo?.alt)}</div>{lead}{nameEl}<div className="row">{code}<div className="side">{inv}{addr}{wifiEl}</div></div>{mark}</>;
      break;
    default:
      body = null;
  }

  return <div className={`sign sign-${style.id}`}>{body}</div>;
}

/** Dark modules on white with the quiet zone, the same drawing as the product's placard. */
function Code({ data, className, label }: { data: string; className: string; label: string }) {
  const matrix = useMemo(() => qrMatrix(data), [data]);
  const side = qrCanvasSize(matrix);
  return (
    <svg className={className} viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={side} height={side} fill="#ffffff" />
      <path d={qrPath(matrix)} fill="#14181b" />
    </svg>
  );
}

function Waves() {
  return (
    <svg className="waves" viewBox="0 0 500 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 30 Q 62 8 125 30 T 250 30 T 375 30 T 500 30 V90 H0Z" fill="#b9d3de" />
      <path d="M0 50 Q 62 30 125 50 T 250 50 T 375 50 T 500 50 V90 H0Z" fill="#8db7c9" />
      <path d="M0 68 Q 62 52 125 68 T 250 68 T 375 68 T 500 68 V90 H0Z" fill="#5f93ad" />
    </svg>
  );
}

function Peaks() {
  const pines = [[40, 44], [70, 56], [420, 44], [455, 56], [480, 44]] as const;
  return (
    <svg className="peaks" viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 150 L90 60 L150 110 L250 20 L340 100 L410 50 L500 120 V150Z" fill="#2f5546" />
      <path d="M250 20 L272 40 L258 44 L246 36 L232 38Z" fill="#f3ead8" />
      <path d="M0 150 L60 110 L130 140 L200 95 L300 150Z M260 150 L380 90 L500 150Z" fill="#3f6b57" />
      {pines.map(([x, h]) => <path key={x} d={`M${x} 150 l14 -${h} l14 ${h}z`} fill="#163126" />)}
    </svg>
  );
}

function DesertScene() {
  return (
    <svg className="scene" viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="250" cy="105" r="62" fill="#eba06f" />
      <path d="M0 110 Q 120 70 250 105 T 500 95 V150 H0Z" fill="#d9774a" />
      <path d="M0 130 Q 150 100 300 128 T 500 120 V150 H0Z" fill="#b8553a" />
      <rect y="142" width="500" height="8" fill="#8e3d2c" />
    </svg>
  );
}

function ChalkArrow() {
  return (
    <svg className="arrow" viewBox="0 0 80 60" aria-hidden="true">
      <path d="M6 8 C 30 4, 58 14, 64 46 M52 36 l12 12 l8 -16" fill="none" stroke="#f1efe8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Crest() {
  return (
    <svg className="crest" viewBox="-250 -120 500 130" aria-hidden="true">
      <g transform="rotate(-14)"><Sprig len={210} bow={34} count={10} /></g>
      <g transform="scale(-1 1) rotate(-14)"><Sprig len={210} bow={34} count={10} /></g>
      <circle r="5" fill="#46664f" />
    </svg>
  );
}

function Corner({ side }: { side: "l" | "r" }) {
  return (
    <svg className={`corner ${side}`} viewBox="-10 -110 240 120" aria-hidden="true">
      <g transform="rotate(-12)"><Sprig len={200} bow={30} count={9} dark="#6f9478" light="#9dbba5" /></g>
    </svg>
  );
}

/**
 * A sprig: a stem from (0,0) to (len,0) bowing up by `bow`, with pointed
 * leaves alternating sides and shrinking toward the tip.
 */
function Sprig({ len, bow, count, dark = "#4f7a5c", light = "#7fa58a", stem = "#46664f" }: { len: number; bow: number; count: number; dark?: string; light?: string; stem?: string }) {
  const at = (t: number) => ({ x: 2 * (1 - t) * t * (len / 2) + t * t * len, y: 2 * (1 - t) * t * -bow });
  const angle = (t: number) => (Math.atan2(2 * (1 - t) * -bow + 2 * t * bow, len) * 180) / Math.PI;
  const leaf = (l: number, w: number) => `M0 0 C ${l * 0.25} ${-w}, ${l * 0.7} ${-w * 0.9}, ${l} 0 C ${l * 0.7} ${w * 0.9}, ${l * 0.25} ${w}, 0 0Z`;
  const end = at(1);
  return (
    <>
      <path d={`M0 0 Q ${len / 2} ${-bow} ${len} 0`} fill="none" stroke={stem} strokeWidth="2.6" strokeLinecap="round" />
      {Array.from({ length: count }, (_, i) => {
        const t = 0.1 + i * (0.84 / (count - 1));
        const p = at(t);
        const l = 58 * (1 - 0.5 * t);
        const a = angle(t) + (i % 2 ? 1 : -1) * (48 - 14 * t);
        return (
          <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`}>
            <path d={leaf(l, l * 0.3)} fill={i % 3 === 1 ? light : dark} />
            <path d={`M2 0 L${(l * 0.82).toFixed(1)} 0`} stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
          </g>
        );
      })}
      <g transform={`translate(${end.x} ${end.y}) rotate(${angle(1).toFixed(1)})`}><path d={leaf(34, 10)} fill={dark} /></g>
    </>
  );
}
