export const APP_COPY = Object.freeze({
  trustMessage: "Your access follows your MRANTI Google Workspace permissions.",
  workspaceName: "Strategy Division",
  workspaceSubtitle: "MRANTI Workspace"
});

export const VALIDATION_STEP_LABELS = Object.freeze([
  { id: "permission", label: "Presentation opened through Workspace permissions" },
  { id: "context", label: "Full presentation read for narrative context" },
  { id: "claims", label: "Factual claims identified on the selected slide" },
  { id: "internal", label: "Related MRANTI documents located" },
  { id: "external", label: "Government and institutional sources reviewed" },
  { id: "comparison", label: "Internal and external evidence compared" },
  { id: "report", label: "Validation report and recommended wording prepared" }
]);

export const VERDICT_LABELS = Object.freeze({
  verified: "Verified",
  "supported-with-qualification": "Supported with qualification",
  "mranti-proposed-target": "MRANTI proposed target",
  "requires-revision": "Requires revision",
  "unable-to-verify": "Unable to verify",
  contradicted: "Contradicted",
  outdated: "Outdated",
  "opinion-or-recommendation": "Opinion or recommendation"
});
