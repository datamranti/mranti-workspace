import { APP_COPY, SUGGESTED_PROMPTS, VALIDATION_STEP_LABELS, VERDICT_LABELS } from "./ui-copy.js";
import {
  parseGoogleWorkspaceUrl,
  resolveWorkspaceFile,
  loadPresentation,
  askAiBrain,
  startValidation,
  applyRevision,
  saveReportToDrive,
  acquireGoogleAccessToken,
  saveConversation,
  loadConversation,
  subscribeRecentConversations,
  createValidationJob,
  subscribeValidationJob,
  requestValidationCancellation,
  saveValidationConversation,
  downloadTextFile
} from "./services.js";

const config = window.MRANTI_AI_BRAIN_CONFIG || {};
const authConfig = config.auth || {};
const allowedDomain = String(authConfig.allowedDomain || "mranti.my").toLowerCase();
const readScopes = Array.isArray(authConfig.readScopes) && authConfig.readScopes.length
  ? authConfig.readScopes
  : ["https://www.googleapis.com/auth/drive.readonly"];
const tokenStorageKey = "mranti_ai_brain_google_token";
const tokenMaxAgeMs = 50 * 60 * 1000;

let firebaseAuth = null;
let validationUnsubscribe = null;
let recentUnsubscribe = null;
let lastFocusedElement = null;

const state = {
  currentUser: null,
  googleAccessToken: null,
  route: { name: "home" },
  sourceScope: "both",
  attachments: [],
  composerDraft: "",
  selectedSlide: 1,
  presentation: null,
  validationJob: null,
  report: null,
  activeConversation: null,
  conversationMessages: [],
  recentConversations: [],
  selectedClaimId: "",
  expandedClaimIds: new Set(),
  inspectorOpen: true,
  sidebarCollapsed: sessionGet("mranti_ai_brain_sidebar_collapsed") === "true",
  loading: false,
  serviceHealth: "checking"
};

const elements = {
  loginError: document.querySelector("#login-error"),
  signInButton: document.querySelector("#sign-in-button"),
  signOutButton: document.querySelector("#sign-out-button"),
  workspaceLayout: document.querySelector("#workspace-layout"),
  workspaceMain: document.querySelector("#workspace-main"),
  viewRoot: document.querySelector("#view-root"),
  recentConversations: document.querySelector("#recent-conversations"),
  profileButton: document.querySelector("#profile-button"),
  profileMenu: document.querySelector("#profile-menu"),
  profilePhoto: document.querySelector("#profile-photo"),
  profileInitial: document.querySelector("#profile-initial"),
  menuUserName: document.querySelector("#menu-user-name"),
  menuUserEmail: document.querySelector("#menu-user-email"),
  mobileNavButton: document.querySelector("#mobile-nav-button"),
  sidebarOverlay: document.querySelector("#sidebar-overlay"),
  sidebarCollapse: document.querySelector("#sidebar-collapse"),
  newConversation: document.querySelector("#new-conversation-button"),
  modalRoot: document.querySelector("#modal-root"),
  toast: document.querySelector("#toast"),
  googleStatus: document.querySelector("#google-status"),
  brandHome: document.querySelector("#brand-home-button"),
  topNewConversation: document.querySelector("#new-conversation-top"),
  topNavOverlay: document.querySelector("#topnav-overlay"),
  topUserName: document.querySelector("#top-user-name"),
  topUserEmail: document.querySelector("#top-user-email"),
  conversationCount: document.querySelector("#conversation-count")
};

const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3V6Z"/>',
  message: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronDown: '<path d="m7 10 5 5 5-5"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  paperclip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-3-3L15 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  send: '<path d="m3 20 18-8L3 4l3 8-3 8Z"/><path d="M6 12h15"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 11.9-2"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 2.8 7.7 7 9.5 4.2-1.8 7-5 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'
};

function sessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
function sessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch { /* ignored */ } }
function sessionRemove(key) { try { sessionStorage.removeItem(key); } catch { /* ignored */ } }
function icon(name, size = 20, className = "icon-svg") { return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" width="${size}" height="${size}">${ICONS[name] || ""}</svg>`; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function safeJson(value, fallback = null) { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return fallback; } }
function uid() { return state.currentUser?.uid || ""; }
function authContext() { return { currentUser: state.currentUser, googleAccessToken: state.googleAccessToken }; }
function makeId(prefix = "item") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

function showToast(message, type = "info") {
  elements.toast.textContent = message;
  elements.toast.className = `toast show${type === "error" ? " error" : type === "success" ? " success" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.className = "toast"; }, 3800);
}

function showLoginError(message = "", isError = true) {
  elements.loginError.textContent = message;
  elements.loginError.classList.toggle("visible", Boolean(message));
  elements.loginError.classList.toggle("info", Boolean(message) && !isError);
}

function showLogin(message = "", isError = true) {
  document.body.classList.remove("authenticated", "auth-pending", "sidebar-open", "inspector-open");
  showLoginError(message, isError);
}

function saveAccessToken(token) {
  state.googleAccessToken = String(token || "").trim();
  if (state.googleAccessToken) sessionSet(tokenStorageKey, JSON.stringify({ token: state.googleAccessToken, savedAt: Date.now() }));
}

function loadSavedAccessToken() {
  try {
    const stored = JSON.parse(sessionGet(tokenStorageKey) || "null");
    if (!stored?.token || !stored?.savedAt || Date.now() - Number(stored.savedAt) > tokenMaxAgeMs) {
      sessionRemove(tokenStorageKey);
      return null;
    }
    return String(stored.token);
  } catch {
    sessionRemove(tokenStorageKey);
    return null;
  }
}

function clearSavedAccessToken() { state.googleAccessToken = null; sessionRemove(tokenStorageKey); }
function isAllowedUser(user) { return String(user?.email || "").toLowerCase().endsWith(`@${allowedDomain}`); }

function buildGoogleProvider(forceConsent = false) {
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  readScopes.forEach(scope => provider.addScope(scope));
  provider.setCustomParameters({ hd: allowedDomain, include_granted_scopes: "true", ...(forceConsent ? { prompt: "consent" } : {}) });
  return provider;
}

function accessTokenFromResult(result) {
  const credential = window.firebase.auth.GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken || result?.credential?.accessToken || result?._tokenResponse?.oauthAccessToken || "";
}

function userDisplay(user = state.currentUser) {
  const email = String(user?.email || "");
  const displayName = String(user?.displayName || "").trim();
  const full = displayName || email.split("@")[0] || "MRANTI User";
  const first = full.split(/\s+/)[0] || "MRANTI";
  return { full, first, initial: first.charAt(0).toUpperCase() || "M", email };
}

function setUserUi(user) {
  const profile = userDisplay(user);
  elements.menuUserName.textContent = profile.full;
  elements.menuUserEmail.textContent = profile.email || "Authorised MRANTI account";
  if (elements.topUserName) elements.topUserName.textContent = profile.full;
  if (elements.topUserEmail) elements.topUserEmail.textContent = profile.email || "Authorised MRANTI account";
  elements.profileInitial.textContent = profile.initial;
  if (user?.photoURL) {
    elements.profilePhoto.src = user.photoURL;
    elements.profilePhoto.alt = `${profile.full} profile photo`;
    elements.profilePhoto.classList.remove("hidden");
    elements.profileInitial.classList.add("hidden");
  } else {
    elements.profilePhoto.classList.add("hidden");
    elements.profileInitial.classList.remove("hidden");
  }
}

async function signIn() {
  showLoginError("");
  elements.signInButton.disabled = true;
  try {
    const provider = buildGoogleProvider(true);
    const result = firebaseAuth.currentUser
      ? await firebaseAuth.currentUser.reauthenticateWithPopup(provider)
      : await firebaseAuth.signInWithPopup(provider);
    if (!isAllowedUser(result.user)) {
      await firebaseAuth.signOut();
      throw new Error(`Access is limited to authorised @${allowedDomain} accounts.`);
    }
    const token = accessTokenFromResult(result);
    if (!token) throw new Error("Google did not return the required Workspace authorisation. Allow the requested read access and try again.");
    saveAccessToken(token);
    showWorkspace(result.user);
  } catch (error) {
    clearSavedAccessToken();
    const friendly = error?.code === "auth/popup-closed-by-user"
      ? "Sign-in was cancelled. Continue with Google when you are ready."
      : error?.code === "auth/popup-blocked"
        ? "Your browser blocked the Google sign-in window. Allow pop-ups and try again."
        : error.message || "Google sign-in failed. Please try again.";
    showLogin(friendly, error?.code !== "auth/popup-closed-by-user");
  } finally {
    elements.signInButton.disabled = false;
  }
}

async function signOut() {
  validationUnsubscribe?.();
  recentUnsubscribe?.();
  clearSavedAccessToken();
  try { await firebaseAuth?.signOut(); } catch { /* local sign-out still applies */ }
  showLogin("You have signed out securely.", false);
}

function showWorkspace(user) {
  state.currentUser = user;
  setUserUi(user);
  showLoginError("");
  document.body.classList.remove("auth-pending");
  document.body.classList.add("authenticated");
  initialiseApplicationShell();
  subscribeUserData();
  handleRoute();
  checkHealth();
}

function initialiseAuth() {
  if (!window.firebase || !authConfig.firebase?.apiKey) {
    showLoginError("Authentication is not configured. Check config.js.", true);
    return;
  }
  if (!window.firebase.apps.length) window.firebase.initializeApp(authConfig.firebase);
  firebaseAuth = window.firebase.auth();
  firebaseAuth.onAuthStateChanged(async user => {
    if (!user) {
      state.currentUser = null;
      clearSavedAccessToken();
      showLogin();
      return;
    }
    if (!isAllowedUser(user)) {
      await firebaseAuth.signOut();
      showLoginError(`Access is limited to authorised @${allowedDomain} accounts.`, true);
      return;
    }
    state.currentUser = user;
    state.googleAccessToken = loadSavedAccessToken();
    if (state.googleAccessToken) showWorkspace(user);
    else {
      showLogin("Continue with Google to authorise the Workspace services used by AI Brain.", false);
    }
  });
}

function subscribeUserData() {
  recentUnsubscribe?.();
  recentUnsubscribe = subscribeRecentConversations(uid(), conversations => {
    state.recentConversations = conversations;
    renderRecentConversations();
    updateNotificationPanel();
  }, error => {
    console.error(error);
    showToast("Recent conversations could not be loaded. Check Firestore configuration.", "error");
  }, Number(config.maxRecentConversations || 12));
}

async function checkHealth() {
  try {
    const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
    const path = String(config.endpoints?.health || "").replace(/^\/+/, "");
    const response = await fetch(`${base}/${path}`);
    const data = await response.json();
    state.serviceHealth = response.ok && data.success !== false ? "connected" : "attention";
  } catch {
    state.serviceHealth = "attention";
  }
  updateGoogleStatus();
}

function updateGoogleStatus() {
  if (!elements.googleStatus) return;
  elements.googleStatus.classList.toggle("needs-attention", state.serviceHealth !== "connected");
  const label = elements.googleStatus.querySelector("strong");
  if (label) label.textContent = state.serviceHealth === "connected" ? "Google Workspace" : "Connection needs attention";
}

function initialiseApplicationShell() {
  const mobileIcon = document.querySelector("#mobile-menu-icon");
  const sidebarPlus = document.querySelector("#plus-icon");
  const topPlus = document.querySelector("#top-plus-icon");
  const profileChevron = document.querySelector("#profile-chevron");
  if (mobileIcon) mobileIcon.innerHTML = icon("menu", 21);
  if (sidebarPlus) sidebarPlus.innerHTML = icon("plus", 18);
  if (topPlus) topPlus.innerHTML = icon("plus", 18);
  if (profileChevron) profileChevron.innerHTML = icon("chevronDown", 13);
  document.querySelectorAll("[data-icon]").forEach(node => { node.innerHTML = icon(node.dataset.icon, 18); });
  updateSidebarState();
}

function updateSidebarState() {
  elements.workspaceLayout.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  elements.sidebarCollapse.innerHTML = `${icon(state.sidebarCollapsed ? "chevronRight" : "chevronLeft", 17)}<span>${state.sidebarCollapsed ? "Expand" : "Collapse"}</span>`;
  elements.sidebarCollapse.setAttribute("aria-label", state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
}

function cleanConversationTitle(item) {
  const genericTitles = new Set(["ai brain response", "ai brain conversation", "workspace conversation", "calendar briefing", "email briefing"]);
  let title = String(item?.title || "").replace(/\s+/g, " ").trim();
  if (!title || genericTitles.has(title.toLowerCase())) {
    const firstUserMessage = Array.isArray(item?.messages) ? item.messages.find(message => message.role === "user")?.text : "";
    title = String(firstUserMessage || "Previous conversation").replace(/\s+/g, " ").trim();
  }
  return title.slice(0, 58);
}

function chooseConversationTitle(message, responseTitle) {
  const genericTitles = new Set(["ai brain response", "ai brain conversation", "workspace conversation"]);
  const candidate = String(responseTitle || "").replace(/\s+/g, " ").trim();
  const fallback = String(message || "AI Brain conversation").replace(/\s+/g, " ").trim();
  return (candidate && !genericTitles.has(candidate.toLowerCase()) ? candidate : fallback).slice(0, 72);
}

function renderRecentConversations() {
  if (elements.conversationCount) elements.conversationCount.textContent = String(Math.min(state.recentConversations.length, 99));
  if (!elements.recentConversations) return;
  if (!state.recentConversations.length) {
    elements.recentConversations.innerHTML = `<p class="recent-empty">Your saved conversations will appear here.</p>`;
    return;
  }
  const items = state.recentConversations.slice(0, 8);
  elements.recentConversations.innerHTML = items.map(item => {
    const title = cleanConversationTitle(item);
    const active = state.route.name === "conversation" && state.route.id === item.id;
    const meta = item.type === "validation" ? "Validation" : "Conversation";
    return `<button class="recent-item${active ? " active" : ""}" type="button" data-conversation-id="${escapeHtml(item.id)}" title="${escapeHtml(title)}" ${active ? 'aria-current="page"' : ""}>
      <span class="recent-icon">${icon("message", 14)}</span>
      <span class="recent-copy"><span class="recent-name">${escapeHtml(title)}</span><span class="recent-meta">${escapeHtml(meta)}</span></span>
    </button>`;
  }).join("");
  elements.recentConversations.querySelectorAll("[data-conversation-id]").forEach(button => {
    button.addEventListener("click", () => navigate({ name: "conversation", id: button.dataset.conversationId }));
  });
}

function updateNotificationPanel() {
  if (!elements.notificationMenu) return;
  const completed = state.recentConversations.filter(item => item.type === "validation" && item.status === "complete").slice(0, 3);
  elements.notificationMenu.innerHTML = `
    <div class="popover-head"><strong>Notifications</strong><small>AI Brain activity and Workspace updates</small></div>
    ${completed.length ? completed.map(item => `<button class="notification-item" type="button" data-notification-conversation="${escapeHtml(item.id)}">${escapeHtml(item.title)} is ready for review.</button>`).join("") : `<div class="notification-item">No new AI Brain notifications.</div>`}
    <div class="notification-item">Google Workspace connection is ${state.serviceHealth === "connected" ? "active" : "being checked"}.</div>`;
  elements.notificationMenu.querySelectorAll("[data-notification-conversation]").forEach(button => button.addEventListener("click", () => navigate({ name: "conversation", id: button.dataset.notificationConversation })));
}

function closePopovers() {
  elements.profileMenu?.classList.add("hidden");
  elements.profileButton?.setAttribute("aria-expanded", "false");
}

function togglePopover(button, menu) {
  const opening = menu.classList.contains("hidden");
  closePopovers();
  menu.classList.toggle("hidden", !opening);
  button.setAttribute("aria-expanded", String(opening));
}

function closeMobilePanels() {
  document.body.classList.remove("sidebar-open", "top-nav-open");
  elements.mobileNavButton?.setAttribute("aria-expanded", "false");
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts[0] === "workspace") return { name: "home" };
  if (parts[0] === "conversation" && parts[1]) return { name: "conversation", id: parts[1] };
  if (["conversations", "saved", "projects"].includes(parts[0])) return { name: parts[0] };
  return { name: "home" };
}

function navigate(route, replace = false) {
  let hash = "#workspace";
  if (route.name === "conversation") hash = `#conversation/${route.id}`;
  else if (route.name !== "home") hash = `#${route.name}`;
  state.route = route;
  if (location.hash === hash) renderRoute();
  else if (replace) { history.replaceState(null, "", hash); renderRoute(); }
  else location.hash = hash;
  closeMobilePanels();
}

function resetConversation() {
  validationUnsubscribe?.();
  validationUnsubscribe = null;
  state.attachments = [];
  state.presentation = null;
  state.validationJob = null;
  state.report = null;
  state.activeConversation = null;
  state.conversationMessages = [];
  state.composerDraft = "";
  state.selectedSlide = 1;
  state.selectedClaimId = "";
  state.expandedClaimIds = new Set();
  navigate({ name: "home" });
}

function setActiveNavigation() {
  document.querySelectorAll("[data-route]").forEach(button => {
    const route = button.dataset.route;
    const active = (state.route.name === "home" && route === "home")
      || (state.route.name === "conversation" && route === "conversations")
      || route === state.route.name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  renderRecentConversations();
}

function handleRoute() { state.route = parseRoute(); renderRoute(); }

async function renderRoute() {
  if (!document.body.classList.contains("authenticated")) return;
  closePopovers();
  setActiveNavigation();
  document.body.classList.toggle("inspector-open", Boolean(state.inspectorOpen && state.report));
  if (state.route.name === "home") renderHome();
  else if (state.route.name === "conversations") renderConversationLibrary();
  else if (state.route.name === "saved") renderEmptyLibrary("Saved work", "Saved AI Brain reports and approved outputs will appear here.");
  else if (state.route.name === "projects") renderEmptyLibrary("Projects", "Create projects to organise conversations, source files and approved outputs.");
  else if (state.route.name === "conversation") await loadAndRenderConversation(state.route.id);
  requestAnimationFrame(() => elements.workspaceMain.focus({ preventScroll: true }));
}

function renderHome() {
  const profile = userDisplay();
  elements.viewRoot.innerHTML = `
    <section class="home-view" aria-labelledby="home-heading">
      <div class="home-content">
        <img class="home-mark" src="mranti-workspace-mark.png" alt="" aria-hidden="true" />
        <h1 id="home-heading" class="home-heading">Good morning, ${escapeHtml(profile.first)}.<span>How can I help you today?</span></h1>
        <p class="home-subtitle">Ask anything. I can search across your Google Workspace, connect internal knowledge with trusted external sources, and help you move work forward.</p>
        ${renderComposer({ id: "home-composer", placeholder: "Ask AI Brain anything, or paste a Google Workspace link…", home: true })}
        <div class="trust-line">${icon("lock", 16)} <span>${escapeHtml(APP_COPY.trustMessage)}</span></div>
        <div class="prompt-grid" aria-label="Suggested prompts">
          ${SUGGESTED_PROMPTS.map(prompt => `<button class="prompt-card" type="button" data-prompt-id="${escapeHtml(prompt.id)}"><span class="prompt-icon ${escapeHtml(prompt.icon)}">${prompt.icon === "calendar" ? "31" : prompt.icon === "gmail" ? "M" : prompt.icon === "drive" ? "△" : "▦"}</span><span>${escapeHtml(prompt.label)}</span></button>`).join("")}
        </div>
      </div>
    </section>`;
  bindComposer("home-composer");
  elements.viewRoot.querySelectorAll("[data-prompt-id]").forEach(button => button.addEventListener("click", () => {
    const prompt = SUGGESTED_PROMPTS.find(item => item.id === button.dataset.promptId);
    if (prompt) submitComposer(prompt.prompt);
  }));
}

function renderComposer({ id, placeholder, home = false }) {
  const attachment = state.attachments[0];
  return `
    <form id="${id}" class="chat-composer${home ? " home-composer" : " persistent-composer"}" novalidate>
      <div class="composer-input-row">
        ${home ? "" : `<button class="composer-tool" type="button" data-composer-action="attach" aria-label="Attach Workspace content">${icon("paperclip", 19)}</button><button class="composer-tool" type="button" data-composer-action="link" aria-label="Add a Google Workspace link">${icon("link", 19)}</button>`}
        <textarea class="composer-input" rows="1" placeholder="${escapeHtml(placeholder)}" aria-label="Message AI Brain">${escapeHtml(state.composerDraft)}</textarea>
        ${home ? `<button class="composer-send" type="submit" aria-label="Send message">${icon("send", 20)}</button>` : `<select class="source-dropdown" aria-label="Source scope"><option value="both" ${state.sourceScope === "both" ? "selected" : ""}>Both sources</option><option value="workspace" ${state.sourceScope === "workspace" ? "selected" : ""}>MRANTI Workspace</option><option value="external" ${state.sourceScope === "external" ? "selected" : ""}>External Sources</option></select><button class="composer-send" type="submit" aria-label="Send message">${icon("send", 20)}</button>`}
      </div>
      ${attachment ? renderAttachmentPreview(attachment) : ""}
      ${home ? `<div class="composer-toolbar"><button class="composer-tool" type="button" data-composer-action="attach" aria-label="Attach Workspace content">${icon("paperclip", 19)}</button><button class="composer-tool" type="button" data-composer-action="link" aria-label="Add a Google Workspace link"><span class="google-drive-icon" aria-hidden="true"></span></button><button class="composer-tool" type="button" data-composer-action="external" aria-label="Use external sources">${icon("globe", 19)}</button><div class="composer-spacer"></div><div class="source-scope" role="group" aria-label="Select sources">${scopeButtons()}</div><span class="keyboard-hint">Enter to send</span></div>` : ""}
    </form>`;
}

function scopeButtons() {
  return [["workspace", "MRANTI Workspace"], ["external", "External Sources"], ["both", "Both"]]
    .map(([value, label]) => `<button class="scope-button" type="button" data-scope="${value}" aria-pressed="${state.sourceScope === value}">${label}</button>`).join("");
}

function fileLabel(type) { return type === "slides" ? "Google Slides" : type === "docs" ? "Google Docs" : type === "sheets" ? "Google Sheets" : type === "folder" ? "Google Drive folder" : "Google Drive"; }
function fileIcon(type) { return type === "slides" ? "SL" : type === "docs" ? "D" : type === "sheets" ? "S" : type === "pdf" ? "PDF" : "G"; }

function renderAttachmentPreview(attachment) {
  return `<div class="attachment-preview" data-attachment-id="${escapeHtml(attachment.id)}"><span class="file-icon ${escapeHtml(attachment.type)}" style="width:30px;height:34px;font-size:7px">${fileIcon(attachment.type)}</span><span><strong>${escapeHtml(attachment.name)}</strong><small>${escapeHtml(fileLabel(attachment.type))} · ${escapeHtml(attachment.access || "Access confirmed")}</small></span><button type="button" data-remove-attachment="${escapeHtml(attachment.id)}" aria-label="Remove attachment">${icon("close", 16)}</button></div>`;
}

function bindComposer(id) {
  const form = document.getElementById(id);
  if (!form) return;
  const textarea = form.querySelector("textarea");
  const select = form.querySelector("select");
  textarea.addEventListener("input", () => { state.composerDraft = textarea.value; autoResizeTextarea(textarea); });
  textarea.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
  textarea.addEventListener("paste", event => {
    const pasted = event.clipboardData?.getData("text") || "";
    if (parseGoogleWorkspaceUrl(pasted.trim()).supported) setTimeout(() => attachWorkspaceUrl(pasted.trim()), 0);
  });
  form.addEventListener("submit", event => { event.preventDefault(); submitComposer(textarea.value.trim()); });
  form.querySelectorAll("[data-composer-action]").forEach(button => button.addEventListener("click", () => handleComposerAction(button.dataset.composerAction)));
  form.querySelectorAll("[data-scope]").forEach(button => button.addEventListener("click", () => {
    state.sourceScope = button.dataset.scope;
    form.querySelectorAll("[data-scope]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.scope === state.sourceScope)));
  }));
  form.querySelectorAll("[data-remove-attachment]").forEach(button => button.addEventListener("click", () => {
    state.attachments = state.attachments.filter(item => item.id !== button.dataset.removeAttachment);
    state.presentation = null;
    renderRoute();
  }));
  select?.addEventListener("change", () => { state.sourceScope = select.value; });
  autoResizeTextarea(textarea);
}

function autoResizeTextarea(textarea) { textarea.style.height = "auto"; textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`; }
function handleComposerAction(action) {
  if (action === "external") { state.sourceScope = state.sourceScope === "external" ? "both" : "external"; renderRoute(); return; }
  if (action === "attach") openAttachmentModal();
  if (action === "link") openLinkModal();
}

async function attachWorkspaceUrl(url) {
  const parsed = parseGoogleWorkspaceUrl(url);
  if (!parsed.supported) return showToast("Enter a supported Google Workspace link.", "error");
  state.loading = true;
  showToast("Checking your Google Workspace access…");
  try {
    const response = await resolveWorkspaceFile(parsed, authContext(), config);
    const file = response.file || response;
    const attachment = {
      id: file.id || parsed.fileId,
      type: file.type || parsed.type,
      name: file.name || fileLabel(parsed.type),
      url: file.webViewLink || parsed.url,
      webViewLink: file.webViewLink || parsed.url,
      mimeType: file.mimeType || "",
      access: file.access || "View access confirmed",
      owner: file.owner || "Authorised Workspace account",
      updatedAt: file.modifiedTime || "",
      location: file.location || (file.driveId ? "Shared Drive" : "Google Drive")
    };
    state.attachments = [attachment];
    if (attachment.type === "slides") {
      const presentationResponse = await loadPresentation(attachment.id, authContext(), config);
      state.presentation = presentationResponse.presentation || presentationResponse;
      state.selectedSlide = Number(state.presentation.selectedSlide || 1);
      state.attachments = [{ ...attachment, ...state.presentation, id: attachment.id, type: "slides", url: attachment.url }];
    }
    showToast(`${attachment.name} attached with confirmed access.`, "success");
    renderRoute();
  } catch (error) {
    handleServiceError(error);
  } finally {
    state.loading = false;
  }
}

async function submitComposer(message) {
  if (!message) return showToast("Enter a question or instruction before sending.", "error");
  state.composerDraft = message;
  const slides = state.attachments.find(item => item.type === "slides");
  if (slides && /validate|verify|claim|fact|statistic|target|evidence/i.test(message)) {
    await beginLiveValidation(message, slides);
    return;
  }
  await runLiveConversation(message);
}

async function runLiveConversation(message) {
  const conversationId = state.activeConversation?.id || makeId("conversation");
  state.loading = true;
  state.activeConversation = { id: conversationId, title: message.slice(0, 72), type: "query", status: "active" };
  state.conversationMessages.push({ id: makeId("message"), role: "user", text: message, createdAt: new Date().toISOString(), attachments: state.attachments });
  state.composerDraft = "";
  navigate({ name: "conversation", id: conversationId });
  renderGenericConversation();
  try {
    const response = await askAiBrain({ query: message, sourceScope: state.sourceScope, attachments: state.attachments, conversationId }, authContext(), config);
    state.conversationMessages.push({
      id: makeId("message"), role: "assistant", text: response.answer || response.message || "AI Brain completed the request.",
      citations: response.citations || response.externalSources || [], internalSources: response.internalSources || [], createdAt: new Date().toISOString()
    });
    const resolvedTitle = chooseConversationTitle(message, response.title);
    state.activeConversation.title = resolvedTitle;
    await saveConversation(uid(), {
      id: conversationId,
      title: resolvedTitle,
      type: "query",
      status: "complete",
      sourceScope: state.sourceScope,
      attachments: state.attachments,
      messages: state.conversationMessages
    });
  } catch (error) {
    state.conversationMessages.push({ id: makeId("message"), role: "error", text: error.message || "AI Brain could not complete the request.", createdAt: new Date().toISOString() });
    handleServiceError(error);
  } finally {
    state.loading = false;
    renderGenericConversation();
  }
}

async function beginLiveValidation(instruction, presentationAttachment) {
  const conversationId = makeId("validation");
  const jobId = makeId("job");
  const selectedSlide = Number(state.selectedSlide || 1);
  const steps = VALIDATION_STEP_LABELS.map((step, index) => ({ ...step, status: index === 0 ? "active" : "pending" }));
  await createValidationJob(uid(), {
    id: jobId,
    conversationId,
    presentationId: presentationAttachment.id,
    presentationName: presentationAttachment.name,
    selectedSlide,
    instruction,
    steps
  });
  state.validationJob = { id: jobId, conversationId, presentationId: presentationAttachment.id, presentation: state.presentation || presentationAttachment, selectedSlide, instruction, status: "queued", progress: 0, steps };
  state.activeConversation = { id: conversationId, title: `${presentationAttachment.name} validation`, type: "validation", status: "progress", jobId };
  state.composerDraft = "";
  subscribeToValidation(jobId, conversationId);
  navigate({ name: "conversation", id: conversationId });
  renderProgressView();
  try {
    await startValidation({ jobId, conversationId, presentationId: presentationAttachment.id, selectedSlide, instruction }, authContext(), config);
  } catch (error) {
    handleServiceError(error);
  }
}

function subscribeToValidation(jobId, conversationId) {
  validationUnsubscribe?.();
  validationUnsubscribe = subscribeValidationJob(uid(), jobId, async job => {
    state.validationJob = job;
    if (job.presentation) state.presentation = job.presentation;
    if (job.report) {
      state.report = normaliseReport(job.report);
      state.activeConversation = { id: conversationId, title: `${state.report.presentation?.name || state.presentation?.name || "Presentation"} validation`, type: "validation", status: "complete", jobId };
      await saveValidationConversation(uid(), {
        conversationId,
        presentation: state.report.presentation || state.presentation,
        instruction: job.instruction,
        report: state.report,
        jobId
      });
    }
    if (state.route.name === "conversation" && state.route.id === conversationId) {
      if (job.status === "complete" && job.report) renderCompleteView();
      else if (job.status === "failed") renderErrorView(job.error || "Validation could not be completed.");
      else if (job.status === "cancelled") renderCancelledView();
      else renderProgressView();
    }
  }, error => {
    console.error(error);
    renderErrorView("The validation status could not be retrieved from Firestore.");
  });
}

function normaliseReport(report) {
  const claims = Array.isArray(report?.claims) ? report.claims.map((claim, index) => ({
    id: claim.id || `claim-${String(index + 1).padStart(2, "0")}`,
    index: Number(claim.index || index + 1),
    slide: Number(claim.slide || report.selectedSlide || state.selectedSlide || 1),
    title: claim.title || `Claim ${index + 1}`,
    exactClaim: claim.exactClaim || claim.claim || "",
    verdict: claim.verdict || "unable-to-verify",
    verdictLabel: claim.verdictLabel || VERDICT_LABELS[claim.verdict] || "Unable to verify",
    finding: claim.finding || "",
    recommendation: claim.recommendation || "",
    suggestedWording: claim.suggestedWording || claim.recommendedReplacement || "",
    collapsedSummary: claim.collapsedSummary || claim.finding || "",
    internalEvidenceIds: claim.internalEvidenceIds || [],
    externalEvidenceIds: claim.externalEvidenceIds || []
  })) : [];
  const summary = report.summary || {};
  return {
    ...report,
    claims,
    summary: {
      reviewed: Number(summary.reviewed ?? claims.length),
      verified: Number(summary.verified ?? claims.filter(item => item.verdict === "verified").length),
      qualified: Number(summary.qualified ?? claims.filter(item => item.verdict === "supported-with-qualification").length),
      target: Number(summary.target ?? claims.filter(item => item.verdict === "mranti-proposed-target").length)
    },
    internalEvidence: Array.isArray(report.internalEvidence) ? report.internalEvidence : [],
    externalEvidence: Array.isArray(report.externalEvidence) ? report.externalEvidence : []
  };
}

async function loadAndRenderConversation(conversationId) {
  if (state.activeConversation?.id === conversationId) {
    if (state.report) renderCompleteView();
    else if (state.validationJob) renderProgressView();
    else renderGenericConversation();
    return;
  }
  elements.viewRoot.innerHTML = `<section class="conversation-view"><div class="conversation-container"><div class="generic-conversation"><div><span class="spinner"></span><h2>Loading conversation</h2><p>Retrieving your saved AI Brain work.</p></div></div></div></section>`;
  try {
    const conversation = await loadConversation(uid(), conversationId);
    if (!conversation) return renderErrorView("This conversation could not be found or is no longer available.");
    state.activeConversation = conversation;
    state.attachments = conversation.attachments || (conversation.presentation ? [conversation.presentation] : []);
    state.presentation = conversation.presentation || null;
    state.conversationMessages = conversation.messages || [];
    state.report = conversation.report ? normaliseReport(conversation.report) : null;
    if (conversation.jobId && !state.report) subscribeToValidation(conversation.jobId, conversationId);
    if (state.report) renderCompleteView();
    else if (conversation.type === "validation") renderProgressView();
    else renderGenericConversation();
  } catch (error) {
    renderErrorView(error.message || "The conversation could not be loaded.");
  }
}

function conversationHeader({ title, meta, badges = [] }) {
  return `<header class="conversation-header"><div><h1 class="conversation-title">${escapeHtml(title)}</h1><p class="conversation-meta">${escapeHtml(meta)}</p></div><div class="status-badges">${badges.map(badge => `<span class="status-badge ${escapeHtml(badge.className)}">${escapeHtml(badge.label)}</span>`).join("")}</div></header>`;
}

function currentPresentation() { return state.report?.presentation || state.presentation || state.attachments.find(item => item.type === "slides") || null; }

function renderSlidesCard() {
  const presentation = currentPresentation();
  if (!presentation) return "";
  const slides = Array.isArray(presentation.slides) ? presentation.slides : [];
  return `<article class="slides-card" aria-label="Attached Google Slides presentation"><div class="slides-head"><span class="file-icon slides">SL</span><div class="slides-copy"><h2>${escapeHtml(presentation.name || "Google Slides presentation")}</h2><p>Google Slides · ${Number(presentation.slideCount || slides.length)} slides · ${escapeHtml(presentation.access || "View access confirmed")}</p><p class="file-owner">Accessed through your MRANTI Workspace account · ${escapeHtml(presentation.owner || "Authorised account")} · ${escapeHtml(presentation.location || "Google Drive")}</p></div><button class="outline-action" type="button" data-action="open-presentation">Open presentation ${icon("external", 13)}</button></div><div class="thumbnail-strip" role="listbox" aria-label="Presentation slides">${slides.map(slide => `<button class="slide-thumb${state.selectedSlide === Number(slide.number) ? " selected" : ""}" type="button" role="option" aria-selected="${state.selectedSlide === Number(slide.number)}" aria-label="Select Slide ${slide.number}: ${escapeHtml(slide.title || "Slide")}" data-slide-number="${slide.number}"${slide.thumbnailUrl ? ` style="background-image:url('${escapeHtml(slide.thumbnailUrl)}');background-size:cover;background-position:center"` : ""}><span class="slide-number">${slide.number}</span></button>`).join("")}</div><div class="slide-strip-meta">${Number(presentation.slideCount || slides.length)} slides available · <strong>Slide ${state.selectedSlide} selected</strong></div></article>`;
}

function renderProgressView() {
  const job = state.validationJob || {};
  const presentation = currentPresentation() || { name: job.presentationName || "Presentation" };
  const steps = job.steps?.length ? job.steps : VALIDATION_STEP_LABELS.map((step, index) => ({ ...step, status: index === 0 ? "active" : "pending" }));
  const progress = Number(job.progress || 0);
  const related = Array.isArray(job.relatedContext) ? job.relatedContext : [];
  elements.viewRoot.innerHTML = `<section class="conversation-view" aria-labelledby="progress-title"><div class="conversation-container">${conversationHeader({ title: `${presentation.name || "Presentation"} validation`, meta: "Workspace conversation · Internal and external evidence enabled", badges: [{ label: "Secure Workspace access", className: "secure" }] })}<div class="user-message">${escapeHtml(job.instruction || "Validate the selected slide using current authoritative external sources.")}<span class="message-time">Submitted securely</span></div>${renderSlidesCard()}<article class="validation-card" aria-live="polite" aria-labelledby="progress-title"><div class="validation-head"><img class="ai-response-mark" src="mranti-workspace-mark.png" alt="" aria-hidden="true" /><div><h2 id="progress-title">Validating your presentation</h2><p>${escapeHtml(job.statusMessage || `AI Brain is reviewing the full presentation before validating Slide ${Number(job.selectedSlide || state.selectedSlide)}.`)}</p></div><div class="progress-block"><div class="progress-track" role="progressbar" aria-label="Validation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="progress-fill" style="width:${Math.max(2, progress)}%"></div></div><span class="progress-value">${progress}% complete</span></div></div><div class="validation-steps">${steps.map(step => `<div class="validation-step ${escapeHtml(step.status || "pending")}"><span class="step-mark">${step.status === "complete" ? "✓" : ""}</span><span>${escapeHtml(step.label)} — ${step.status === "complete" ? "Complete" : step.status === "active" ? "In progress" : "Pending"}</span></div>`).join("")}</div>${related.length ? `<div class="context-divider"></div><p class="context-label">Related MRANTI context found</p><div class="context-chips">${related.map(item => `<button class="context-chip" type="button" data-context-url="${escapeHtml(item.url || item.webViewLink || "")}"><span class="source-type ${escapeHtml(item.type || "drive")}" style="width:20px;height:23px">${fileIcon(item.type)}</span><span>${escapeHtml(item.title || item.name)}</span></button>`).join("")}</div>` : ""}<div class="cancel-row"><button class="text-action" type="button" data-action="cancel-validation">Cancel validation</button></div></article><div class="trust-banner">${icon("shield", 17)} <span>This process uses your authorised Google Workspace content and trusted external sources. Internal information is not exposed publicly.</span></div>${renderComposer({ id: "progress-composer", placeholder: "Ask a follow-up question while AI Brain works…" })}</div></section>`;
  bindCommonConversationEvents();
  bindComposer("progress-composer");
  elements.viewRoot.querySelector("[data-action='cancel-validation']")?.addEventListener("click", async () => {
    if (!state.validationJob?.id) return;
    await requestValidationCancellation(uid(), state.validationJob.id);
    showToast("Cancellation requested. AI Brain will stop at the next safe checkpoint.");
  });
  elements.viewRoot.querySelectorAll("[data-context-url]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.contextUrl) window.open(button.dataset.contextUrl, "_blank", "noopener,noreferrer");
  }));
}

function renderCompleteView() {
  const report = state.report;
  if (!report) return renderErrorView("The validation report is not available.");
  const claims = report.claims || [];
  if (!state.selectedClaimId && claims[0]) state.selectedClaimId = claims[0].id;
  if (!state.expandedClaimIds.size && claims[0]) state.expandedClaimIds.add(claims[0].id);
  const selectedClaim = claims.find(claim => claim.id === state.selectedClaimId) || claims[0];
  const presentation = report.presentation || currentPresentation() || {};
  elements.viewRoot.innerHTML = `<section class="conversation-view" aria-labelledby="complete-title"><div class="conversation-container with-inspector">${conversationHeader({ title: `${presentation.name || "Presentation"} validation`, meta: `${presentation.name || "Google Slides"} · Slide ${Number(report.selectedSlide || state.selectedSlide)}`, badges: [{ label: "Validation complete", className: "complete" }, { label: "Evidence trail retained", className: "trail" }] })}<div class="completed-grid${state.inspectorOpen ? "" : " no-inspector"}"><div class="report-column"><div class="ai-intro"><img class="ai-intro-mark" src="mranti-workspace-mark.png" alt="" aria-hidden="true" /><p>${escapeHtml(report.introduction || `AI Brain reviewed the presentation and validated ${claims.length} claims using authorised MRANTI sources and current external evidence.`)}</p></div><section class="report-summary" aria-labelledby="complete-title"><div class="report-summary-copy"><h2 id="complete-title">Slide ${Number(report.selectedSlide || state.selectedSlide)} Validation Report</h2><p>${escapeHtml(report.supportingCopy || "Review the claim-level findings, evidence and recommended wording before executive presentation.")}</p></div>${summaryIndicator(report.summary.reviewed, "Claims reviewed", "")}${summaryIndicator(report.summary.verified, "Verified", "verified")}${summaryIndicator(report.summary.qualified, "Supported with qualification", "qualified")}${summaryIndicator(report.summary.target, "MRANTI proposed target", "target")}</section><div class="claim-list" aria-label="Validation claims">${claims.map(renderClaimCard).join("")}</div><div class="report-actions" aria-label="Post-validation actions"><button class="report-action primary" type="button" data-action="review-revisions">Review and apply revisions</button><button class="report-action" type="button" data-action="citation-footnotes">Add citation footnotes</button><button class="report-action" type="button" data-action="source-appendix">Generate source appendix</button><button class="report-action" type="button" data-action="validate-full-deck">Validate full deck</button><button class="report-action tertiary" type="button" data-action="export-report">Export validation report</button><button class="report-action tertiary" type="button" data-action="save-drive">Save to Drive</button><button class="report-action tertiary" type="button" data-action="share-findings">Share findings</button></div>${renderComposer({ id: "complete-composer", placeholder: "Ask about a claim, source or recommended revision…" })}</div>${state.inspectorOpen && selectedClaim ? renderEvidenceInspector(selectedClaim) : ""}</div></div></section>`;
  bindCompleteEvents();
  bindComposer("complete-composer");
  document.body.classList.toggle("inspector-open", state.inspectorOpen);
}

function summaryIndicator(number, label, className) { return `<div class="summary-indicator ${className}"><span class="summary-number">${Number(number || 0)}</span><span><strong>${Number(number || 0)}</strong><small>${escapeHtml(label)}</small></span></div>`; }

function renderClaimCard(claim) {
  const expanded = state.expandedClaimIds.has(claim.id);
  const internalCount = claim.internalEvidenceIds?.length || evidenceForClaim(claim, "internal").length;
  const externalCount = claim.externalEvidenceIds?.length || evidenceForClaim(claim, "external").length;
  return `<article class="claim-card${expanded ? " expanded" : ""}" data-claim-card="${escapeHtml(claim.id)}"><button class="claim-toggle" type="button" data-toggle-claim="${escapeHtml(claim.id)}" aria-expanded="${expanded}"><span><span class="claim-label">Claim ${String(claim.index).padStart(2, "0")} · Slide ${claim.slide}</span><span class="claim-title">${escapeHtml(claim.title)}</span></span><span class="verdict-badge ${escapeHtml(claim.verdict)}">${escapeHtml(claim.verdictLabel)}</span><span class="evidence-count">${internalCount} internal · ${externalCount} external ${icon(expanded ? "chevronDown" : "chevronRight", 12)}</span></button>${expanded ? `<div class="claim-body"><p class="exact-claim">Exact claim: “${escapeHtml(claim.exactClaim)}”</p><div class="claim-detail-grid"><div class="claim-detail"><h4>Finding</h4><p>${escapeHtml(claim.finding)}</p></div><div class="claim-detail"><h4>Recommendation</h4><p>${escapeHtml(claim.recommendation)}</p></div><div class="claim-detail"><h4>Suggested wording</h4><p>“${escapeHtml(claim.suggestedWording)}”</p></div></div><div class="claim-actions"><button class="claim-action" type="button" data-view-evidence="${escapeHtml(claim.id)}">View evidence</button><button class="claim-action primary" type="button" data-review-claim="${escapeHtml(claim.id)}">Review revision</button></div></div>` : `<p class="claim-collapsed-summary">${escapeHtml(claim.collapsedSummary)}</p>`}</article>`;
}

function evidenceForClaim(claim, type) {
  const all = type === "internal" ? state.report.internalEvidence : state.report.externalEvidence;
  const ids = type === "internal" ? claim.internalEvidenceIds : claim.externalEvidenceIds;
  if (Array.isArray(ids) && ids.length) return all.filter(item => ids.includes(item.id));
  return all;
}

function renderEvidenceInspector(claim) {
  const internal = evidenceForClaim(claim, "internal");
  const external = evidenceForClaim(claim, "external");
  return `<aside class="evidence-inspector" role="${window.innerWidth <= 1080 ? "dialog" : "complementary"}" aria-label="Evidence Inspector" aria-modal="${window.innerWidth <= 1080}" tabindex="-1"><div class="inspector-head"><div><h2>Evidence Inspector</h2><p class="inspector-sub">Selected claim</p></div><button class="inspector-close" type="button" data-action="close-inspector" aria-label="Close Evidence Inspector">${icon("close", 18)}</button></div><p class="inspector-claim">Claim ${String(claim.index).padStart(2, "0")} · ${escapeHtml(claim.title)}</p><section class="evidence-section"><h3 class="evidence-section-title">Internal MRANTI evidence</h3>${internal.length ? internal.map(renderEvidenceCard).join("") : `<p class="evidence-empty">No related internal source was found.</p>`}</section><section class="evidence-section"><h3 class="evidence-section-title">External evidence</h3>${external.length ? external.map(renderEvidenceCard).join("") : `<p class="evidence-empty">No authoritative external source was retained for this claim.</p>`}</section><button class="view-all-evidence" type="button" data-action="view-all-evidence">View all evidence</button><section class="wording-preview"><h3>Approved wording preview</h3><blockquote>“${escapeHtml(claim.suggestedWording || claim.exactClaim)}”</blockquote><div class="wording-actions"><button type="button" data-action="copy-wording">Copy wording</button><button class="primary" type="button" data-action="apply-slide">Apply to Slide ${claim.slide}</button></div></section><div class="inspector-trust">${icon("lock", 14)} <span>${escapeHtml(APP_COPY.trustMessage)}</span></div></aside>`;
}

function renderEvidenceCard(source) {
  return `<article class="evidence-card"><span class="source-type ${escapeHtml(source.type || "web")}">${fileIcon(source.type)}</span><div class="evidence-copy"><div class="evidence-title-row"><strong>${escapeHtml(source.title || source.name || "Source")}</strong>${source.badge ? `<span class="authority-badge">${escapeHtml(source.badge)}</span>` : ""}</div><p class="evidence-meta">${escapeHtml(source.meta || source.authority || "")}</p><p class="evidence-excerpt">“${escapeHtml(source.excerpt || source.snippet || "Relevant source retained in the evidence trail.") }”</p>${source.url || source.webViewLink ? `<button class="open-source" type="button" data-open-source="${escapeHtml(source.id)}">Open source ${icon("external", 10)}</button>` : ""}</div></article>`;
}

function bindCommonConversationEvents() {
  elements.viewRoot.querySelectorAll("[data-slide-number]").forEach(button => button.addEventListener("click", () => { state.selectedSlide = Number(button.dataset.slideNumber); renderRoute(); }));
  elements.viewRoot.querySelector("[data-action='open-presentation']")?.addEventListener("click", openPresentation);
}

function bindCompleteEvents() {
  bindCommonConversationEvents();
  elements.viewRoot.querySelectorAll("[data-toggle-claim]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.toggleClaim;
    if (state.expandedClaimIds.has(id)) state.expandedClaimIds.delete(id); else state.expandedClaimIds.add(id);
    state.selectedClaimId = id;
    renderCompleteView();
  }));
  elements.viewRoot.querySelectorAll("[data-view-evidence]").forEach(button => button.addEventListener("click", () => { state.selectedClaimId = button.dataset.viewEvidence; state.inspectorOpen = true; renderCompleteView(); }));
  elements.viewRoot.querySelectorAll("[data-review-claim]").forEach(button => button.addEventListener("click", () => openRevisionReview(button.dataset.reviewClaim)));
  elements.viewRoot.querySelector("[data-action='close-inspector']")?.addEventListener("click", () => { state.inspectorOpen = false; renderCompleteView(); });
  elements.viewRoot.querySelector("[data-action='copy-wording']")?.addEventListener("click", copySelectedWording);
  elements.viewRoot.querySelector("[data-action='view-all-evidence']")?.addEventListener("click", openAllEvidenceDialog);
  elements.viewRoot.querySelector("[data-action='apply-slide']")?.addEventListener("click", () => openRevisionReview(state.selectedClaimId));
  elements.viewRoot.querySelectorAll("[data-open-source]").forEach(button => button.addEventListener("click", () => openEvidenceSource(button.dataset.openSource)));
  elements.viewRoot.querySelector("[data-action='review-revisions']")?.addEventListener("click", () => openRevisionReview(state.selectedClaimId));
  elements.viewRoot.querySelector("[data-action='export-report']")?.addEventListener("click", exportValidationReport);
  elements.viewRoot.querySelector("[data-action='save-drive']")?.addEventListener("click", saveValidationReportToDrive);
  elements.viewRoot.querySelector("[data-action='share-findings']")?.addEventListener("click", shareFindings);
  elements.viewRoot.querySelector("[data-action='citation-footnotes']")?.addEventListener("click", () => openCitationDialog(state.selectedClaimId));
  elements.viewRoot.querySelector("[data-action='source-appendix']")?.addEventListener("click", saveSourceAppendixToDrive);
  elements.viewRoot.querySelector("[data-action='validate-full-deck']")?.addEventListener("click", async () => {
    const presentation = currentPresentation();
    if (!presentation) return;
    state.selectedSlide = 0;
    await beginLiveValidation("Validate the full presentation and prepare a complete evidence-backed report.", presentation);
  });
}

function openPresentation() {
  const presentation = currentPresentation();
  const url = presentation?.url || presentation?.webViewLink;
  if (url) window.open(url, "_blank", "noopener,noreferrer"); else showToast("The source presentation link is unavailable.", "error");
}

async function copySelectedWording() {
  const claim = state.report?.claims.find(item => item.id === state.selectedClaimId) || state.report?.claims[0];
  if (!claim) return;
  try { await navigator.clipboard.writeText(claim.suggestedWording || claim.exactClaim); showToast("Recommended wording copied to the clipboard.", "success"); }
  catch { showToast("Clipboard access is unavailable. Select and copy the wording manually.", "error"); }
}

function openEvidenceSource(sourceId) {
  const source = [...(state.report?.internalEvidence || []), ...(state.report?.externalEvidence || [])].find(item => item.id === sourceId);
  const url = source?.url || source?.webViewLink;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function openAllEvidenceDialog() {
  const sources = [
    ...(state.report?.internalEvidence || []).map(source => ({ ...source, group: "Internal MRANTI evidence" })),
    ...(state.report?.externalEvidence || []).map(source => ({ ...source, group: "External evidence" }))
  ];
  openModal(`<div class="modal-head"><div><h2 id="modal-title">Full evidence register</h2><p>${sources.length} live sources retained in this report</p></div><button class="inspector-close" type="button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div><div class="modal-body"><div class="evidence-register">${sources.map(source => `<article><span>${escapeHtml(source.group)}</span><strong>${escapeHtml(source.title || source.name)}</strong><p>${escapeHtml(source.meta || source.authority || "")}</p>${source.url || source.webViewLink ? `<button class="open-source" type="button" data-modal-source="${escapeHtml(source.url || source.webViewLink)}">Open source</button>` : ""}</article>`).join("")}</div></div><div class="modal-actions"><button class="primary" type="button" data-close-modal>Close evidence register</button></div>`);
  elements.modalRoot.querySelectorAll("[data-modal-source]").forEach(button => button.addEventListener("click", () => window.open(button.dataset.modalSource, "_blank", "noopener,noreferrer")));
}

function reportText() {
  const report = state.report;
  const presentation = report?.presentation || currentPresentation() || {};
  return [
    "MRANTI Workspace — AI Brain",
    `${presentation.name || "Presentation"} — Slide ${report?.selectedSlide || state.selectedSlide} Validation Report`,
    "",
    report?.introduction || "",
    report?.supportingCopy || "",
    "",
    ...(report?.claims || []).flatMap(claim => [
      `Claim ${String(claim.index).padStart(2, "0")} — ${claim.title}`,
      `Verdict: ${claim.verdictLabel}`,
      `Exact claim: ${claim.exactClaim}`,
      `Finding: ${claim.finding}`,
      `Recommendation: ${claim.recommendation}`,
      `Suggested wording: ${claim.suggestedWording}`,
      ""
    ]),
    "Internal evidence:",
    ...(report?.internalEvidence || []).map(source => `- ${source.title || source.name}: ${source.url || source.webViewLink || ""}`),
    "",
    "External evidence:",
    ...(report?.externalEvidence || []).map(source => `- ${source.title || source.name}: ${source.url || ""}`)
  ].join("\n");
}

function exportValidationReport() {
  const name = (currentPresentation()?.name || "MRANTI-Presentation").replace(/[^A-Za-z0-9_-]+/g, "-");
  downloadTextFile(`${name}-Validation-Report.txt`, reportText());
  showToast("Validation report exported.", "success");
}

async function saveValidationReportToDrive() {
  try {
    const token = await acquireGoogleAccessToken({ firebaseAuth, currentUser: state.currentUser, scopes: authConfig.onDemandScopes?.driveWrite || [], allowedDomain });
    const response = await saveReportToDrive({ title: `${currentPresentation()?.name || "Presentation"} — Validation Report`, content: reportText(), documentType: "validation-report" }, authContext(), config, token);
    showToast("Validation report saved to your Google Drive.", "success");
    if (response.webViewLink) window.open(response.webViewLink, "_blank", "noopener,noreferrer");
  } catch (error) { handleServiceError(error); }
}

async function saveSourceAppendixToDrive() {
  const sources = [...(state.report?.internalEvidence || []), ...(state.report?.externalEvidence || [])];
  const content = ["MRANTI Workspace — AI Brain", "Source Appendix", "", ...sources.map((source, index) => `${index + 1}. ${source.title || source.name}\n${source.meta || source.authority || ""}\n${source.url || source.webViewLink || ""}\n${source.excerpt || source.snippet || ""}\n`)].join("\n");
  try {
    const token = await acquireGoogleAccessToken({ firebaseAuth, currentUser: state.currentUser, scopes: authConfig.onDemandScopes?.driveWrite || [], allowedDomain });
    const response = await saveReportToDrive({ title: `${currentPresentation()?.name || "Presentation"} — Source Appendix`, content, documentType: "source-appendix" }, authContext(), config, token);
    showToast("Source appendix saved to your Google Drive.", "success");
    if (response.webViewLink) window.open(response.webViewLink, "_blank", "noopener,noreferrer");
  } catch (error) { handleServiceError(error); }
}

async function shareFindings() {
  const shareData = { title: `${currentPresentation()?.name || "Presentation"} validation`, text: state.report?.supportingCopy || "MRANTI AI Brain validation report", url: location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else { await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`); showToast("Share text copied to the clipboard.", "success"); }
  } catch (error) {
    if (error?.name !== "AbortError") showToast("The findings could not be shared from this browser.", "error");
  }
}

function openRevisionReview(claimId) {
  const claim = state.report?.claims.find(item => item.id === claimId) || state.report?.claims[0];
  if (!claim) return;
  state.selectedClaimId = claim.id;
  openModal(`<div class="modal-head"><div><h2 id="modal-title">Review proposed revision</h2><p>${escapeHtml(currentPresentation()?.name || "Presentation")} · Slide ${claim.slide} · Claim ${String(claim.index).padStart(2, "0")}</p></div><button class="inspector-close" type="button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div><div class="modal-body"><div class="revision-grid"><section class="revision-box"><h3>Original wording</h3><textarea id="original-wording" readonly>${escapeHtml(claim.exactClaim)}</textarea></section><section class="revision-box recommended"><h3>AI Brain recommended wording</h3><textarea id="recommended-wording">${escapeHtml(claim.suggestedWording)}</textarea></section></div><div class="revision-meta"><strong>Target presentation:</strong> ${escapeHtml(currentPresentation()?.name || "Presentation")}<br/><strong>Target slide:</strong> ${claim.slide}<br/><strong>Supporting sources:</strong> ${evidenceForClaim(claim, "internal").length} internal and ${evidenceForClaim(claim, "external").length} external sources.<br/><strong>Expected modification:</strong> Replace the exact selected statement only after explicit confirmation.</div></div><div class="modal-actions"><button type="button" data-close-modal>Cancel</button><button type="button" id="keep-original">Keep original</button><button class="primary" type="button" id="accept-revision">Accept revision</button></div>`, { initialFocus: "#recommended-wording" });
  elements.modalRoot.querySelector("#keep-original").addEventListener("click", () => { closeModal(); showToast("Original wording retained. No presentation change was made."); });
  elements.modalRoot.querySelector("#accept-revision").addEventListener("click", () => openApplyConfirmation(claim, elements.modalRoot.querySelector("#recommended-wording").value.trim()));
}

function openApplyConfirmation(claim, proposed) {
  openModal(`<div class="modal-head"><div><h2 id="modal-title">Confirm presentation change</h2><p>${escapeHtml(currentPresentation()?.name || "Presentation")} · Slide ${claim.slide}</p></div><button class="inspector-close" type="button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div><div class="modal-body"><div class="confirm-box"><strong>Proposed change</strong><br/><br/>Replace:<br/>“${escapeHtml(claim.exactClaim)}”<br/><br/>With:<br/>“${escapeHtml(proposed)}”<br/><br/>Google will apply this change only after you authorise presentation write access and confirm below.</div></div><div class="modal-actions"><button type="button" data-close-modal>Cancel</button><button class="primary" type="button" id="confirm-apply">Apply approved revision</button></div>`);
  elements.modalRoot.querySelector("#confirm-apply").addEventListener("click", async () => {
    const button = elements.modalRoot.querySelector("#confirm-apply");
    button.disabled = true;
    try {
      const token = await acquireGoogleAccessToken({ firebaseAuth, currentUser: state.currentUser, scopes: authConfig.onDemandScopes?.slidesWrite || [], allowedDomain });
      const presentation = currentPresentation();
      const selectedSlide = presentation?.slides?.find(slide => Number(slide.number) === Number(claim.slide));
      const response = await applyRevision({
        action: "replaceText",
        presentationId: presentation?.id,
        pageObjectId: selectedSlide?.objectId,
        originalText: claim.exactClaim,
        replacementText: proposed,
        revisionId: presentation?.revisionId || ""
      }, authContext(), config, token);
      closeModal();
      showToast(`Revision applied to Slide ${claim.slide}${response.occurrencesChanged !== undefined ? ` (${response.occurrencesChanged} replacement${response.occurrencesChanged === 1 ? "" : "s"})` : ""}.`, "success");
    } catch (error) { button.disabled = false; handleServiceError(error); }
  });
}

function openCitationDialog(claimId) {
  const claim = state.report?.claims.find(item => item.id === claimId) || state.report?.claims[0];
  if (!claim) return;
  const evidence = evidenceForClaim(claim, "external");
  const citationText = evidence.slice(0, 3).map((source, index) => `[${index + 1}] ${source.title || source.name} — ${source.url || ""}`).join("\n");
  openModal(`<div class="modal-head"><div><h2 id="modal-title">Add citation footnotes</h2><p>Slide ${claim.slide} · ${escapeHtml(claim.title)}</p></div><button class="inspector-close" type="button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div><div class="modal-body"><label class="claim-label" for="citation-text">Citation text</label><textarea id="citation-text" style="width:100%;min-height:160px;margin-top:8px;padding:12px;border:1px solid #c9daf7;border-radius:9px">${escapeHtml(citationText)}</textarea><p class="revision-meta">AI Brain will add a small citation text box to the selected slide. You will be asked to authorise Google Slides write access before any change.</p></div><div class="modal-actions"><button type="button" data-close-modal>Cancel</button><button class="primary" type="button" id="confirm-citation">Review and add citations</button></div>`, { initialFocus: "#citation-text" });
  elements.modalRoot.querySelector("#confirm-citation").addEventListener("click", async () => {
    try {
      const token = await acquireGoogleAccessToken({ firebaseAuth, currentUser: state.currentUser, scopes: authConfig.onDemandScopes?.slidesWrite || [], allowedDomain });
      const presentation = currentPresentation();
      const selectedSlide = presentation?.slides?.find(slide => Number(slide.number) === Number(claim.slide));
      await applyRevision({
        action: "addCitationFootnote",
        presentationId: presentation?.id,
        pageObjectId: selectedSlide?.objectId,
        citationText: elements.modalRoot.querySelector("#citation-text").value.trim(),
        revisionId: presentation?.revisionId || ""
      }, authContext(), config, token);
      closeModal();
      showToast(`Citation footnotes added to Slide ${claim.slide}.`, "success");
    } catch (error) { handleServiceError(error); }
  });
}

function normaliseMessageSources(message) {
  const seen = new Set();
  return [...(message.internalSources || []), ...(message.citations || [])].filter(source => {
    const url = String(source.url || source.webViewLink || "").trim();
    const title = String(source.title || source.name || "").trim();
    const key = url || title.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(url && title);
  });
}

function renderAnswerSources(message) {
  const sources = normaliseMessageSources(message);
  if (!sources.length) return "";
  const messageId = escapeHtml(message.id || makeId("sources"));
  const visibleLimit = 6;
  const buttons = sources.map((source, index) => {
    const type = String(source.type || "drive").toLowerCase();
    const label = type === "calendar" ? "Calendar" : type === "gmail" ? "Gmail" : type === "web" ? "External" : type === "slides" ? "Slides" : type === "sheets" ? "Sheets" : type === "docs" ? "Docs" : "Drive";
    return `<button class="source-card${index >= visibleLimit ? " source-extra" : ""}" type="button" data-source-url="${escapeHtml(source.url || source.webViewLink || "")}">
      <span class="source-badge source-${escapeHtml(type)}">${escapeHtml(label)}</span>
      <span class="source-copy"><strong>${escapeHtml(source.title || source.name || "Source")}</strong>${source.meta ? `<small>${escapeHtml(source.meta)}</small>` : ""}</span>
      <span class="source-open">${icon("external", 12)}</span>
    </button>`;
  }).join("");
  const more = sources.length > visibleLimit ? `<button class="source-more" type="button" data-toggle-sources="${messageId}" data-collapsed-label="View ${sources.length - visibleLimit} more sources" data-expanded-label="Show fewer sources">View ${sources.length - visibleLimit} more sources</button>` : "";
  return `<div class="answer-sources" data-source-group="${messageId}"><div class="sources-heading"><strong>Sources</strong><span>${sources.length} authorised source${sources.length === 1 ? "" : "s"}</span></div><div class="source-list">${buttons}</div>${more}</div>`;
}

function renderGenericConversation() {
  const conversation = state.activeConversation || { title: "AI Brain conversation" };
  elements.viewRoot.innerHTML = `<section class="conversation-view"><div class="conversation-container">${conversationHeader({ title: conversation.title || "AI Brain conversation", meta: `Workspace conversation · ${state.sourceScope === "both" ? "Internal and external sources" : state.sourceScope === "workspace" ? "MRANTI Workspace sources" : "External sources"}`, badges: [] })}<div class="chat-thread">${state.conversationMessages.map(renderMessage).join("")}${state.loading ? `<article class="assistant-message loading-message"><img src="mranti-workspace-mark.png" alt=""/><div><strong>AI Brain is working</strong><p>Searching authorised sources and preparing an evidence-backed response.</p></div></article>` : ""}</div>${renderComposer({ id: "generic-composer", placeholder: "Continue the conversation…" })}</div></section>`;
  bindComposer("generic-composer");
  elements.viewRoot.querySelectorAll("[data-source-url]").forEach(button => button.addEventListener("click", () => window.open(button.dataset.sourceUrl, "_blank", "noopener,noreferrer")));
  elements.viewRoot.querySelectorAll("[data-toggle-sources]").forEach(button => button.addEventListener("click", () => {
    const group = elements.viewRoot.querySelector(`[data-source-group="${CSS.escape(button.dataset.toggleSources)}"]`);
    const expanded = group?.classList.toggle("expanded");
    button.textContent = expanded ? button.dataset.expandedLabel : button.dataset.collapsedLabel;
  }));
}

function renderMessage(message) {
  if (message.role === "user") return `<div class="user-message">${escapeHtml(message.text)}${message.attachments?.length ? message.attachments.map(renderAttachmentPreview).join("") : ""}<span class="message-time">Submitted securely</span></div>`;
  if (message.role === "error") return `<article class="assistant-message error-message"><img src="mranti-workspace-mark.png" alt=""/><div><strong>AI Brain needs attention</strong><p>${escapeHtml(message.text)}</p></div></article>`;
  return `<article class="assistant-message"><img src="mranti-workspace-mark.png" alt=""/><div><div class="assistant-answer">${formatAnswer(message.text)}</div>${renderAnswerSources(message)}</div></article>`;
}

function formatAnswer(text) { return escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>").replace(/^/, "<p>").replace(/$/, "</p>"); }

function renderCancelledView() {
  elements.viewRoot.innerHTML = `<section class="conversation-view"><div class="conversation-container">${conversationHeader({ title: `${currentPresentation()?.name || "Presentation"} validation`, meta: "Workspace conversation · Validation cancelled", badges: [] })}<div class="cancelled-state"><h2>Validation cancelled</h2><p>The presentation and permissions remain unchanged. Start a new validation when you are ready.</p><button class="report-action primary" type="button" data-action="return-home">Return to AI Brain Home</button></div></div></section>`;
  elements.viewRoot.querySelector("[data-action='return-home']")?.addEventListener("click", resetConversation);
}

function renderErrorView(message) {
  elements.viewRoot.innerHTML = `<section class="conversation-view"><div class="conversation-container">${conversationHeader({ title: "AI Brain needs attention", meta: "Workspace conversation", badges: [] })}<div class="cancelled-state error-state" role="alert"><h2>The request could not be completed</h2><p>${escapeHtml(message || "AI Brain could not complete this request. Your Workspace content remains unchanged.")}</p><div class="state-actions"><button class="report-action primary" type="button" data-action="return-home">Return to AI Brain Home</button></div></div></div></section>`;
  elements.viewRoot.querySelector("[data-action='return-home']")?.addEventListener("click", resetConversation);
}

function renderConversationLibrary() {
  const items = state.recentConversations.slice(0, Number(config.maxRecentConversations || 12));
  elements.viewRoot.innerHTML = `<section class="library-view" aria-labelledby="conversation-library-title">
    <div class="library-page-head">
      <div><div class="library-eyebrow">MRANTI Workspace</div><h1 id="conversation-library-title">Conversations</h1><p>Continue recent AI Brain work and validation activity saved to your authorised account.</p></div>
      <button class="report-action primary library-new-button" type="button" data-action="new-conversation">${icon("plus", 16)} New conversation</button>
    </div>
    <div class="conversation-library-grid">
      ${items.length ? items.map(item => {
        const title = cleanConversationTitle(item);
        const type = item.type === "validation" ? "Validation" : "Conversation";
        const status = item.status === "complete" ? "Complete" : item.status === "running" ? "In progress" : "Saved";
        return `<button class="conversation-library-card" type="button" data-library-conversation="${escapeHtml(item.id)}">
          <span class="conversation-library-icon">${icon(item.type === "validation" ? "shield" : "message", 18)}</span>
          <span class="conversation-library-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(type)} · ${escapeHtml(status)}</small></span>
          <span class="conversation-library-arrow">${icon("chevronRight", 16)}</span>
        </button>`;
      }).join("") : `<div class="conversation-library-empty"><img src="mranti-workspace-mark.png" alt=""/><h2>No saved conversations yet</h2><p>Start a conversation and it will appear here automatically.</p></div>`}
    </div>
  </section>`;
  elements.viewRoot.querySelector("[data-action='new-conversation']")?.addEventListener("click", resetConversation);
  elements.viewRoot.querySelectorAll("[data-library-conversation]").forEach(button => button.addEventListener("click", () => navigate({ name: "conversation", id: button.dataset.libraryConversation })));
}

function renderEmptyLibrary(title, message) {
  elements.viewRoot.innerHTML = `<section class="conversation-view"><div class="conversation-container"><div class="generic-conversation"><div><img src="mranti-workspace-mark.png" alt=""/><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><button class="report-action primary" type="button" data-action="return-home">Return to AI Brain Home</button></div></div></div></section>`;
  elements.viewRoot.querySelector("[data-action='return-home']")?.addEventListener("click", resetConversation);
}

function openModal(content, { labelledBy = "modal-title", initialFocus = null } = {}) {
  lastFocusedElement = document.activeElement;
  elements.modalRoot.innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}">${content}</section></div>`;
  const backdrop = elements.modalRoot.querySelector(".modal-backdrop");
  backdrop.addEventListener("mousedown", event => { if (event.target === backdrop) closeModal(); });
  elements.modalRoot.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeModal));
  elements.modalRoot.onkeydown = trapModalFocus;
  requestAnimationFrame(() => (initialFocus ? elements.modalRoot.querySelector(initialFocus) : elements.modalRoot.querySelector("button, input, textarea, select"))?.focus());
}

function closeModal() { elements.modalRoot.innerHTML = ""; lastFocusedElement?.focus?.(); lastFocusedElement = null; }
function trapModalFocus(event) {
  if (event.key === "Escape") { closeModal(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...elements.modalRoot.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]')];
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function openLinkModal() {
  openModal(`<div class="modal-head"><div><h2 id="modal-title">Add Google Workspace link</h2><p>Paste a Google Slides, Docs, Sheets, Drive file or Drive folder link.</p></div><button class="inspector-close" type="button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div><div class="modal-body"><label for="workspace-link" class="claim-label">Google Workspace URL</label><input id="workspace-link" style="width:100%;height:46px;margin-top:8px;padding:0 12px;border:1px solid #c9daf7;border-radius:9px" type="url" placeholder="https://docs.google.com/presentation/d/…" /></div><div class="modal-actions"><button type="button" data-close-modal>Cancel</button><button class="primary" id="attach-link-button" type="button">Check access and attach</button></div>`, { initialFocus: "#workspace-link" });
  elements.modalRoot.querySelector("#attach-link-button").addEventListener("click", async () => {
    const input = elements.modalRoot.querySelector("#workspace-link");
    const parsed = parseGoogleWorkspaceUrl(input.value.trim());
    if (!parsed.supported) { input.setAttribute("aria-invalid", "true"); return showToast("Enter a supported Google Workspace URL.", "error"); }
    const value = input.value.trim(); closeModal(); await attachWorkspaceUrl(value);
  });
}

function openAttachmentModal() {
  openModal(`<div class="modal-head"><div><h2 id="modal-title">Attach Workspace content</h2><p>Attach a Google Workspace link. AI Brain will confirm your existing access before reading anything.</p></div><button class="inspector-close" type="button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div><div class="modal-body"><button class="revision-box recommended" id="attachment-link-option" type="button" style="text-align:left;cursor:pointer;width:100%"><h3>Google Workspace link</h3><p style="font-size:11px;line-height:1.55;color:#52627c">Attach a Slides, Docs, Sheets, Drive file or Drive folder URL.</p></button></div><div class="modal-actions"><button type="button" data-close-modal>Cancel</button></div>`);
  elements.modalRoot.querySelector("#attachment-link-option").addEventListener("click", () => { closeModal(); openLinkModal(); });
}

function handleServiceError(error) {
  console.error(error);
  if (error?.authError) {
    clearSavedAccessToken();
    showLogin(error.message || "Your Workspace authorisation expired. Continue with Google to reconnect.", true);
    return;
  }
  showToast(error?.name === "AbortError" ? "The request timed out. Try a narrower request." : error.message || "The request could not be completed.", "error");
}

elements.signInButton?.addEventListener("click", signIn);
elements.signOutButton?.addEventListener("click", signOut);
elements.profileButton?.addEventListener("click", event => { event.stopPropagation(); togglePopover(elements.profileButton, elements.profileMenu); });
elements.mobileNavButton?.addEventListener("click", event => {
  event.stopPropagation();
  const open = !document.body.classList.contains("top-nav-open");
  document.body.classList.toggle("top-nav-open", open);
  elements.mobileNavButton.setAttribute("aria-expanded", String(open));
});
elements.topNavOverlay?.addEventListener("click", closeMobilePanels);
elements.sidebarOverlay?.addEventListener("click", closeMobilePanels);
elements.sidebarCollapse?.addEventListener("click", () => { state.sidebarCollapsed = !state.sidebarCollapsed; sessionSet("mranti_ai_brain_sidebar_collapsed", String(state.sidebarCollapsed)); updateSidebarState(); });
elements.newConversation?.addEventListener("click", resetConversation);
elements.topNewConversation?.addEventListener("click", resetConversation);
elements.brandHome?.addEventListener("click", () => navigate({ name: "home" }));
document.querySelectorAll("[data-route]").forEach(button => button.addEventListener("click", () => navigate({ name: button.dataset.route })));
document.addEventListener("click", event => {
  if (![elements.profileMenu, elements.profileButton].some(node => node?.contains(event.target))) closePopovers();
  if (!document.querySelector("#system-navbar")?.contains(event.target)) closeMobilePanels();
});
window.addEventListener("hashchange", handleRoute);
window.addEventListener("keydown", event => { if (event.key === "Escape") { closePopovers(); closeMobilePanels(); if (elements.modalRoot.innerHTML) closeModal(); } });
if (!location.hash) history.replaceState(null, "", "#workspace");
initialiseAuth();
