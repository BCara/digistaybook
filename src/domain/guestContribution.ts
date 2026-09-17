import { z } from "zod";

export const guestContributionSchema = z.object({
  propertyId: z.string().min(1).max(128),
  sessionId: z.string().min(16).max(128),
  message: z.string().trim().min(1).max(1200),
  displayName: z.string().trim().max(80).optional(),
  consent: z.object({
    accepted: z.literal(true),
    wordingVersion: z.string().min(1).max(40),
    acceptedAt: z.string().datetime()
  })
});

export type GuestContributionInput = z.infer<typeof guestContributionSchema>;

/**
 * Where a post stands. The first, third and fourth are the reporting state
 * model's own names (BOP 3.6); `hidden_by_host` is the ordinary curation the
 * plan gives Hosts alongside it ("hide or delete unwanted posts", BOP 1.4) and
 * is deliberately a separate state from `hidden_pending_review`: nothing is
 * pending on a post a Host has simply decided against, and it must not sit in
 * a review queue or start a privacy clock. Only `visible` reaches a guest.
 */
export type GuestPost = {
  id: string;
  message: string;
  displayName?: string;
  createdAt: string;
  visibility: "visible" | "hidden_pending_review" | "hidden_by_host" | "restricted" | "deleted";
  pinned: boolean;
};
