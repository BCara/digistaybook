import { wallUnavailableReason } from "../../domain/wallAvailability";

export type Unavailable = { status: "unavailable"; owner?: { propertyId: string; lifecycle: string; mode: string; publicWallOff: boolean } };

export function UnavailableWall({ result, view }: { result: Unavailable; view: "stay" | "public" }) {
  const owner = result.owner;
  const reason = owner ? wallUnavailableReason(owner, view) : null;
  const base = owner ? `/host/property/${encodeURIComponent(owner.propertyId)}` : "";
  return <section className="unavailable-wall" aria-labelledby="unavailable-wall-title">
    <p className="eyebrow">DigiStayBook</p>
    <h1 id="unavailable-wall-title">{reason?.title ?? "This guestbook isn’t open to visitors"}</h1>
    <p className="lede">{reason?.message ?? "The host hasn’t published this wall, has paused access, or the link is no longer valid."}</p>
    {owner && reason ? <>
      <p>You’re signed in as this property’s owner.</p>
      <div className="actions">
        <a className="btn btn-primary" href={`${base}/${reason.section}`}>{reason.action}</a>
        <a className="btn btn-secondary" href={`${base}${view === "public" ? "/public" : ""}`}>Edit this wall</a>
      </div>
    </> : <>
      {/* A guest is holding a placard or a link that led nowhere. Nothing here
          is their fault and nothing here is theirs to fix, so the page says
          what to do next instead of what went wrong. */}
      <p>{view === "stay"
        ? "Nothing is wrong with your booking. The QR code you scanned points at a guestbook the host has not opened yet."
        : "This link is not showing a wall at the moment. The host may not have published it yet, or may have switched it off."}</p>
      <p>For arrival instructions or help with your stay, contact your host through your booking app.</p>
      <a className="text-link" href="/host">Own this property? Open your host dashboard</a>
    </>}
  </section>;
}
