import { initializeApp } from "./lib/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from "./lib/firebase-auth.js";
import {
  initializeFirestore,
  saveToFirestore,
  getFirestoreHistory,
  updateFirestoreSummary,
  deleteFirestoreSummary
} from "./lib/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhnDptuvQnXLwFUkvNi8h-YKXuSj8DSSI",
  authDomain: "t-c-summarizer.firebaseapp.com",
  projectId: "t-c-summarizer",
  storageBucket: "t-c-summarizer.firebasestorage.app",
  messagingSenderId: "562989021121",
  appId: "1:562989021121:web:d9cc0e28e5279d78e7a140"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

let db = null; // Firestore database - initialized after auth is ready

// Initialize Firestore
initializeFirestore(firebaseApp).then(database => {
  db = database;
  console.log('Firestore initialized');
}).catch(error => {
  console.error('Failed to initialize Firestore:', error);
});

// Get DOM elements
const summarizeButton = document.getElementById("summarize");
const statusElement = document.getElementById("status");
const resultElement = document.getElementById("result");
const summarySection = document.getElementById("summary-section");
const askButton = document.getElementById("ask-button");
const questionInput = document.getElementById("question-input");
const answerResult = document.getElementById("answer-result");
const askModeSection = document.getElementById("ask-mode");
const backButton = document.getElementById("back-button");
const mainTitle = document.getElementById("main-title");
const suggestionButtons = document.querySelectorAll(".suggestion-button");
const suggestionsArea = document.getElementById("suggestions-area");
const authContainer = document.getElementById("auth-container");
const appContent = document.getElementById("app-content");
const logoutButton = document.getElementById("logout-button");
const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");
const authToggleButton = document.getElementById("auth-toggle-button");
const authToggleText = document.getElementById("auth-toggle-text");
const authMessage = document.getElementById("auth-message");
const authSubtitle = document.getElementById("auth-subtitle");
const signinEmail = document.getElementById("signin-email");
const signinPassword = document.getElementById("signin-password");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupConfirmPassword = document.getElementById("signup-confirm-password");
const summaryTabButton = document.getElementById("summary-tab");
const historyTabButton = document.getElementById("history-tab");
const summaryView = document.getElementById("summary-view");
const historyView = document.getElementById("history-view");
const historyList = document.getElementById("history-list");
const historyDetail = document.getElementById("history-detail");
const detailView = document.getElementById("detail-view");
const backToHistoryButton = document.getElementById("back-to-history");
const detailTitle = document.getElementById("detail-title");
const detailMeta = document.getElementById("detail-meta");
const detailSummary = document.getElementById("detail-summary");
const detailQA = document.getElementById("detail-qa");

let isSignupMode = false;
const defaultStatus = "Ready to summarize.";
let pendingAuthNotice = null;
const HISTORY_LIMIT = 30;
let historyEntries = [];
let activeHistoryId = null;
let currentView = "summary";
let currentSessionHistoryId = null;
let detailViewHistoryId = null;

auth.useDeviceLanguage();

function setAuthMode(mode) {
  isSignupMode = mode === "signup";

  if (signinForm && signupForm) {
    signinForm.style.display = isSignupMode ? "none" : "flex";
    signupForm.style.display = isSignupMode ? "flex" : "none";
  }

  if (authToggleText) {
    authToggleText.textContent = isSignupMode ? "Already have an account?" : "Don't have an account?";
  }

  if (authToggleButton) {
    authToggleButton.textContent = isSignupMode ? "Sign in" : "Create account";
  }

  if (authSubtitle) {
    authSubtitle.textContent = isSignupMode
      ? "Create an account to get started."
      : "Sign in to access your Terms & Conditions assistant.";
  }

  setAuthMessage();
}

function setAuthMessage(type, message = "") {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = message;
  authMessage.classList.remove("error", "success");

  if (type) {
    authMessage.classList.add(type);
  }
}

function queueAuthNotice(type, message) {
  pendingAuthNotice = { type, message };
}

function applyPendingAuthNotice() {
  if (pendingAuthNotice) {
    setAuthMessage(pendingAuthNotice.type, pendingAuthNotice.message);
    pendingAuthNotice = null;
  } else {
    setAuthMessage();
  }
}

function switchView(view) {
  const showHistory = view === "history";
  currentView = showHistory ? "history" : "summary";

  summaryTabButton?.classList.toggle("active", !showHistory);
  historyTabButton?.classList.toggle("active", showHistory);

  if (summaryView) {
    summaryView.style.display = showHistory ? "none" : "flex";
  }

  if (historyView) {
    historyView.style.display = showHistory ? "flex" : "none";
  }

  if (showHistory) {
    renderHistoryList();
    renderHistoryDetail(activeHistoryId);
    // Only expand if there's actual history to display
    if (historyEntries.length > 0) {
      expandPopup();
    }
  } else {
    // Going back to summary view
    // Check if there's a summary displayed
    if (summarySection && summarySection.style.display === "none") {
      // No summary displayed, collapse popup
      collapsePopup();
    }
  }
}

function expandPopup() {
  const popupElement = document.querySelector('.popup');
  if (popupElement) {
    popupElement.classList.add("expanded");
  }
}

function collapsePopup() {
  const popupElement = document.querySelector('.popup');
  if (popupElement) {
    popupElement.classList.remove("expanded");
  }
}

function showDetailView(entryId) {
  const entry = historyEntries.find(item => item.id === entryId);
  if (!entry) return;

  detailViewHistoryId = entryId;
  expandPopup();

  // Set title and meta
  if (detailTitle) {
    detailTitle.textContent = entry.title || "Untitled";
  }

  if (detailMeta) {
    const host = extractHostname(entry.url);
    const meta = `${host || "Unknown"} • ${formatTimestamp(entry.createdAt)}`;
    detailMeta.textContent = meta;
  }

  // Set summary
  if (detailSummary) {
    detailSummary.innerHTML = entry.summary || "<p>No summary available</p>";
  }

  // Set Q&A
  if (detailQA) {
    if (!entry.questions || entry.questions.length === 0) {
      detailQA.innerHTML = '<p class="qa-empty">No questions asked yet. Use the summarize tab to ask questions about this summary.</p>';
    } else {
      detailQA.innerHTML = entry.questions.map(qa => `
        <div class="detail-qa-item">
          <div class="detail-qa-question">Q: ${escapeHtml(qa.question)}</div>
          <div class="detail-qa-answer">${qa.answer || "No answer available"}</div>
        </div>
      `).join("");
    }
  }

  // Hide history view and show detail view
  if (appContent) appContent.style.display = "none";
  if (detailView) detailView.style.display = "flex";
}

function hideDetailView() {
  detailViewHistoryId = null;
  if (detailView) detailView.style.display = "none";
  if (appContent) appContent.style.display = "flex";
  expandPopup();
}

function generateId(prefix = "entry") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimestamp(isoString) {
  if (!isoString) {
    return "";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function extractHostname(url) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function createTextPreview(html, maxLength = 140) {
  const temp = document.createElement("div");
  temp.innerHTML = html ?? "";
  const text = temp.textContent?.trim() ?? "";
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
}

function sanitizeStoredHtml(html) {
  const trimmed = (html ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const container = document.createElement("div");
  container.innerHTML = trimmed;
  container.querySelectorAll("script, style").forEach((node) => node.remove());
  return container.innerHTML;
}

function normalizeHistorySummaryHtml(summaryHtml) {
  const sanitized = sanitizeStoredHtml(summaryHtml);
  if (!sanitized) {
    return '<p class="history-summary-empty">No summary saved for this session.</p>';
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = sanitized;

  if (wrapper.querySelector(".summary-container")) {
    return wrapper.innerHTML;
  }

  const summaryContainer = document.createElement("div");
  summaryContainer.className = "summary-container";
  summaryContainer.innerHTML = wrapper.innerHTML;
  return summaryContainer.outerHTML;
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function persistHistory() {
  // Save to local storage for quick access
  chrome.storage.local.set({ summaryHistory: historyEntries });
  
  // Save to Firestore if user is logged in
  if (auth.currentUser && db) {
    const userId = auth.currentUser.uid;
    historyEntries.slice(0, 5).forEach(entry => {
      saveToFirestore(db, userId, {
        title: entry.title,
        url: entry.url,
        summary: entry.summary,
        questions: entry.questions || [],
        createdAt: entry.createdAt
      }).catch(error => {
        console.error('Error syncing to Firestore:', error);
      });
    });
  }
}

function renderHistoryList() {
  if (!historyList) {
    return;
  }

  if (!historyEntries.length) {
    historyList.innerHTML = '<p class="history-empty">No summaries yet.</p>';
    return;
  }

  historyList.innerHTML = "";

  historyEntries.forEach((entry, index) => {
    if (!Array.isArray(entry.questions)) {
      entry.questions = [];
    }

    const container = document.createElement("div");
    const host = extractHostname(entry.url);
    const questionCount = entry.questions.length;
    const previewText = createTextPreview(entry.summary ?? "");
    const formattedPreview = previewText ? escapeHtml(previewText) : "Tap to view full summary";
    const formattedTime = formatTimestamp(entry.createdAt);

    container.className = "history-entry";
    container.dataset.index = String(index);
    container.dataset.id = entry.id;

    const headingHtml = `
      <div class="history-entry-content">
        <div class="history-entry-header">
          <span class="history-entry-time">${formattedTime}</span>
        </div>
        <div class="history-entry-title">
          ${escapeHtml(entry.title || host || "Untitled")}
        </div>
        <div class="history-entry-footer">
          <div class="history-entry-meta">
            <span>${host ? escapeHtml(host) : "Unknown"}</span>
            <span>·</span>
            <span>${questionCount} Q&amp;A</span>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = headingHtml;

    const content = document.createElement("div");
    content.className = "history-content";
    content.dataset.index = String(index);
    content.dataset.id = entry.id;
    content.style.display = "none";

    const summaryMarkup = normalizeHistorySummaryHtml(entry.summary);

    const qaMarkup = questionCount
      ? entry.questions
          .map((qa) => {
            const questionText = escapeHtml(qa.question ?? "");
            const answerMarkup = sanitizeStoredHtml(qa.answer) || "<p>No answer recorded.</p>";
            const askedAt = formatTimestamp(qa.askedAt);
            return `
              <div class="history-qa-item">
                <div class="history-qa-question">Q: ${questionText}</div>
                <div class="history-qa-answer">${answerMarkup}</div>
                <div class="history-qa-meta">${askedAt}</div>
              </div>
            `;
          })
          .join("")
      : '<p class="history-qa-empty">No questions asked during this session.</p>';

    const metaParts = [formattedTime];
    if (host) {
      metaParts.push(escapeHtml(host));
    }
    const metaHtml = metaParts.filter(Boolean).join(" · ");
    const pageLink = entry.url
      ? `<a class="history-content-link" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">Open page</a>`
      : "";

    content.innerHTML = `
      <div class="history-content-section">
        <div class="history-content-header">
          <div class="history-content-title-group">
            <h3 class="history-content-title">${escapeHtml(entry.title || host || "Untitled page")}</h3>
            <p class="history-content-meta">${metaHtml}</p>
          </div>
          ${pageLink}
        </div>
        <div class="history-summary-body">${summaryMarkup}</div>
      </div>
      <div class="history-content-section history-content-qa">
        <div class="history-content-header">
          <h4 class="history-content-subtitle">Conversation</h4>
        </div>
        <div class="history-qa-list">${qaMarkup}</div>
      </div>
    `;

    container.appendChild(content);
    historyList.appendChild(container);
  });
}

function renderHistoryDetail(entryId) {
  if (!historyDetail) {
    return;
  }

  if (!historyEntries.length) {
    historyDetail.innerHTML = '<p class="history-empty">No summaries yet. Summaries you create will show up here.</p>';
    return;
  }

  const entry = historyEntries.find((item) => item.id === entryId) ?? historyEntries[0];
  if (!entry) {
    historyDetail.innerHTML = '<p class="history-empty">Select a summary to view details.</p>';
    return;
  }

  if (!Array.isArray(entry.questions)) {
    entry.questions = [];
  }

  const host = extractHostname(entry.url);
  const summaryMarkup = (entry.summary ?? "").includes("summary-container")
    ? entry.summary ?? ""
    : `<div class="summary-container">${entry.summary ?? ""}</div>`;

  const qaMarkup = entry.questions.length
    ? entry.questions
        .map((qa) => `
          <div class="history-qa-item">
            <div class="history-qa-question">Q: ${escapeHtml(qa.question ?? "")}</div>
            <div class="history-qa-answer">${qa.answer ?? "No answer recorded."}</div>
            <div class="history-qa-meta">${formatTimestamp(qa.askedAt)}</div>
          </div>
        `)
        .join("")
    : '<p class="history-empty">No questions asked during this session.</p>';

  const metaParts = [formatTimestamp(entry.createdAt)];
  if (host) {
    metaParts.push(escapeHtml(host));
  }
  if (entry.url) {
    const safeUrl = escapeHtml(entry.url);
    metaParts.push(`<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open page</a>`);
  }

  historyDetail.innerHTML = `
    <div class="history-detail-header">
      <div>
        <p class="history-detail-title">${escapeHtml(entry.title || host || "Untitled page")}</p>
        <p class="history-detail-meta">${metaParts.filter(Boolean).join(" · ")}</p>
      </div>
    </div>
    <div class="history-detail-summary">${summaryMarkup}</div>
    <div class="history-detail-qa">
      <h4>Conversation</h4>
      ${qaMarkup}
    </div>
  `;
}

function setActiveHistoryEntry(entryId) {
  activeHistoryId = entryId;
  renderHistoryList();
  renderHistoryDetail(entryId);
}

function addHistoryEntry({ title, url, summaryHtml }) {
  const entry = {
    id: generateId("summary"),
    title: title?.trim() || extractHostname(url) || "Untitled page",
    url: url ?? "",
    summary: summaryHtml ?? "",
    createdAt: new Date().toISOString(),
    questions: []
  };

  historyEntries = [entry, ...historyEntries].slice(0, HISTORY_LIMIT);
  currentSessionHistoryId = entry.id;
  persistHistory();
  setActiveHistoryEntry(entry.id);
  return entry.id;
}

function appendConversationToHistory(entryId, question, answerHtml) {
  if (!entryId) {
    return;
  }

  const entry = historyEntries.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  if (!Array.isArray(entry.questions)) {
    entry.questions = [];
  }

  entry.questions.push({
    id: generateId("qa"),
    question,
    answer: answerHtml,
    askedAt: new Date().toISOString()
  });

  persistHistory();

  if (currentView === "history" && entry.id === activeHistoryId) {
    renderHistoryDetail(entry.id);
  }

  renderHistoryList();
}

function loadHistory() {
  // First try to load from Firestore if user is logged in
  if (auth.currentUser && db) {
    const userId = auth.currentUser.uid;
    getFirestoreHistory(db, userId).then(result => {
      if (result.success && result.history.length > 0) {
        historyEntries = result.history.slice(0, HISTORY_LIMIT);
      } else {
        // Fall back to local storage if Firestore is empty
        chrome.storage.local.get(["summaryHistory"], ({ summaryHistory }) => {
          historyEntries = Array.isArray(summaryHistory) ? summaryHistory.slice(0, HISTORY_LIMIT) : [];
          loadHistoryUI();
        });
        return;
      }
      loadHistoryUI();
    }).catch(error => {
      console.error('Error loading from Firestore:', error);
      // Fall back to local storage on error
      chrome.storage.local.get(["summaryHistory"], ({ summaryHistory }) => {
        historyEntries = Array.isArray(summaryHistory) ? summaryHistory.slice(0, HISTORY_LIMIT) : [];
        loadHistoryUI();
      });
    });
  } else {
    // Load from local storage if user is not logged in
    chrome.storage.local.get(["summaryHistory"], ({ summaryHistory }) => {
      historyEntries = Array.isArray(summaryHistory) ? summaryHistory.slice(0, HISTORY_LIMIT) : [];
      loadHistoryUI();
    });
  }
}

function loadHistoryUI() {
  if (!historyEntries.length) {
    activeHistoryId = null;
    currentSessionHistoryId = null;
    renderHistoryList();
    renderHistoryDetail(null);
    return;
  }

  if (!activeHistoryId || !historyEntries.some((entry) => entry.id === activeHistoryId)) {
    activeHistoryId = historyEntries[0].id;
  }

  renderHistoryList();
  renderHistoryDetail(activeHistoryId);
}

switchView("summary");
loadHistory();

summaryTabButton?.addEventListener("click", () => switchView("summary"));
historyTabButton?.addEventListener("click", () => switchView("history"));

historyList?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  // Check if "Read Full Summary" button was clicked (::after pseudo-element)
  const entry = event.target.closest(".history-entry");
  if (!entry || !historyList.contains(entry)) {
    return;
  }

  const entryId = entry.dataset?.id;
  if (!entryId) {
    return;
  }

  // Show detail view for this entry
  showDetailView(entryId);
});

// Back button in detail view
backToHistoryButton?.addEventListener("click", () => {
  hideDetailView();
});

// Support and Feedback Button Handlers
const supportBtn = document.getElementById("support-btn");
const feedbackBtn = document.getElementById("feedback-btn");
const supportPage = document.getElementById("support-page");
const feedbackPage = document.getElementById("feedback-page");

// Support the Developer Page
supportBtn?.addEventListener("click", () => {
  showSupportPage();
});

document.getElementById("back-from-support")?.addEventListener("click", () => {
  hideSupportPage();
});

// Support option buttons
document.getElementById("github-support-btn")?.addEventListener("click", () => {
  // Update with your actual GitHub repo URL
  chrome.tabs.create({ url: "https://github.com/neyabansari443-max/T-C-Summarizer" });
});

document.getElementById("coffee-support-btn")?.addEventListener("click", () => {
  // Update with your actual Buy Me A Coffee URL
  chrome.tabs.create({ url: "https://buymeacoffee.com/neyab" });
});

document.getElementById("review-support-btn")?.addEventListener("click", () => {
  // Update with your actual Chrome Web Store extension URL
  chrome.tabs.create({ url: "https://chrome.google.com/webstore" });
});

// Provide Feedback Page
feedbackBtn?.addEventListener("click", () => {
  showFeedbackPage();
});

document.getElementById("back-from-feedback")?.addEventListener("click", () => {
  hideFeedbackPage();
});

document.getElementById("submit-feedback-btn")?.addEventListener("click", async () => {
  const type = document.getElementById("feedback-type")?.value;
  const message = document.getElementById("feedback-message")?.value;
  const email = document.getElementById("feedback-email")?.value;
  const statusElement = document.getElementById("feedback-status");

  if (!type || !message) {
    setFeedbackStatus("error", "Please fill in all required fields");
    return;
  }

  setFeedbackStatus("loading", "Sending feedback...");

  try {
    // Send feedback via Formspree using FormData (proper for Formspree)
    const feedbackData = new FormData();
    feedbackData.append("email", email || "Not provided");
    feedbackData.append("feedback_type", type);
    feedbackData.append("message", message);
    feedbackData.append("timestamp", new Date().toISOString());

    const response = await fetch("https://formspree.io/f/xeopqej1", {
      method: "POST",
      body: feedbackData
    });

    console.log("Formspree response:", response.status, response.statusText);

    if (response.ok || response.status === 200 || response.status === 201) {
      setFeedbackStatus("success", "Thank you for your feedback! 🙏 Email sent successfully!");
      
      // Reset form after 2 seconds
      setTimeout(() => {
        document.getElementById("feedback-type").value = "";
        document.getElementById("feedback-message").value = "";
        document.getElementById("feedback-email").value = "";
        setFeedbackStatus("", "");
        hideFeedbackPage();
      }, 2000);
    } else {
      console.error("Formspree error:", response.status, response.statusText);
      setFeedbackStatus("error", `Error: ${response.status} - Please try again`);
    }
  } catch (error) {
    console.error("Error submitting feedback:", error);
    setFeedbackStatus("error", "Network error. Please check your connection.");
  }
});

function showSupportPage() {
  appContent.style.display = "none";
  supportPage.style.display = "flex";
  collapsePopup();
}

function hideSupportPage() {
  supportPage.style.display = "none";
  appContent.style.display = "flex";
}

function showFeedbackPage() {
  appContent.style.display = "none";
  feedbackPage.style.display = "flex";
  collapsePopup();
}

function hideFeedbackPage() {
  feedbackPage.style.display = "none";
  appContent.style.display = "flex";
}

function setFeedbackStatus(type, message) {
  const statusElement = document.getElementById("feedback-status");
  if (!statusElement) return;

  if (!message) {
    statusElement.textContent = "";
    statusElement.className = "";
    return;
  }

  statusElement.textContent = message;
  statusElement.className = type ? `feedback-status ${type}` : "";
}

function resetSummarizerState(statusMessage = defaultStatus) {
  if (summarySection) {
    summarySection.style.display = "none";
  }

  if (summarizeButton) {
    summarizeButton.style.display = "block";
  }

  if (backButton) {
    backButton.style.display = "none";
  }

  if (mainTitle) {
    mainTitle.style.display = "block";
  }

  if (askModeSection) {
    askModeSection.style.display = "none";
  }

  if (suggestionsArea) {
    suggestionsArea.style.display = "none";
  }

  if (resultElement) {
    resultElement.innerHTML = "";
  }

  if (answerResult) {
    answerResult.innerHTML = "";
  }

  if (questionInput) {
    questionInput.value = "";
  }

  updateStatus(statusMessage);
}

function formatAuthError(error) {
  const code = error?.code ?? "";

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
      return "Account not found. Please create one.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    default:
      return "Something went wrong. Please try again.";
  }
}

setAuthMode("signin");

authToggleButton?.addEventListener("click", () => {
  setAuthMode(isSignupMode ? "signin" : "signup");
});

signinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = signinEmail?.value.trim();
  const password = signinPassword?.value ?? "";

  if (!email || !password) {
    setAuthMessage("error", "Please enter your email and password.");
    return;
  }

  setAuthMessage(null, "Signing in...");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setAuthMessage("success", "Signed in successfully.");
    if (signinPassword) {
      signinPassword.value = "";
    }
  } catch (error) {
    setAuthMessage("error", formatAuthError(error));
  }
});

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = signupEmail?.value.trim();
  const password = signupPassword?.value ?? "";
  const confirm = signupConfirmPassword?.value ?? "";

  if (!email || !password || !confirm) {
    setAuthMessage("error", "Please fill in all fields.");
    return;
  }

  if (password !== confirm) {
    setAuthMessage("error", "Passwords do not match.");
    return;
  }

  setAuthMessage(null, "Creating your account...");

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    if (signupEmail) {
      signupEmail.value = "";
    }
    if (signupPassword) {
      signupPassword.value = "";
    }
    if (signupConfirmPassword) {
      signupConfirmPassword.value = "";
    }
  } catch (error) {
    setAuthMessage("error", formatAuthError(error));
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (user.emailVerified) {
      pendingAuthNotice = null;

      if (authContainer) {
        authContainer.style.display = "none";
      }

      if (appContent) {
        appContent.style.display = "flex";
      }

      if (logoutButton) {
        logoutButton.style.display = "inline-flex";
      }

      switchView("summary");
      loadHistory();
      setAuthMessage();
      setAuthMode("signin");
      updateStatus(defaultStatus);
    } else {
      try {
        await sendEmailVerification(user);
        queueAuthNotice(
          "error",
          `Please verify your email (${user.email ?? "your account"}). We've sent a verification link. Once verified, sign in again.`
        );
      } catch (error) {
        console.error("Verification email error:", error);
        queueAuthNotice(
          "error",
          "Please verify your email. We couldn't send the verification email automatically. Try again later."
        );
      }

      try {
        await signOut(auth);
      } catch (error) {
        console.error("Auto sign-out error:", error);
      }
    }
  } else {
    if (appContent) {
      appContent.style.display = "none";
    }

    if (authContainer) {
      authContainer.style.display = "flex";
    }

    if (logoutButton) {
      logoutButton.style.display = "none";
    }

    if (signinEmail) {
      signinEmail.value = "";
    }

    if (signinPassword) {
      signinPassword.value = "";
    }

    if (signupEmail) {
      signupEmail.value = "";
    }

    if (signupPassword) {
      signupPassword.value = "";
    }

    if (signupConfirmPassword) {
      signupConfirmPassword.value = "";
    }

    currentSessionHistoryId = null;
    switchView("summary");
    setAuthMode("signin");
    resetSummarizerState("Please sign in to continue.");
    applyPendingAuthNotice();
  }
});

function updateStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function renderSummary(text) {
  const safeText = text ?? "";
  const markup = safeText.includes("summary-container")
    ? safeText
    : `<div class="summary-container">${safeText}</div>`;

  if (resultElement) {
    resultElement.innerHTML = markup;
  }

  // Expand popup when displaying summary
  expandPopup();

  return markup;
}

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const suggestionText = button.textContent?.trim();
    if (!suggestionText || !questionInput) {
      return;
    }

    questionInput.value = suggestionText;
    questionInput.focus();
  });
});

summarizeButton.addEventListener("click", async () => {
  if (!auth.currentUser) {
    updateStatus("Please sign in to summarize.");
    return;
  }

  // Set button to loading state
  summarizeButton.classList.add("loading");
  summarizeButton.disabled = true;
  summarizeButton.textContent = "Summarizing...";

  // Show loading status message
  const statusMsg = document.createElement("div");
  statusMsg.className = "status-message loading";
  statusMsg.innerHTML = '<span class="spinner"></span>Summarizing page content...';
  summarizeButton.parentElement.insertBefore(statusMsg, summarizeButton.nextSibling);

  currentSessionHistoryId = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error("Unable to locate the active tab.");
    }

    // Update status - step 1
    statusMsg.innerHTML = '<span class="spinner"></span>Extracting content...';

    const response = await chrome.tabs.sendMessage(tab.id, { type: "SUMMARIZE_PAGE" });
    const summaryText = response?.summary ?? "No summary available yet.";
    const isErrorResponse = typeof summaryText === "string" && summaryText.toLowerCase().startsWith("error");

    if (isErrorResponse) {
      // Error state
      statusMsg.classList.remove("loading");
      statusMsg.classList.add("error");
      statusMsg.innerHTML = `⚠️ ${summaryText}`;
      
      if (resultElement) {
        resultElement.innerHTML = `<div class="qa-error">${summaryText}</div>`;
      }
      if (summarySection) {
        summarySection.style.display = "block";
      }
      
      // Reset button
      summarizeButton.classList.remove("loading");
      summarizeButton.disabled = false;
      summarizeButton.textContent = "Summarize this page";
      
      if (backButton) {
        backButton.style.display = "none";
      }
      if (askModeSection) {
        askModeSection.style.display = "none";
      }
      if (suggestionsArea) {
        suggestionsArea.style.display = "none";
      }
      updateStatus(summaryText);
      return;
    }

    // Update status - step 2
    statusMsg.innerHTML = '<span class="spinner"></span>Processing summary...';

    const summaryMarkup = renderSummary(summaryText);

    if (summarySection) {
      summarySection.style.display = "block";
    }

    summarizeButton.style.display = "none";

    if (backButton) {
      backButton.style.display = "block";
    }

    if (askModeSection) {
      askModeSection.style.display = "flex";
    }

    if (suggestionsArea) {
      suggestionsArea.style.display = "flex";
    }

    questionInput?.focus();

    if (mainTitle) {
      mainTitle.style.display = "none";
    }

    addHistoryEntry({
      title: tab.title,
      url: tab.url,
      summaryHtml: summaryMarkup
    });

    // Success state
    statusMsg.classList.remove("loading");
    statusMsg.classList.add("success");
    statusMsg.innerHTML = "✓ Summary complete. Reload the tab to see the highlighted summary!";
    
    updateStatus("Summary complete. Saved to history.");
    
    // Remove status message after 4 seconds
    setTimeout(() => {
      statusMsg.remove();
    }, 4000);
    
  } catch (error) {
    console.error("Popup error:", error);
    
    // Error state on catch
    statusMsg.classList.remove("loading");
    statusMsg.classList.add("error");
    statusMsg.innerHTML = "❌ Error: " + (error.message || "Failed to summarize. Please try again.");
    
    // Reset button
    summarizeButton.classList.remove("loading");
    summarizeButton.disabled = false;
    summarizeButton.textContent = "Summarize this page";
    summarizeButton.style.display = "block";
    
    if (backButton) {
      backButton.style.display = "none";
    }
    if (askModeSection) {
      askModeSection.style.display = "none";
    }
    if (suggestionsArea) {
      suggestionsArea.style.display = "none";
    }
    
    updateStatus("Error: " + (error.message || "Something went wrong."));
    
    // Remove status message after 5 seconds
    setTimeout(() => {
      statusMsg.remove();
    }, 5000);
    summarizeButton.style.display = "block";
    if (backButton) {
      backButton.style.display = "none";
    }
    if (askModeSection) {
      askModeSection.style.display = "none";
    }
    if (suggestionsArea) {
      suggestionsArea.style.display = "none";
    }
    updateStatus("Unable to summarize this page.");
  }
});


// Add click handler for ask button
askButton?.addEventListener("click", async () => {
  if (!auth.currentUser) {
    updateStatus("Please sign in to ask questions.");
    return;
  }

  if (!currentSessionHistoryId) {
    updateStatus("Summarize this page before asking questions.");
    return;
  }

  const question = questionInput?.value.trim();
  if (!question || !answerResult) {
    return;
  }

  if (questionInput) {
    questionInput.value = "";
  }

  const userMessage = document.createElement("div");
  userMessage.classList.add("chat-message", "user-question");
  userMessage.textContent = question;
  answerResult.append(userMessage);
  answerResult.scrollTop = answerResult.scrollHeight;

  const thinkingMessage = document.createElement("p");
  thinkingMessage.classList.add("thinking-message");
  thinkingMessage.textContent = "Thinking...";
  answerResult.append(thinkingMessage);
  answerResult.scrollTop = answerResult.scrollHeight;

  chrome.storage.local.get(["currentPageText"], (result) => {
    const context = result?.currentPageText;

    if (!context || typeof context !== "string") {
      thinkingMessage.remove();

      const errorMessage = document.createElement("div");
      errorMessage.classList.add("chat-message", "ai-answer");
      errorMessage.textContent = "No page context available.";
      answerResult.append(errorMessage);
      answerResult.scrollTop = answerResult.scrollHeight;
      return;
    }

    const payload = `QUESTION ABOUT TERMS AND CONDITIONS: ${question}\n\nCONTEXT:\n${context.substring(0, 8000)}`;

    chrome.runtime.sendMessage({ type: "ASK_QUESTION", text: payload }, (response) => {
      thinkingMessage.remove();

      if (chrome.runtime.lastError || !response || response.error) {
        console.error("Ask button error:", chrome.runtime.lastError || response?.error);
        const errorMessage = document.createElement("div");
        errorMessage.classList.add("chat-message", "ai-answer");
        errorMessage.textContent = "Error: Could not get an answer.";
        answerResult.append(errorMessage);
        answerResult.scrollTop = answerResult.scrollHeight;
        updateStatus("Could not get an answer right now.");
        return;
      }

      const answerHtml = response?.summary ?? "No answer returned.";

      const aiMessage = document.createElement("div");
      aiMessage.classList.add("chat-message", "ai-answer");
      aiMessage.innerHTML = answerHtml;
      answerResult.append(aiMessage);
      answerResult.scrollTop = answerResult.scrollHeight;

      appendConversationToHistory(currentSessionHistoryId, question, answerHtml);
      questionInput?.focus();
    });
  });
});

// Add Enter key handler for question input
questionInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    askButton?.click();
  }
});

// Add back button functionality
backButton?.addEventListener("click", () => {
  resetSummarizerState();
});