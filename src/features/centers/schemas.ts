import { z } from "zod";

/** A reviewer's vote on one center (POST /api/centers/[id]/feedback). */
export const feedbackSchema = z.object({
  verdict: z.enum(["fit", "not_fit"]),
  reason: z.enum(["wrong_type", "wrong_country", "wrong_campaign", "dead", "duplicate", "other"]).optional(),
  searchId: z.uuid().optional(),
});
