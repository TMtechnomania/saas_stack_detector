/* ==========================================
   SaaS Stack Detector — Background Service Worker
   1. Loads signatures.json
   2. Intercepts HTTP response headers (webRequest)
   3. Detects technologies from headers using loaded signatures
   4. Stores per-tab detections
   5. Manages badge count per tab
   6. Sends Telemetry
   ========================================== */

import { sendDetections } from "./telemetry.js";

// ─── Global State ───
let signatures = { headers: [] };
const tabCounts = new Map();
const tabHeaderDetections = new Map(); // tabId -> [{name, icon, category, method, version}]

// ─── Badge styling ───
chrome.action.setBadgeBackgroundColor({ color: "#0072ff" });
chrome.action.setBadgeTextColor({ color: "#ffffff" });

// ─── Load Signatures ───
async function loadSignatures() {
	try {
		const url = chrome.runtime.getURL("signatures.json");
		const response = await fetch(url);
		signatures = await response.json();
		// console.log("[StackDetector] Loaded signatures:", signatures.headers.length, "header rules");
	} catch (e) {
		console.error("[StackDetector] Failed to load signatures", e);
	}
}

chrome.runtime.onInstalled.addListener(async (details) => {
	if (details.reason === "install") {
		// console.log("[StackDetector] Extension installed");
	}
	await loadSignatures();
});

// Also load on startup
loadSignatures();

// ════════════════════════════════════════════════════════
// HTTP Header Detection Engine
// ════════════════════════════════════════════════════════

function detectHeaders(headers) {
	if (!signatures || !signatures.headers) return [];

	const detections = [];
	const seen = new Set();

	function add(item) {
		if (seen.has(item.name)) return;
		seen.add(item.name);
		detections.push(item);
	}

	// Optimization: Create a map of { headerNameLower: [values] }
	const headerMap = {};
	headers.forEach((h) => {
		const name = h.name.toLowerCase();
		if (!headerMap[name]) headerMap[name] = [];
		headerMap[name].push(h.value);
	});

	signatures.headers.forEach((sig) => {
		const headerName = sig.header; // "server", "x-powered-by", etc.
		const values = headerMap[headerName];

		if (values) {
			values.forEach((val) => {
				if (sig.pattern) {
					try {
						const regex = new RegExp(sig.pattern, "i");
						const match = val.match(regex);
						if (match) {
							let version = null;
							if (match[1]) version = match[1];

							add({
								name: sig.name,
								icon: sig.icon,
								category:
									(sig.categories && sig.categories[0]) ||
									"Web Servers",
								version,
								method: "Header",
								description: sig.description,
								website: sig.website,
							});
						}
					} catch (e) {
						// Invalid regex
					}
				} else {
					// No pattern, just existence of header
					add({
						name: sig.name,
						icon: sig.icon,
						category:
							(sig.categories && sig.categories[0]) ||
							"Web Servers",
						method: "Header",
						description: sig.description,
						website: sig.website,
					});
				}
			});
		}
	});

	return detections;
}

// ════════════════════════════════════════════════════════
// WebRequest Listener
// ════════════════════════════════════════════════════════

chrome.webRequest.onHeadersReceived.addListener(
	(details) => {
		// Only process main frame (top-level navigation), not subresources
		if (details.type !== "main_frame") return;

		const tabId = details.tabId;
		if (tabId < 0) return; // Not a real tab

		const detections = detectHeaders(details.responseHeaders || []);

		if (detections.length > 0) {
			// Store header detections for this tab
			tabHeaderDetections.set(tabId, detections);
		}
	},
	{ urls: ["<all_urls>"] },
	["responseHeaders"],
);

// ════════════════════════════════════════════════════════
// Message Handling
// ════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	// Badge update from content script or popup
	if (message.type === "updateBadge") {
		const tabId = sender.tab ? sender.tab.id : message.tabId;
		const count = message.count;

		if (tabId) {
			tabCounts.set(tabId, count);
			const text = count > 0 ? String(count) : "";
			chrome.action.setBadgeText({ text, tabId });

			// 🚀 TRIGGER TELEMETRY
			if (message.detections) {
				sendDetections(message.detections, tabId);
			}
		}
	}

	// Content script or popup requesting header detections
	if (message.type === "GET_HEADER_DETECTIONS") {
		const tabId = sender.tab ? sender.tab.id : message.tabId;
		const detections = tabHeaderDetections.get(tabId) || [];
		sendResponse({ detections });
		return true; // Keep channel open for async
	}
});

// ════════════════════════════════════════════════════════
// Tab Lifecycle
// ════════════════════════════════════════════════════════

// Clear on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
	tabCounts.delete(tabId);
	tabHeaderDetections.delete(tabId);
});

// Restore badge on tab switch
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	const count = tabCounts.get(activeInfo.tabId);
	if (count !== undefined) {
		chrome.action.setBadgeText({
			text: count > 0 ? String(count) : "",
			tabId: activeInfo.tabId,
		});
	}
});

// Clear on navigation (new page load)
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
	if (details.frameId === 0) {
		// Main frame only
		tabCounts.delete(details.tabId);
		tabHeaderDetections.delete(details.tabId);
		chrome.action.setBadgeText({ text: "", tabId: details.tabId });
	}
});
