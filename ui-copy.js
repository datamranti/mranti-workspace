export const APP_COPY = Object.freeze({
  trustMessage: "Your access follows your MRANTI Google Workspace permissions.",
  workspaceName: "Strategy Division",
  workspaceSubtitle: "MRANTI Workspace"
});

export const SUGGESTED_PROMPTS = Object.freeze([
  { id: "emails", icon: "gmail", label: "Summarise my unread emails", prompt: "Summarise my unread emails and identify anything that needs my attention." },
  { id: "calendar", icon: "calendar", label: "What is on my calendar today?", prompt: "What is on my calendar today? Summarise the meetings and help me prepare." },
  { id: "latest-deck", icon: "drive", label: "Find the latest True North deck", prompt: "Find the latest True North deck in my authorised Workspace files." },
  { id: "meeting", icon: "sheets", label: "Help me prepare for a meeting", prompt: "Help me prepare for my next meeting using my authorised Workspace context." }
]);

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
