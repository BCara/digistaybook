import { FieldValue, getFirestore, type DocumentData, type Transaction } from "firebase-admin/firestore";

/* =========================================================================
   Host deletions are retained, not purged.

   When a Host deletes a memory it leaves the wall and the Host's views exactly
   as before, but nothing is destroyed: the full post, the linked guest
   submission and any private feedback are copied here, and the photographs
   stay where they are in Storage. A Host who deleted something by mistake can
   ask us to return it, and Operations restores it from this record.

   No deletion job is queued for these, so nothing is removed after 72 hours.
   Automatic purging may be added later; until then a record stays `retained`.

   Guest self-deletion and Trust & Safety deletions do not come through here:
   those remain real deletions.

   Firestore rules deny every client read and write of this collection.
   ========================================================================= */

export const DELETED_CONTENT_ARCHIVE = "deletedContentArchive";

/** A marker on the tombstoned post so consent review keeps its evidence while the content is held. */
export const ARCHIVE_RETENTION_HOLD = "deleted_content_archive";

export function archiveRef(propertyId: string, postId: string) {
  return getFirestore().collection(DELETED_CONTENT_ARCHIVE).doc(`${propertyId}:${postId}`);
}

export function archiveDeletedPost(tx: Transaction, input: {
  propertyId: string;
  postId: string;
  source: "host_delete" | "host_report_delete";
  deletedBy: string;
  post: DocumentData;
  guestSubmissionId?: string | null;
  guestSubmission?: DocumentData | null;
  privateFeedback?: DocumentData | null;
  reportId?: string;
}) {
  tx.set(archiveRef(input.propertyId, input.postId), {
    propertyId: input.propertyId,
    postId: input.postId,
    source: input.source,
    deletedBy: input.deletedBy,
    deletedAt: FieldValue.serverTimestamp(),
    reportId: input.reportId ?? null,
    status: "retained",
    // The documents as they stood immediately before deletion; restoring is
    // writing these back and returning the post to `hidden_by_host`.
    post: input.post,
    guestSubmissionId: input.guestSubmissionId ?? null,
    guestSubmission: input.guestSubmission ?? null,
    privateFeedback: input.privateFeedback ?? null
  });
}
