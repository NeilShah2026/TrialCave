/** Human labels for clinic-side statuses. Client-safe. */
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  submitted: "New",
  under_review: "Under review",
  contacted: "Contacted",
  not_a_fit: "Not a fit",
  withdrawn: "Withdrawn by participant",
};

export const INVITATION_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for a response",
  approved: "Approved",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Stopped sharing",
};

export const STUDY_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  paused: "Paused",
  closed: "Closed",
};
