/* ------------------------------- Wi-Fi line -------------------------------
   The Wi-Fi essential is one line of free text, written the way a Host would
   write it on a fridge note: "cottage-guest / seaside42", "Network: Seabreeze,
   password: sandcastle". A web page cannot join a network for a guest — no
   browser lets a site touch the phone's settings — so what the wall can do is
   put the password on the clipboard and name the network to pick, and what
   the placard can do is carry the standard Wi-Fi QR code a phone's camera
   offers to join.

   Both need the network and the password apart, and the line is read for
   them rather than asking a Host to fill in two more fields. A line that
   cannot be read with confidence reads as nothing: a wrong password on the
   clipboard, or a code that joins nothing, is worse than none.
   ----------------------------------------------------------------------- */

export type WifiLogin = {
  /** Null when the line gives a password without saying which network. */
  network: string | null;
  password: string;
};

const passwordLabel = /\b(?:password|passcode|pass|pwd|pw|key)\b\s*[:=]?\s*/i;
const networkLabel = /\b(?:network\s*name|network|ssid|name)\b\s*[:=]?\s*/i;
/** What sits between a network and a password: "a / b", "a | b", "a, b". */
const separator = /\s+[/|·]\s+|\n/;
const trailing = /[\s,;/|·-]+$/;

/** The network and password in a Host's Wi-Fi line, or null if unclear. */
export function readWifiLine(line: string): WifiLogin | null {
  const text = line.trim();
  if (!text) return null;

  const labelled = passwordLabel.exec(text);
  if (labelled) {
    const password = text.slice(labelled.index + labelled[0].length).trim();
    if (!password) return null;
    /* "Password on the router" is a sentence, not a password: without a
       colon to mark it, only a single word is taken as one. */
    if (!/[:=]/.test(labelled[0]) && /\s/.test(password)) return null;
    const before = text.slice(0, labelled.index);
    const named = networkLabel.exec(before);
    const network = (named ? before.slice(named.index + named[0].length) : before).replace(trailing, "").trim();
    return { network: network || null, password };
  }

  const parts = text.split(separator).map(part => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const network = parts[0].replace(networkLabel, "").trim();
  return network ? { network, password: parts[1] } : null;
}

/** Characters the Wi-Fi QR format reserves, escaped with a backslash. */
const escapeField = (value: string): string => value.replace(/([\\;,":])/g, "\\$1");

/**
 * The text of a Wi-Fi QR code (the format iOS and Android cameras both read).
 * WPA covers WPA2 and WPA3 on every phone that reads the format, and is what
 * a home router with a password is all but certainly running.
 */
export function wifiQrPayload({ network, password }: { network: string; password: string }): string {
  return `WIFI:T:WPA;S:${escapeField(network)};P:${escapeField(password)};;`;
}
