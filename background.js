/* ==========================================
   SaaS Stack Detector — Background Service Worker
   1. Intercepts HTTP response headers (webRequest)
   2. Detects technologies from headers
   3. Stores per-tab detections
   4. Manages badge count per tab
   ========================================== */

// ─── Per-tab storage ───
const tabCounts = new Map();
const tabHeaderDetections = new Map(); // tabId -> [{name, icon, category, method, version}]

// ─── Badge styling ───
chrome.action.setBadgeBackgroundColor({ color: "#0072ff" });
chrome.action.setBadgeTextColor({ color: "#ffffff" });

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === "install") {
		console.log("[StackDetector] Extension installed");
	}
});

// ════════════════════════════════════════════════════════
// HTTP Header Detection Engine
// ════════════════════════════════════════════════════════

// Header-based technology signatures
const headerSignatures = {
	// ─── Server Header ───
	server: [
		{
			match: "cloudflare",
			name: "Cloudflare",
			icon: "🌐",
			category: "CDN",
		},
		{ match: "nginx", name: "Nginx", icon: "🖥️", category: "Web Servers" },
		{
			match: "apache",
			name: "Apache",
			icon: "🖥️",
			category: "Web Servers",
		},
		{
			match: "litespeed",
			name: "LiteSpeed",
			icon: "🖥️",
			category: "Web Servers",
		},
		{
			match: "microsoft-iis",
			name: "Microsoft IIS",
			icon: "🖥️",
			category: "Web Servers",
		},
		{ match: "vercel", name: "Vercel", icon: "▲", category: "PaaS" },
		{ match: "netlify", name: "Netlify", icon: "🌐", category: "PaaS" },
		{ match: "deno", name: "Deno", icon: "🦕", category: "Web Servers" },
		{
			match: "gunicorn",
			name: "Gunicorn",
			icon: "🖥️",
			category: "Web Servers",
		},
		{
			match: "uvicorn",
			name: "Uvicorn",
			icon: "🖥️",
			category: "Web Servers",
		},
		{
			match: "openresty",
			name: "OpenResty",
			icon: "🖥️",
			category: "Web Servers",
		},
		{ match: "caddy", name: "Caddy", icon: "🖥️", category: "Web Servers" },
		{
			match: "cowboy",
			name: "Cowboy (Erlang)",
			icon: "🖥️",
			category: "Web Servers",
		},
		{
			match: "gws",
			name: "Google Web Server",
			icon: "🖥️",
			category: "Web Servers",
		},
	],

	// ─── X-Powered-By Header ───
	"x-powered-by": [
		{
			match: "express",
			name: "Express.js",
			icon: "🟢",
			category: "Web Frameworks",
		},
		{
			match: "asp.net",
			name: "ASP.NET",
			icon: "🔵",
			category: "Web Frameworks",
		},
		{
			match: "php",
			name: "PHP",
			icon: "🐘",
			category: "Web Frameworks",
			extractVersion: true,
		},
		{
			match: "next.js",
			name: "Next.js",
			icon: "⚛️",
			category: "JavaScript Frameworks",
		},
		{
			match: "nuxt",
			name: "Nuxt.js",
			icon: "💚",
			category: "JavaScript Frameworks",
		},
		{
			match: "flask",
			name: "Flask",
			icon: "🐍",
			category: "Web Frameworks",
		},
		{
			match: "django",
			name: "Django",
			icon: "🐍",
			category: "Web Frameworks",
		},
		{
			match: "ruby",
			name: "Ruby on Rails",
			icon: "💎",
			category: "Web Frameworks",
		},
		{
			match: "servlet",
			name: "Java Servlet",
			icon: "☕",
			category: "Web Frameworks",
		},
		{
			match: "kestrel",
			name: "Kestrel (.NET)",
			icon: "🔵",
			category: "Web Servers",
		},
		{
			match: "phusion passenger",
			name: "Passenger",
			icon: "🖥️",
			category: "Web Servers",
		},
		{ match: "plesk", name: "Plesk", icon: "🖥️", category: "Hosting" },
	],
};

// ─── Special header checks (non-pattern-based) ───
function detectSpecialHeaders(headers) {
	const detections = [];
	const seen = new Set();

	function add(item) {
		if (seen.has(item.name)) return;
		seen.add(item.name);
		detections.push(item);
	}

	const headerMap = {};
	headers.forEach((h) => {
		headerMap[h.name.toLowerCase()] = h.value;
	});

	// ─── HTTP/3 (via alt-svc header) ───
	const altSvc = headerMap["alt-svc"];
	if (altSvc && (altSvc.includes("h3") || altSvc.includes("quic"))) {
		add({
			name: "HTTP/3",
			icon: "🌐",
			category: "Miscellaneous",
			method: "Header",
		});
	}

	// ─── HSTS ───
	if (headerMap["strict-transport-security"]) {
		add({
			name: "HSTS",
			icon: "🛡️",
			category: "Security",
			method: "Header",
		});
	}

	// ─── Cloudflare (cf-ray or cf-cache-status) ───
	if (headerMap["cf-ray"] || headerMap["cf-cache-status"]) {
		add({
			name: "Cloudflare",
			icon: "🌐",
			category: "CDN",
			method: "Header",
		});
	}

	// ─── Vercel ───
	if (headerMap["x-vercel-id"] || headerMap["x-vercel-cache"]) {
		add({ name: "Vercel", icon: "▲", category: "PaaS", method: "Header" });
	}

	// ─── Netlify ───
	if (headerMap["x-nf-request-id"]) {
		add({
			name: "Netlify",
			icon: "🌐",
			category: "PaaS",
			method: "Header",
		});
	}

	// ─── AWS ───
	const awsHeaders = ["x-amz-request-id", "x-amz-cf-id", "x-amz-cf-pop"];
	if (awsHeaders.some((h) => headerMap[h])) {
		add({
			name: "Amazon Web Services",
			icon: "☁️",
			category: "PaaS",
			method: "Header",
		});
	}

	// ─── Fastly ───
	if (
		headerMap["x-served-by"] &&
		headerMap["x-served-by"].includes("cache-")
	) {
		add({ name: "Fastly", icon: "🌐", category: "CDN", method: "Header" });
	}
	if (headerMap["x-fastly-request-id"]) {
		add({ name: "Fastly", icon: "🌐", category: "CDN", method: "Header" });
	}

	// ─── Akamai ───
	if (headerMap["x-akamai-transformed"] || headerMap["x-akamai-request-id"]) {
		add({ name: "Akamai", icon: "🌐", category: "CDN", method: "Header" });
	}

	// ─── Shopify ───
	if (headerMap["x-shopify-stage"] || headerMap["x-shopid"]) {
		add({
			name: "Shopify",
			icon: "🛒",
			category: "E-Commerce",
			method: "Header",
		});
	}

	// ─── WordPress ───
	if (
		headerMap["x-pingback"] &&
		headerMap["x-pingback"].includes("xmlrpc.php")
	) {
		add({
			name: "WordPress",
			icon: "📝",
			category: "CMS",
			method: "Header",
		});
	}

	// ─── Drupal ───
	if (headerMap["x-drupal-cache"] || headerMap["x-drupal-dynamic-cache"]) {
		add({ name: "Drupal", icon: "📝", category: "CMS", method: "Header" });
	}

	// ─── Firebase ───
	if (headerMap["x-firebase-hosting"]) {
		add({
			name: "Firebase Hosting",
			icon: "🔥",
			category: "Hosting",
			method: "Header",
		});
	}

	// ─── GitHub Pages ───
	if (headerMap["x-github-request-id"]) {
		add({
			name: "GitHub Pages",
			icon: "🐙",
			category: "Hosting",
			method: "Header",
		});
	}

	// ─── Content-Security-Policy → hints ───
	const csp = headerMap["content-security-policy"];
	if (csp) {
		if (csp.includes("sentry.io")) {
			add({
				name: "Sentry",
				icon: "🐛",
				category: "Error Tracking",
				method: "Header",
			});
		}
		if (csp.includes("stripe.com")) {
			add({
				name: "Stripe",
				icon: "💳",
				category: "Payments",
				method: "Header",
			});
		}
		if (csp.includes("intercom.io")) {
			add({
				name: "Intercom",
				icon: "💬",
				category: "Live Chat",
				method: "Header",
			});
		}
		if (
			csp.includes("google-analytics.com") ||
			csp.includes("googletagmanager.com")
		) {
			add({
				name: "Google Analytics",
				icon: "📊",
				category: "Analytics",
				method: "Header",
			});
		}
	}

	// ─── X-Content-Type-Options / X-Frame-Options → Security awareness ───
	if (headerMap["x-content-type-options"] === "nosniff") {
		add({
			name: "X-Content-Type-Options",
			icon: "🛡️",
			category: "Security",
			method: "Header",
		});
	}

	// ─── Server (pattern-based) ───
	const serverVal = (headerMap["server"] || "").toLowerCase();
	if (serverVal) {
		headerSignatures.server.forEach((sig) => {
			if (serverVal.includes(sig.match)) {
				add({ ...sig, method: "Header" });
			}
		});
	}

	// ─── X-Powered-By (pattern-based) ───
	const poweredBy = (headerMap["x-powered-by"] || "").toLowerCase();
	if (poweredBy) {
		headerSignatures["x-powered-by"].forEach((sig) => {
			if (poweredBy.includes(sig.match)) {
				let version = null;
				if (sig.extractVersion) {
					// Try to extract version from "PHP/8.1.2" format
					const vMatch = headerMap["x-powered-by"].match(/[\d.]+/);
					if (vMatch) version = vMatch[0];
				}
				add({ ...sig, method: "Header", version });
			}
		});
	}

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

		const detections = detectSpecialHeaders(details.responseHeaders || []);

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	// Badge update from content script or popup
	if (message.type === "updateBadge") {
		const tabId = sender.tab ? sender.tab.id : message.tabId;
		const count = message.count;

		if (tabId) {
			tabCounts.set(tabId, count);
			const text = count > 0 ? String(count) : "";
			chrome.action.setBadgeText({ text, tabId });
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
