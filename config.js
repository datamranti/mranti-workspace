window.MRANTI_AI_BRAIN_CONFIG = {
  // Example: "https://n8n.example.com/webhook"
  apiBaseUrl: "",

  endpoints: {
    search: "mranti-ai-brain-search",
    document: "mranti-ai-brain-document",
    health: "mranti-ai-brain-health"
  },

  // Change to false after configuring the live n8n URL.
  demoMode: true,

  requestTimeoutMs: 90000
};
