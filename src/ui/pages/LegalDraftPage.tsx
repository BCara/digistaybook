import { legalApproval, legalApproved } from "../../../functions/src/legal";
import { guestTerms, hostTerms, privacyPolicy, type LegalDocument } from "./legal/documents";

const documents: Record<"terms" | "guest-terms" | "privacy", LegalDocument> = { terms: hostTerms, "guest-terms": guestTerms, privacy: privacyPolicy };

export function LegalDraftPage({ kind }: { kind: "terms" | "guest-terms" | "privacy" }) {
  const document = documents[kind], approved = legalApproved();
  return (
    <div className="page narrow-page legal-page">
      <p className="eyebrow">Legal</p>
      <h1>{document.title}</h1>
      <p className="legal-version">Version {document.version} · last updated {document.lastUpdated}
        {approved && legalApproval ? ` · reviewed ${legalApproval.reviewedOn}` : ""}</p>
      {document.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {document.sections.map(section => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      </section>)}
      <div className="actions">
        <a className="btn btn-secondary" href="/">Back to home</a>
        <a className="btn btn-ghost" href="/privacy-safety">Privacy &amp; Safety requests</a>
      </div>
    </div>
  );
}
