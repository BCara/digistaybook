export function LegalDraftPage({ kind }: { kind: "terms" | "privacy" }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Draft legal copy</p>
      <h1>{kind === "terms" ? "Terms and Conditions" : "Privacy Policy"}</h1>
      <div className="notice">
        <strong>Not approved for publication.</strong>
        <p>The authoritative draft remains in the BOP and requires professional legal review before production use.</p>
      </div>
      <div className="actions">
        <a className="btn btn-secondary" href="/">Back to home</a>
        <a className="btn btn-ghost" href="/privacy-safety">Privacy &amp; Safety requests</a>
      </div>
    </div>
  );
}
