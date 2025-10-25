function extractVisibleText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const chunks = [];

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    const parentTag = walker.currentNode.parentElement?.tagName;

    if (text && parentTag !== "SCRIPT" && parentTag !== "STYLE") {
      chunks.push(text);
    }
  }

  return chunks.join(" ");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SUMMARIZE_PAGE") {
    const pageText = extractVisibleText();

    // Placeholder: in a real implementation, send text to background/AI summarizer.
    chrome.runtime.sendMessage(
      {
        type: "SUMMARIZE_CONTENT",
  summary: pageText || "No readable content found."
      },
      (response) => sendResponse(response)
    );

    return true; // Keep message port alive for async response.
  }
});
