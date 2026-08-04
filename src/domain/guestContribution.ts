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

export type GuestPost = {
  id: string;
  message: string;
  displayName?: string;
  createdAt: string;
  visibility: "visible" | "hidden_pending_review" | "restricted" | "deleted";
  pinned: boolean;
};
