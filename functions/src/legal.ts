// Handbook C-19, A.6, A.7 and GC-03. Every guest-facing legal text has a
// version, and guest intake stays shut until qualified counsel has approved
// exactly these versions. The approval is recorded here, in code, so it ships
// with the text it approves and no environment variable can open intake
// against unapproved wording.

export const legalVersions = {
  hostTerms: "draft-2026-08-04",
  guestTerms: "draft-2026-10-06",
  privacy: "draft-2026-10-06",
  consent: "handbook-5.3-draft-v4"
} as const;

export type LegalApproval = {
  /** ISO date counsel approved the texts. */
  reviewedOn: string;
  /** Who gave the approval: the reviewing firm or counsel, as recorded at launch. */
  reviewedBy: string;
  /** The versions approved; intake opens only while these match legalVersions. */
  versions: typeof legalVersions;
};

// null until counsel approves. Recording it means: change every draft version
// above to its approved version, remove "draft" from the texts, and fill this in.
export const legalApproval: LegalApproval | null = null;

export function legalApproved(approval: LegalApproval | null = legalApproval) {
  if (!approval || !/^\d{4}-\d{2}-\d{2}$/.test(approval.reviewedOn) || !approval.reviewedBy.trim()) return false;
  return (Object.keys(legalVersions) as (keyof typeof legalVersions)[]).every(key => approval.versions[key] === legalVersions[key]);
}

// The sentence a guest ticks before a memory is published. It names the
// message and the photos, because a text-only memory has no image to consent to.
export const consentWording = "I agree to the Guest Terms and Privacy Policy, understand that photos undergo automated safety checks, consent to my message and any photos being displayed publicly on this property’s guestbook, and confirm I am 16 or older.";
