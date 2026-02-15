/* ==========================================
   SaaS Stack Detector — Content Script
   Runs on every page load.
   1. Fetches signatures.json
   2. Scans DOM/Cookies/CSS/Scripts from signatures
   3. Injects inject.js (Main World scans)
   4. Merges results & updates badge
   ========================================== */

let detectedTech = [];
let signatures = null;

function toSignatureEntries(signatureSet) {
	if (!signatureSet) return [];

	if (Array.isArray(signatureSet)) {
		return signatureSet
			.filter((item) => item && item.pattern)
			.map((item) => ({
				pattern: item.pattern.toLowerCase(),
				info: item,
			}));
	}

	return Object.entries(signatureSet)
		.filter(([, info]) => info)
		.map(([pattern, info]) => ({
			pattern: pattern.toLowerCase(),
			info,
		}));
}

// ────────────────────────────────────────────────────────
// 1️⃣ DOM Scanner (ISOLATED World)
// ────────────────────────────────────────────────────────
async function domScanner() {
	if (!signatures) {
		try {
			const url = chrome.runtime.getURL("signatures.json");
			const response = await fetch(url);
			signatures = await response.json();
		} catch (e) {
			console.error("[StackDetector] Failed to load signatures", e);
			return [];
		}
	}

	const results = [];
	const seen = new Set();
	function add(item) {
		if (seen.has(item.name)) return;
		seen.add(item.name);
		results.push(item);
	}

	// ─── Scripts ───
	const scripts = document.querySelectorAll("script[src]");
	const scriptSrcs = Array.from(scripts).map((s) => s.src.toLowerCase());

	for (const { pattern, info } of toSignatureEntries(signatures.scripts)) {
		if (scriptSrcs.some((src) => src.includes(pattern))) {
			add({ ...info, method: "Script" });
		}
	}

	// ─── iFrames ───
	const iframes = document.querySelectorAll("iframe[src]");
	const iframeSrcs = Array.from(iframes).map((i) => i.src.toLowerCase());

	for (const { pattern, info } of toSignatureEntries(signatures.iframes)) {
		if (iframeSrcs.some((src) => src.includes(pattern))) {
			add({ ...info, method: "iFrame" });
		}
	}

	// ─── Resources (Link/Img) ───
	const resources = document.querySelectorAll(
		"link[href], img[src], source[src], video[src]",
	);
	const resourceUrls = Array.from(resources).map((r) =>
		(r.href || r.src || "").toLowerCase(),
	);
	// Scan script srcs as resources too (for CDN detection)
	const allUrls = [...resourceUrls, ...scriptSrcs];

	for (const { pattern, info } of toSignatureEntries(signatures.resources)) {
		if (allUrls.some((url) => url.includes(pattern))) {
			add({ ...info, method: "Resource" });
		}
	}

	// ─── Cookies ───
	const cookieStr = document.cookie || "";
	(signatures.cookies || []).forEach((sig) => {
		if (cookieStr.includes(sig.pattern)) {
			add({ ...sig, method: "Cookie" });
		}
	});

	// ─── DOM Selectors ───
	(signatures.dom || []).forEach((sig) => {
		try {
			const el = document.querySelector(sig.selector);
			if (el) {
				let version = null;
				if (sig.versionAttribute) {
					const attrVal = el.getAttribute(sig.versionAttribute);
					if (attrVal) {
						// Try to extract version number (e.g. "WordPress 6.9.1")
						const match = attrVal.match(
							/([0-9]+\.[0-9]+(\.[0-9]+)?)/,
						);
						if (match) version = match[1];
					}
				}

				if (sig.attribute) {
					// Check for attribute presence (boolean check)
					// If strict check needed, we could add logic here
					add({ ...sig, method: "DOM", version });
				} else {
					add({ ...sig, method: "DOM", version });
				}
			}
		} catch (e) {}
	});

	// Vue.js specific (data-v-)
	const allEls = document.querySelectorAll("*");
	for (let i = 0; i < Math.min(allEls.length, 500); i++) {
		const el = allEls[i];
		for (let j = 0; j < el.attributes.length; j++) {
			if (el.attributes[j].name.startsWith("data-v-")) {
				add({
					name: "Vue.js",
					icon: "💚",
					category: "JavaScript Frameworks",
					method: "DOM",
				});
				break;
			}
		}
	}
	// Radix UI specific
	if (
		document.querySelector("[data-radix-collection-item]") ||
		document.querySelector("[data-radix-popper-content-wrapper]")
	) {
		add({
			name: "Radix UI",
			icon: "🎨",
			category: "UI Frameworks",
			method: "DOM",
		});
	}
	// Framer Motion specific
	if (document.querySelector("[data-framer-motion-id]")) {
		add({
			name: "Framer Motion",
			icon: "✨",
			category: "JavaScript Libraries",
			method: "DOM",
		});
	}

	// Lucide icons (broader: lucide- class prefix on SVGs)
	if (
		document.querySelector("svg.lucide") ||
		document.querySelector("[class*='lucide-']")
	) {
		add({
			name: "Lucide",
			icon: "✏️",
			category: "Font Scripts",
			method: "DOM",
		});
	}

	// shadcn/ui (data-slot is the v2 pattern; also check for common shadcn class combos)
	if (document.querySelector("[data-slot]")) {
		add({
			name: "shadcn/ui",
			icon: "🎨",
			category: "UI Frameworks",
			method: "DOM",
		});
	}

	// HSTS (inferred from CSP meta)
	if (window.location.protocol === "https:") {
		const cspMeta = document.querySelector(
			"meta[http-equiv='Content-Security-Policy']",
		);
		if (
			cspMeta &&
			cspMeta.content &&
			cspMeta.content.includes("upgrade-insecure-requests")
		) {
			add({
				name: "HSTS",
				icon: "🛡️",
				category: "Security",
				method: "DOM",
			});
		}
	}

	// Cloudflare (meta detection — cf-* headers exposed as meta)
	if (
		document.querySelector("script[src*='cloudflareinsights']") ||
		document.querySelector("script[data-cf-beacon]")
	) {
		add({
			name: "Cloudflare",
			icon: "🌐",
			category: "CDN",
			method: "Script",
		});
	}

	// Priority Hints
	if (document.querySelector("[fetchpriority]")) {
		add({
			name: "Priority Hints",
			icon: "⚡",
			category: "Performance",
			method: "DOM",
		});
	}

	// ─── CSS Frameworks ───
	const classSet = new Set();
	const clsEls = document.querySelectorAll("[class]");
	const clsLimit = Math.min(clsEls.length, 1000);
	for (let i = 0; i < clsLimit; i++) {
		const cls = clsEls[i].className;
		if (typeof cls === "string") {
			cls.split(/\s+/).forEach((c) => {
				if (c) classSet.add(c);
			});
		}
	}
	const classList = Array.from(classSet);

	// CSS Frameworks from signatures.json might need custom logic if they are regex-based.
	// But our JSON has simple "pattern" which is not regex.
	// For Tailwind/Bootstrap, we implemented specific logic in popup.js.
	// We'll reimplement that smart logic here.

	// Tailwind
	const twPatterns = [
		/^sm:/,
		/^md:/,
		/^lg:/,
		/^xl:/,
		/^2xl:/,
		/^hover:/,
		/^focus:/,
		/^dark:/,
	];
	if (classList.some((c) => twPatterns.some((p) => p.test(c)))) {
		add({
			name: "Tailwind CSS",
			icon: "🎨",
			category: "CSS Frameworks",
			method: "CSS",
		});
	}

	// Bootstrap
	const bsPatterns = [
		/^col-(sm|md|lg|xl)-/,
		/^btn-/,
		/^navbar-/,
		/^container-fluid$/,
		/^form-control$/,
	];
	if (classList.some((c) => bsPatterns.some((p) => p.test(c)))) {
		add({
			name: "Bootstrap",
			icon: "🎨",
			category: "CSS Frameworks",
			method: "CSS",
		});
	}

	// Semantic UI, Bulma, Foundation, etc from JSON?
	// The JSON has prefixes. Let's use them.
	(signatures.css || []).forEach((sig) => {
		if (sig.prefixes && Array.isArray(sig.prefixes)) {
			let hits = 0;
			sig.prefixes.forEach((pre) => {
				if (classList.some((c) => c.startsWith(pre))) hits++;
			});
			if (hits >= 1) {
				add({ ...sig, method: "CSS" });
			}
		}
	});

	return results;
}

// ────────────────────────────────────────────────────────
// 2️⃣ Injection & Communication
// ────────────────────────────────────────────────────────
function injectMainWorldScript() {
	const script = document.createElement("script");
	script.src = chrome.runtime.getURL("inject.js");
	script.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(script);
}

async function runScan() {
	const domResults = await domScanner();
	// We wait for global results via message
}

// Listen for Main World results
// Listen for Main World results
let lastBadgeCount = 0;
window.addEventListener("message", async (event) => {
	// Only accept messages from same frame
	if (event.source !== window) return;

	if (event.data.type && event.data.type === "STACK_DETECTOR_GLOBALS") {
		const globalResults = event.data.data;
		const domResults = await domScanner(); // Run DOM scan now

		// Fetch header detections from background
		let headerResults = [];
		try {
			const response = await chrome.runtime.sendMessage({
				type: "GET_HEADER_DETECTIONS",
			});
			if (response && response.detections) {
				headerResults = response.detections;
			}
		} catch (e) {
			// console.warn("[StackDetector] Failed to get header detections:", e);
		}

		// Merge all 3 sources: DOM + Globals + Headers
		const all = [...domResults, ...globalResults, ...headerResults];

		// Deduplicate
		const map = new Map();
		all.forEach((item) => {
			if (!map.has(item.name)) {
				map.set(item.name, item);
			} else {
				const ex = map.get(item.name);
				if (!ex.version && item.version) ex.version = item.version;
			}
		});

		detectedTech = Array.from(map.values());

		// Send to background for badge only if count changed
		if (detectedTech.length !== lastBadgeCount) {
			lastBadgeCount = detectedTech.length;
			chrome.runtime.sendMessage({
				type: "updateBadge",
				count: lastBadgeCount,
			});
		}
	}
});

// Listen for Popup request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === "GET_DETECTIONS") {
		// Respond immediately with cached results
		sendResponse({ detections: detectedTech });
	}
});

// Start
injectMainWorldScript();
