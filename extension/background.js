const RENDER_ENDPOINT = "https://t-c-summarizer.onrender.com/summarise";

async function requestSummaryFromEndpoint(endpoint, pageText) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: pageText })
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  return response.json();
}

async function fetchSummary(pageText) {
  const endpoints = [RENDER_ENDPOINT];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting summary via ${endpoint}`);
      const data = await requestSummaryFromEndpoint(endpoint, pageText);
      return data;
    } catch (error) {
      console.error(`Summary request failed for ${endpoint}:`, error);
      lastError = error;
    }
  }

  throw lastError ?? new Error("No summary endpoint reachable");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SUMMARIZE_CONTENT") {
    const pageText = message.summary ?? "";

    chrome.storage.local.set({ currentPageText: pageText });
    console.log("Queued text length for summary:", pageText.length);

    fetchSummary(pageText)
      .then((data) => {
        console.log("Summary retrieved successfully");
        sendResponse({ summary: data?.summary ?? "No summary returned." });
      })
      .catch((error) => {
        console.error("All summary endpoints failed:", error);
        sendResponse({ summary: "Error: Could not connect to the summary server." });
      });

    return true;
  }

  if (message?.type === "ASK_QUESTION") {
    const questionPayload = typeof message.text === "string" ? message.text : "";

    fetchSummary(questionPayload)
      .then((data) => {
        console.log("Question answered successfully");
        sendResponse({ summary: data?.summary ?? data?.answer ?? "No answer returned." });
      })
      .catch((error) => {
        console.error("Question request failed:", error);
        sendResponse({ error: error?.message ?? "Failed to get answer." });
      });

    return true;
  }

  return false;
});
