window.MRANTI_AI_BRAIN_CONFIG = {
  apiBaseUrl: "https://mrantidata.app.n8n.cloud/webhook",

  endpoints: {
    search: "mranti-ai-brain-search",
    document: "mranti-ai-brain-document",
    query: "mranti-ai-brain-query",
    workspaceFile: "mranti-ai-brain-workspace-file",
    presentation: "mranti-ai-brain-presentation",
    validationStart: "mranti-ai-brain-validation-start",
    revisionApply: "mranti-ai-brain-revision-apply",
    exportToDrive: "mranti-ai-brain-export",
    health: "mranti-ai-brain-health"
  },

  auth: {
    allowedDomain: "mranti.my",
    readScopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/presentations.readonly",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.readonly"
    ],
    onDemandScopes: {
      slidesWrite: ["https://www.googleapis.com/auth/presentations"],
      driveWrite: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/documents"
      ]
    },

    firebase: {
      apiKey: "AIzaSyDXz0gL67r9BafTg8nL6VdHYdw1tfcxhto",
      authDomain: "mranticrm.firebaseapp.com",
      projectId: "mranticrm",
      storageBucket: "mranticrm.firebasestorage.app",
      messagingSenderId: "314966643466",
      appId: "1:314966643466:web:aff9ad95262d1df8f960f3"
    }
  },

  productionMode: true,
  allowMockData: false,
  requestTimeoutMs: 180000,
  validationTimeoutMs: 900000,
  maxRecentConversations: 12
};
