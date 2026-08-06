window.MRANTI_AI_BRAIN_CONFIG = {
  apiBaseUrl: "https://mrantidata.app.n8n.cloud/webhook",

  endpoints: {
    search: "mranti-ai-brain-search",
    document: "mranti-ai-brain-document",
    health: "mranti-ai-brain-health"
  },

  auth: {
    allowedDomain: "mranti.my",
    driveScope: "https://www.googleapis.com/auth/drive.readonly",

    firebase: {
      apiKey: "AIzaSyDXz0gL67r9BafTg8nL6VdHYdw1tfcxhto",
      authDomain: "mranticrm.firebaseapp.com",
      projectId: "mranticrm",
      storageBucket: "mranticrm.firebasestorage.app",
      messagingSenderId: "314966643466",
      appId: "1:314966643466:web:aff9ad95262d1df8f960f3"
    }
  },

  demoMode: false,
  requestTimeoutMs: 90000
};
