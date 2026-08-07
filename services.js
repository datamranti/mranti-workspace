const JSON_FIELDS = new Set(["attachments", "presentation", "claims", "report", "options"]);

export function parseGoogleWorkspaceUrl(rawValue) {
  const value = String(rawValue || "").trim();
  let url;
  try { url = new URL(value); } catch { return { supported: false, reason: "invalid-url" }; }

  const host = url.hostname.toLowerCase();
  if (!["docs.google.com", "drive.google.com"].includes(host)) {
    return { supported: false, reason: "unsupported-host" };
  }

  const path = url.pathname;
  const idMatch = path.match(/\/d\/([A-Za-z0-9_-]+)/) || path.match(/\/folders\/([A-Za-z0-9_-]+)/);
  const fileId = idMatch?.[1] || url.searchParams.get("id") || "";
  let type = "drive";
  if (path.includes("/presentation/")) type = "slides";
  else if (path.includes("/document/")) type = "docs";
  else if (path.includes("/spreadsheets/")) type = "sheets";
  else if (path.includes("/folders/")) type = "folder";

  return {
    supported: Boolean(fileId),
    type,
    fileId,
    url: value,
    reason: fileId ? "" : "missing-file-id"
  };
}

function endpointUrl(config, endpointName) {
  const base = String(config?.apiBaseUrl || "").replace(/\/+$/, "");
  const path = String(config?.endpoints?.[endpointName] || "").replace(/^\/+/, "");
  if (!base || !path) throw new Error(`The ${endpointName} service is not configured.`);
  return `${base}/${path}`;
}

function serialisePayload(payload) {
  const form = new URLSearchParams();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object" || JSON_FIELDS.has(key)) form.set(key, JSON.stringify(value));
    else form.set(key, String(value));
  });
  return form;
}

export async function callLiveEndpoint(endpointName, payload, authContext, config, options = {}) {
  const currentUser = authContext?.currentUser;
  const accessToken = options.googleAccessToken || authContext?.googleAccessToken;
  if (!currentUser) {
    const error = new Error("Your MRANTI session has expired. Reconnect to continue.");
    error.authError = true;
    error.code = "FIREBASE_SESSION_MISSING";
    throw error;
  }
  if (!accessToken) {
    const error = new Error("Google Workspace authorisation is required for this action.");
    error.authError = true;
    error.code = "GOOGLE_ACCESS_TOKEN_MISSING";
    throw error;
  }

  const timeoutMs = Number(options.timeoutMs || config?.requestTimeoutMs || 180000);

  async function executeRequest(idToken) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpointUrl(config, endpointName), {
        method: options.method || "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: serialisePayload({ ...payload, idToken, googleAccessToken: accessToken }),
        signal: controller.signal
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { success: false, message: text || "Invalid server response." }; }
      return { response, data };
    } finally {
      clearTimeout(timeout);
    }
  }

  function isFirebaseVerificationFailure(result) {
    const message = String(result?.data?.message || "").toLowerCase();
    const code = String(result?.data?.code || "").toUpperCase();
    return Boolean(
      result?.response?.status === 401 && (
        message.includes("mranti sign-in could not be verified") ||
        message.includes("firebase verification failed") ||
        message.includes("firebase") ||
        code.includes("FIREBASE")
      )
    );
  }

  let idToken;
  try {
    idToken = await currentUser.getIdToken(false);
  } catch {
    const error = new Error("Your secure MRANTI session could not be refreshed. Reconnect to continue.");
    error.authError = true;
    error.code = "FIREBASE_TOKEN_REFRESH_FAILED";
    throw error;
  }

  let result = await executeRequest(idToken);

  // Firebase ID tokens are short-lived. If the backend rejects the cached token,
  // force-refresh it once and retry the exact same request before interrupting the user.
  if (isFirebaseVerificationFailure(result) && options.retryAuth !== false) {
    try {
      const refreshedIdToken = await currentUser.getIdToken(true);
      result = await executeRequest(refreshedIdToken);
    } catch {
      const error = new Error("Your secure MRANTI session needs to be reconnected.");
      error.authError = true;
      error.code = "FIREBASE_TOKEN_REFRESH_FAILED";
      throw error;
    }
  }

  const { response, data } = result;
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.authError = Boolean(data.authError || [401, 403].includes(response.status));
    error.code = data.code || (isFirebaseVerificationFailure(result) ? "FIREBASE_SESSION_INVALID" : "REQUEST_FAILED");
    throw error;
  }
  return data;
}

export function resolveWorkspaceFile(parsedUrl, authContext, config) {
  if (!parsedUrl?.supported) throw new Error("This Google Workspace link could not be recognised.");
  return callLiveEndpoint("workspaceFile", {
    fileId: parsedUrl.fileId,
    requestedType: parsedUrl.type,
    originalUrl: parsedUrl.url
  }, authContext, config);
}

export function loadPresentation(fileId, authContext, config) {
  return callLiveEndpoint("presentation", { presentationId: fileId }, authContext, config, {
    timeoutMs: config?.validationTimeoutMs || 900000
  });
}

export function askAiBrain({ query, sourceScope, attachments = [], conversationId = "" }, authContext, config) {
  return callLiveEndpoint("query", {
    query,
    sourceScope,
    attachments,
    conversationId
  }, authContext, config, { timeoutMs: config?.validationTimeoutMs || 900000 });
}

export function startValidation({ jobId, conversationId, presentationId, selectedSlide, instruction }, authContext, config) {
  return callLiveEndpoint("validationStart", {
    jobId,
    conversationId,
    presentationId,
    selectedSlide,
    instruction
  }, authContext, config, { timeoutMs: 60000 });
}

export function applyRevision(payload, authContext, config, googleWriteAccessToken) {
  return callLiveEndpoint("revisionApply", { ...payload, confirmed: true }, authContext, config, {
    googleAccessToken: googleWriteAccessToken,
    timeoutMs: config?.validationTimeoutMs || 900000
  });
}

export function saveReportToDrive(payload, authContext, config, googleWriteAccessToken) {
  return callLiveEndpoint("exportToDrive", payload, authContext, config, {
    googleAccessToken: googleWriteAccessToken,
    timeoutMs: config?.validationTimeoutMs || 900000
  });
}

export async function acquireGoogleAccessToken({ firebaseAuth, currentUser, scopes, allowedDomain }) {
  if (!firebaseAuth || !currentUser) throw new Error("Sign in again before authorising this action.");
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  (scopes || []).forEach(scope => provider.addScope(scope));
  provider.setCustomParameters({
    hd: allowedDomain,
    include_granted_scopes: "true",
    prompt: "consent"
  });
  const result = await currentUser.reauthenticateWithPopup(provider);
  const credential = window.firebase.auth.GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || result?.credential?.accessToken || result?._tokenResponse?.oauthAccessToken || "";
  if (!token) throw new Error("Google did not return the required authorisation token.");
  return token;
}

function db() {
  if (!window.firebase?.firestore) throw new Error("Firestore is not available. Check the Firebase scripts and project configuration.");
  return window.firebase.firestore();
}

function userCollection(uid, collectionName) {
  return db().collection("users").doc(uid).collection(collectionName);
}

function cleanUndefined(value) {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, cleanUndefined(item)]));
  }
  return value;
}

export async function saveConversation(uid, conversation) {
  if (!uid) throw new Error("A signed-in user is required.");
  const id = String(conversation.id || userCollection(uid, "conversations").doc().id);
  const now = window.firebase.firestore.FieldValue.serverTimestamp();
  const payload = cleanUndefined({
    ...conversation,
    id,
    ownerUid: uid,
    updatedAt: now,
    createdAt: conversation.createdAt || now
  });
  await userCollection(uid, "conversations").doc(id).set(payload, { merge: true });
  return id;
}

export async function loadConversation(uid, conversationId) {
  const snapshot = await userCollection(uid, "conversations").doc(conversationId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeRecentConversations(uid, callback, onError, limit = 12) {
  return userCollection(uid, "conversations")
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .onSnapshot(snapshot => {
      callback(snapshot.docs.map(document => ({ id: document.id, ...document.data() })));
    }, onError);
}

export async function createValidationJob(uid, job) {
  const now = window.firebase.firestore.FieldValue.serverTimestamp();
  const payload = cleanUndefined({
    ...job,
    ownerUid: uid,
    status: "queued",
    progress: 0,
    currentStep: "permission",
    stepsJson: JSON.stringify(job.steps || []),
    createdAt: now,
    updatedAt: now
  });
  await userCollection(uid, "validationJobs").doc(job.id).set(payload);
}

export function subscribeValidationJob(uid, jobId, callback, onError) {
  return userCollection(uid, "validationJobs").doc(jobId).onSnapshot(snapshot => {
    if (!snapshot.exists) return;
    const data = snapshot.data();
    const parse = (value, fallback) => {
      if (!value) return fallback;
      try { return JSON.parse(value); } catch { return fallback; }
    };
    callback({
      id: snapshot.id,
      ...data,
      steps: parse(data.stepsJson, []),
      relatedContext: parse(data.relatedContextJson, []),
      presentation: parse(data.presentationJson, null),
      report: parse(data.reportJson, null)
    });
  }, onError);
}

export async function requestValidationCancellation(uid, jobId) {
  await userCollection(uid, "validationJobs").doc(jobId).set({
    cancelRequested: true,
    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function saveValidationConversation(uid, { conversationId, presentation, instruction, report, jobId }) {
  return saveConversation(uid, {
    id: conversationId,
    title: `${presentation?.name || "Presentation"} validation`,
    type: "validation",
    status: report ? "complete" : "progress",
    presentation,
    instruction,
    report: report || null,
    jobId
  });
}

export function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
