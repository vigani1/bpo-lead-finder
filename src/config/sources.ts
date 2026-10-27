/** Kinds of discovery query, one per kind of source we look for. */
export type QueryFamily = "company" | "company_profile" | "hiring" | "vendor" | "social" | "employer_lookup";

export const SOURCE_IDS = ["tavily", "exa", "fixture"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export interface SourcePolicy {
  label: string;
  /** Which kinds of query this source is asked. */
  families: QueryFamily[];
  /**
   * `storable`: results may be saved as evidence.
   * `transient`: results are only used to discover company websites during the
   * search; nothing from them is saved. Only what we read ourselves from the
   * company's own site is stored.
   */
  storage: "storable" | "transient";
  /** Why, in one line (shown in docs and reviewed against the provider's terms). */
  termsNote: string;
}

export const SOURCE_POLICIES: Record<SourceId, SourcePolicy> = {
  tavily: {
    label: "Tavily",
    families: ["company", "hiring", "social", "vendor", "employer_lookup"],
    storage: "storable",
    termsNote: "Terms allow use for internal business purposes and don't restrict storing results.",
  },
  exa: {
    label: "Exa",
    // Exa's own index is strongest at company websites, and only websites survive a transient source.
    families: ["company", "company_profile", "employer_lookup"],
    storage: "transient",
    termsNote:
      "Terms (4.2a) forbid copying information obtained through the service except temporary caching, so results are used for discovery only.",
  },
  fixture: {
    label: "Recorded sample results",
    families: ["company", "hiring", "social", "vendor"],
    storage: "storable",
    termsNote: "Offline sample data reconstructed from the feasibility check.",
  },
};
