/* ==========================================
   SaaS Stack Detector — Background Service Worker
   Handles badge count per tab.
   ========================================== */

// Per-tab detection counts
const tabCounts = new Map();

// Set badge styling on install
chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === "install") {
		console.log("[StackDetector] Extension installed");
	}
});

chrome.action.setBadgeBackgroundColor({ color: "#0072ff" });
chrome.action.setBadgeTextColor({ color: "#ffffff" });

// Listen for count updates from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "updateBadge") {
		// Content script doesn't know its tabId, so use sender.tab.id
		// Popup might send tabId explicitly
		const tabId = sender.tab ? sender.tab.id : message.tabId;
		const count = message.count;

		if (tabId) {
			tabCounts.set(tabId, count);
			const text = count > 0 ? String(count) : "";
			chrome.action.setBadgeText({ text, tabId });
		}
	}
});

// Clear badge when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
	tabCounts.delete(tabId);
});

// Restore badge when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	const count = tabCounts.get(activeInfo.tabId);
	if (count !== undefined) {
		chrome.action.setBadgeText({
			text: count > 0 ? String(count) : "",
			tabId: activeInfo.tabId,
		});
	}
});

// Clear badge when tab navigates to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.status === "loading") {
		tabCounts.delete(tabId);
		chrome.action.setBadgeText({ text: "", tabId });
	}
});
