import { useState } from "react";

/** A copyable string with the button that copies it. */
export function Copyable({
  label,
  value,
  action,
  multiline,
  href
}: {
  label: string;
  value: string;
  action: string;
  multiline?: boolean;
  /** Given for an address a Host can also just open: the value becomes the link. */
  href?: string;
}) {
  // "Copied" rather than a permanently green button: the message is about the
  // click that just happened, and it goes when another one is made.
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      // A browser that refuses the clipboard — an insecure origin, a denied
      // permission — must not be told it worked. The text is on the page and
      // selectable, so say that instead.
      setState("failed");
    }
  }

  return (
    <div className="wall-copy">
      <p className="wall-copy-label">{label}</p>
      <div className="wall-copy-row">
        {multiline ? (
          <pre className="wall-copy-value"><code>{value}</code></pre>
        ) : href ? (
          // An address a Host is about to hand out is one they will want to
          // look at first, and copying it into a new tab to do that is a
          // errand the page can spare them. It opens in its own tab so the
          // wall they were writing is still here when they come back.
          <code className="wall-copy-value">
            <a href={href} target="_blank" rel="noreferrer">{value}</a>
          </code>
        ) : (
          <code className="wall-copy-value">{value}</code>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
          {action}
        </button>
        {/* Copying an address and pasting it into a new tab to see what a
            guest sees is three steps for one look. This is the look. */}
        {href && (
          <a className="btn btn-secondary btn-sm" href={href} target="_blank" rel="noreferrer">
            Open page
          </a>
        )}
      </div>
      {state !== "idle" && (
        <p className={state === "copied" ? "wall-copy-said" : "wall-copy-said failed"} role="status">
          {state === "copied" ? "Copied." : "Your browser would not let us copy it. Select the text above instead."}
        </p>
      )}
    </div>
  );
}
