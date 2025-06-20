chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg === 'getProblemInfo') {
    const title = document.title.replace(" - LeetCode", "").trim();
    const link = window.location.href;
    sendResponse({ title, link });
  }
});
