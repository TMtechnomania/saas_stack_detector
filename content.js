/* ==========================================
   SaaS Stack Detector — Content Script
   Runs on every page load.
   1. Fetches signatures.json
   2. Scans DOM/Cookies/Meta/Scripts/CSS from signatures
   3. Injects inject.js (Main World scans) & Configures it
   4. Merges results & updates badge
   ========================================== */

let detectedTech = [];
let signatures = null;

// Helper: Check Regex Pattern
function checkPattern(text, pattern) {
	try {
		if (!text || !pattern) return null;
		const regex = new RegExp(pattern, "i");
		const match = text.match(regex);
		if (match) {
			return {
				matched: true,
				version: match[1] || null,
			};
		}
	} catch (e) {
		// console.warn("Invalid regex:", pattern);
	}
	return null;
}

// ────────────────────────────────────────────────────────
// 1️⃣ DOM Scanner (ISOLATED World)
// ────────────────────────────────────────────────────────
async function domScanner() {
	if (!signatures) return [];

	const results = [];
	const seen = new Set();
	function add(item) {
		if (seen.has(item.name)) return;
		seen.add(item.name);
		results.push(item);
	}

	// ─── Scripts (src attributes) ───
	if (signatures.scripts) {
		const scripts = document.querySelectorAll("script[src]");
		const scriptSrcs = Array.from(scripts).map((s) => s.src);

		signatures.scripts.forEach((sig) => {
			if (sig.pattern) {
				// Check if ANY script src matches the pattern
				for (const src of scriptSrcs) {
					const res = checkPattern(src, sig.pattern);
					if (res) {
						add({
							name: sig.name,
							icon: sig.icon,
							category:
								(sig.categories && sig.categories[0]) ||
								"JavaScript",
							version: res.version,
							description: sig.description,
							website: sig.website,
							method: "Script Src",
						});
						break; // Found this tech, move to next signature
					}
				}
			}
		});
	}

	// ─── Meta Tags ───
	if (signatures.meta) {
		const metaTags = document.getElementsByTagName("meta");
		const metaMap = {};
		// Map meta name/property to content
		for (const meta of metaTags) {
			const name =
				meta.getAttribute("name") || meta.getAttribute("property");
			if (name) {
				metaMap[name.toLowerCase()] = meta.getAttribute("content");
			}
		}

		signatures.meta.forEach((sig) => {
			const metaName = sig.name; // e.g. "generator"
			const content = metaMap[metaName];
			if (content && sig.pattern) {
				const res = checkPattern(content, sig.pattern);
				if (res) {
					add({
						name: sig.name, // This is the TECH name, not the meta name
						icon: sig.icon,
						category:
							(sig.categories && sig.categories[0]) ||
							"Miscellaneous",
						version: res.version,
						description: sig.description,
						website: sig.website,
						method: "Meta Tag",
					});
				}
			}
		});
	}

	// ─── Cookies ───
	if (signatures.cookies) {
		const cookieStr = document.cookie || "";
		// signatures.cookies.forEach...
		// Need to parse cookies correctly
		const cookieValues = {};
		document.cookie.split(";").forEach((c) => {
			const parts = c.trim().split("=");
			if (parts.length >= 2) {
				cookieValues[parts[0]] = parts.slice(1).join("=");
			}
		});

		signatures.cookies.forEach((sig) => {
			if (cookieValues[sig.cookie]) {
				const res = checkPattern(cookieValues[sig.cookie], sig.pattern);
				if (res) {
					add({
						name: sig.name,
						icon: sig.icon,
						category:
							(sig.categories && sig.categories[0]) || "Cookie",
						version: res.version,
						description: sig.description,
						website: sig.website,
						method: "Cookie",
					});
				}
			}
		});
	}

	// ─── DOM Selectors ───
	if (signatures.dom) {
		signatures.dom.forEach((sig) => {
			try {
				const els = document.querySelectorAll(sig.selector);
				if (els.length > 0) {
					let matched = false;
					let version = null;

					if (!sig.details) {
						matched = true;
					} else {
						for (const el of els) {
							let elMatch = true;
							if (sig.details.text) {
								const text = el.textContent;
								const res = checkPattern(
									text,
									sig.details.text,
								);
								if (!res) elMatch = false;
								else if (res.version) version = res.version;
							}
							if (elMatch && sig.details.attributes) {
								for (const [attr, pat] of Object.entries(
									sig.details.attributes,
								)) {
									const attrVal = el.getAttribute(attr);
									if (attrVal === null) {
										elMatch = false;
										break;
									}
									const res = checkPattern(attrVal, pat);
									if (!res) {
										elMatch = false;
										break;
									} else if (res.version)
										version = res.version;
								}
							}
							if (elMatch) {
								matched = true;
								break;
							}
						}
					}

					if (matched) {
						add({
							name: sig.name,
							icon: sig.icon,
							category:
								(sig.categories && sig.categories[0]) || "DOM",
							version: version,
							description: sig.description,
							website: sig.website,
							method: "DOM",
						});
					}
				}
			} catch (e) {
				// Invalid selector
			}
		});
	}

	// ─── CSS (Class Names) ───
	if (signatures.css) {
		const classSet = new Set();
		const allEls = document.querySelectorAll("*[class]");
		const limit = Math.min(allEls.length, 2000);
		for (let i = 0; i < limit; i++) {
			const cls = allEls[i].className;
			if (typeof cls === "string") {
				cls.split(/\s+/).forEach((c) => classSet.add(c));
			}
		}

		signatures.css.forEach((sig) => {
			for (const c of classSet) {
				const res = checkPattern(c, sig.pattern);
				if (res) {
					add({
						name: sig.name,
						icon: sig.icon,
						category:
							(sig.categories && sig.categories[0]) || "CSS",
						version: res.version,
						description: sig.description,
						website: sig.website,
						method: "CSS",
					});
					break;
				}
			}
		});
	}

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
		if (signatures && signatures.globals) {
			window.postMessage(
				{ type: "STACK_DETECTOR_INIT", signatures: signatures.globals },
				"*",
			);
		}
	};
	(document.head || document.documentElement).appendChild(script);
}

// Listen for Main World results
let lastBadgeCount = 0;
window.addEventListener("message", async (event) => {
	// Only accept messages from same frame
	if (event.source !== window) return;

	if (event.data.type && event.data.type === "STACK_DETECTOR_GLOBALS") {
		const globalResults = event.data.data;

		// Run DOM scan now that we have globals
		const domResults = await domScanner();

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
				if (!ex.description && item.description)
					ex.description = item.description;
				if (!ex.website && item.website) ex.website = item.website;
			}
		});

		detectedTech = Array.from(map.values());

		// Send to background for badge only if count changed
		if (detectedTech.length !== lastBadgeCount) {
			lastBadgeCount = detectedTech.length;
			chrome.runtime.sendMessage({
				type: "updateBadge",
				count: lastBadgeCount,
				detections: detectedTech,
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

// ────────────────────────────────────────────────────────
// Initialization
// ────────────────────────────────────────────────────────
async function init() {
	try {
		const url = chrome.runtime.getURL("signatures.json");
		const response = await fetch(url);
		signatures = await response.json();
	} catch (e) {
		console.error("[StackDetector] Failed to load signatures", e);
	}

	injectMainWorldScript();
}

init();
