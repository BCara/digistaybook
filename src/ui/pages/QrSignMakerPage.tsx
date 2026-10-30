import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trialDays } from "../../domain/pricing";
import { DEMO_SIGN_LINK, defaultSignStyle, signLink, signStyleFor, signStyles, type SignStyle } from "../../domain/signStyles";
import { QrSign, type QrSignContent } from "../signs/QrSign";
import "./qrSignMaker.css";

const defaultMessage = "Scan to read the house guidance and to leave a memory behind.";

/**
 * The free QR sign maker: anyone can put a link and their Wi-Fi on a printed
 * 5 x 7 card, in any of the eighteen styles, without an account.
 *
 * It is an acquisition page. A host who prints a sign here has already done
 * the hard half of a DigiStayBook welcome (the card on the counter), so the
 * page says plainly what the code could open instead of a bare link, and
 * starts the code on the demo wall so that is the first thing they scan.
 *
 * Nothing typed here leaves the browser. The codes are drawn on the page, a
 * photo is read from the visitor's own disk into an object URL, and printing
 * is the browser's own dialog: no Wi-Fi password, link or photo is uploaded.
 *
 * `?style=<id>` opens on a style, which is how Pins and shared links land on
 * the look they showed.
 */
export function QrSignMakerPage() {
  // The page is prerendered on the first style, so the client starts there
  // too and moves to the linked style before the first paint. Reading the
  // address during render would draw a different sign from the static HTML
  // and make React throw that HTML away.
  const [style, setStyle] = useState<SignStyle>(defaultSignStyle);
  useLayoutEffect(() => setStyle(signStyleFor(readStyleParam())), []);
  const [name, setName] = useState("Seabreeze Cottage");
  const [linkInput, setLinkInput] = useState(DEMO_SIGN_LINK);
  const [message, setMessage] = useState(defaultMessage);
  const [network, setNetwork] = useState("SEABREEZE-5G");
  const [password, setPassword] = useState("sandcastle42");
  const [photo, setPhoto] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const checkedLink = signLink(linkInput);
  // The card keeps the last good address while someone is mid-way through
  // typing a new one, rather than flashing to an empty square.
  const [link, setLink] = useState(DEMO_SIGN_LINK);
  useEffect(() => {
    if (checkedLink) setLink(checkedLink);
  }, [checkedLink]);

  // An object URL holds the file in memory until it is revoked.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  const chooseStyle = (next: SignStyle) => {
    setStyle(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", next.id);
    window.history.replaceState(window.history.state, "", url.href);
  };

  const content: QrSignContent = {
    name: name.trim() || "Your place",
    link,
    message: message.trim(),
    wifi: network.trim() ? { network: network.trim(), password } : null,
    photo
  };

  const print = () => {
    // The print copy is mounted only for the dialog, so the page itself never
    // carries a second full-size sign with its photographs.
    setPrinting(true);
  };
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    // Give the print copy's photo a frame to decode before the dialog opens.
    const timer = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  return (
    <div className="page qr-sign-maker">
      <section className="section-head sign-maker-head" aria-labelledby="sign-maker-heading">
        <p className="eyebrow">Free tool</p>
        <h1 id="sign-maker-heading">QR welcome sign maker</h1>
        <p className="lede">
          Make a printable 5 × 7 sign for your vacation rental: your place's name, a QR code for your guest guide and a
          second code that joins your Wi-Fi. Pick from {signStyles.length} styles. Free, no account needed.
        </p>
      </section>

      <div className="sign-maker-layout">
        <div className="sign-maker-preview">
          <ScaledSign style={style} content={content} />
          <div className="sign-maker-print">
            <button type="button" className="btn btn-primary" onClick={print}>Print or save as PDF</button>
            <p className="field-hint">Prints at 5 × 7 in. Choose "Actual size" or 100% in the print dialog.</p>
          </div>
        </div>

        <form className="sign-maker-form" onSubmit={event => event.preventDefault()}>
          <fieldset>
            <legend>Style</legend>
            <div className="sign-style-grid">
              {signStyles.map(option => (
                <button key={option.id} type="button" className="sign-style-option" aria-pressed={option.id === style.id}
                  onClick={() => chooseStyle(option)} title={option.note}>
                  <span className="sign-style-thumb" aria-hidden="true"><QrSign style={option} content={content} thumb /></span>
                  <span className="sign-style-name">{option.name}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Your sign</legend>
            <label htmlFor="sign-name">Name of your place</label>
            <input id="sign-name" value={name} maxLength={40} onChange={event => setName(event.target.value)} />

            <label htmlFor="sign-link">Link the code opens</label>
            <input id="sign-link" type="url" inputMode="url" value={linkInput} aria-invalid={!checkedLink}
              aria-describedby="sign-link-hint" onChange={event => setLinkInput(event.target.value)} />
            <p id="sign-link-hint" className={checkedLink ? "field-hint" : "field-hint sign-maker-error"}>
              {!checkedLink
                ? "Enter a web address, like yourplace.com/guide."
                : link === DEMO_SIGN_LINK
                  ? "This opens our demo guest wall. Paste the link to your own guest guide."
                  : "Scan it with your phone before you print."}
            </p>

            <label htmlFor="sign-message">Line under the code</label>
            <input id="sign-message" value={message} maxLength={90} onChange={event => setMessage(event.target.value)} />

            {style.photo && (
              <div className="sign-photo-field">
                <label htmlFor="sign-photo">Photo</label>
                <input id="sign-photo" type="file" accept="image/*" onChange={event => {
                  const file = event.target.files?.[0];
                  setPhoto(file ? URL.createObjectURL(file) : null);
                }} />
                <p className="field-hint">
                  Use a photo of your place, at least 1500 pixels wide for a sharp print. It stays on your device.
                  {photo && <> <button type="button" className="link-button" onClick={() => setPhoto(null)}>Use the sample photo</button></>}
                </p>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Wi-Fi code <span className="label-optional">Optional</span></legend>
            <label htmlFor="sign-network">Network name</label>
            <input id="sign-network" value={network} maxLength={32} autoComplete="off" onChange={event => setNetwork(event.target.value)} />
            <label htmlFor="sign-password">Password</label>
            <input id="sign-password" value={password} maxLength={63} autoComplete="off" spellCheck={false} onChange={event => setPassword(event.target.value)} />
            <p className="field-hint">Guests scan it to join without typing. Leave the network blank for no Wi-Fi code. Nothing you type here is sent to us.</p>
          </fieldset>
        </form>
      </div>

      <section className="sign-maker-pitch" aria-labelledby="sign-maker-pitch-heading">
        <h2 id="sign-maker-pitch-heading">Give the code something worth opening</h2>
        <p>
          With DigiStayBook, the code on your sign opens your own guest wall: the Wi-Fi password guests can copy in one tap,
          trash day, checkout and your local favorites, plus a guestbook where guests leave photos and notes for the next
          guest. No app, no guest accounts. Change something once and every guest sees it, so the sign never needs reprinting.
        </p>
        <div className="actions">
          <a className="btn btn-primary" href="/host/sign-up">Start your {trialDays}-day free trial</a>
          <a className="btn btn-secondary" href="/stay/demo-cottage">See what guests see</a>
        </div>
      </section>

      {printing && createPortal(<div className="sign-print-root"><QrSign style={style} content={content} /></div>, document.body)}
    </div>
  );
}

function readStyleParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("style");
}

/** The 500 x 700 card, scaled down to whatever width the column has. */
function ScaledSign({ style, content }: { style: SignStyle; content: QrSignContent }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry?.contentRect.width ?? 500) / 500)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="sign-stage" ref={frame}>
      <div className="sign-stage-card" style={{ zoom: scale }}>
        <QrSign style={style} content={content} />
      </div>
    </div>
  );
}
