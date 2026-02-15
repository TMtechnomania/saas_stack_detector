/* ==========================================
   SaaS Stack Detector — Popup Logic
   UI handling & communication with content script
   ========================================== */

(function () {
	"use strict";

	const MAILTO_EMAIL = "tmtechnomaniayt@gmail.com";
	let currentResults = [];
	let currentUrl = "";

	// ─── DOM Refs ───
	const siteUrlEl = document.getElementById("site-url");
	const scanStatusEl = document.getElementById("scan-status");
	const resultsEl = document.getElementById("results");
	const emptyStateEl = document.getElementById("empty-state");
	const techCountEl = document.getElementById("tech-count");
	const toastEl = document.getElementById("toast");
	const btnRefresh = document.getElementById("btn-refresh");
	const btnExport = document.getElementById("btn-export");
	const btnCopy = document.getElementById("btn-copy");
	const btnMissing = document.getElementById("btn-missing");

	// ─── Init ───
	document.addEventListener("DOMContentLoaded", init);

	async function init() {
		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (
				!tab ||
				!tab.url ||
				tab.url.startsWith("chrome://") ||
				tab.url.startsWith("edge://") ||
				tab.url.startsWith("about:")
			) {
				showError("Cannot scan this page");
				return;
			}

			try {
				currentUrl = new URL(tab.url).hostname;
			} catch (e) {
				currentUrl = "Current Page";
			}
			siteUrlEl.textContent = currentUrl;

			// Request results from content script
			showScanning();

			// Add a small delay/retry to allow content script to load if just opened
			chrome.tabs.sendMessage(
				tab.id,
				{ type: "GET_DETECTIONS" },
				(response) => {
					if (chrome.runtime.lastError) {
						// Content script not ready or not injected
						console.warn(
							"Content script error:",
							chrome.runtime.lastError,
						);

						// If we can't communicate, maybe try injecting or just show error
						// For now, let's just show an error message asking to reload
						showError("Please reload the page to scan");
						return;
					}

					if (response && response.detections) {
						currentResults = deduplicateResults(
							response.detections,
						);
						renderResults(currentResults);
					} else {
						renderResults([]);
					}
				},
			);
		} catch (err) {
			console.error("[StackDetector] Init error:", err);
			showError("Failed to initialize");
		}
	}

	// ─── Utilities ───
	function deduplicateResults(results) {
		const map = new Map();
		results.forEach((r) => {
			if (!map.has(r.name)) {
				map.set(r.name, r);
			} else {
				// Merge version info if available
				const existing = map.get(r.name);
				if (r.version && !existing.version) {
					existing.version = r.version;
				}
			}
		});
		// Sort by category then name
		return Array.from(map.values()).sort((a, b) => {
			if (a.category < b.category) return -1;
			if (a.category > b.category) return 1;
			return a.name.localeCompare(b.name);
		});
	}

	function renderResults(results) {
		scanStatusEl.classList.add("done");
		resultsEl.innerHTML = "";

		if (!results || results.length === 0) {
			emptyStateEl.classList.remove("hidden");
			techCountEl.textContent = "";
			return;
		}

		emptyStateEl.classList.add("hidden");
		techCountEl.textContent = results.length.toString();

		// Group by category
		const groups = {};
		results.forEach((tech) => {
			if (!groups[tech.category]) groups[tech.category] = [];
			groups[tech.category].push(tech);
		});

		// Sort categories
		const sortedCategories = Object.keys(groups).sort();

		sortedCategories.forEach((category) => {
			// Category Header
			const catHeader = document.createElement("div");
			catHeader.className = "category-group";
			catHeader.innerHTML = `
				<div class="category-header">
					<span>${category}</span>
					<div class="category-count">${groups[category].length}</div>
				</div>
			`;
			resultsEl.appendChild(catHeader);

			// Tech Cards
			groups[category].forEach((tech) => {
				const card = document.createElement("div");
				card.className = "tech-card";
				const versionHtml =
					tech.version ?
						`<span class="tech-version">${tech.version}</span>`
					:	"";
				card.innerHTML = `
					<span class="tech-icon">${tech.icon}</span>
					<div class="tech-info">
						<div class="tech-name">${tech.name} ${versionHtml}</div>
						<div class="tech-method">via ${tech.method || "detection"}</div>
					</div>
					<span class="tech-badge">${tech.method || "auto"}</span>
				`;
				resultsEl.appendChild(card);
			});
		});
	}

	function showScanning() {
		scanStatusEl.classList.remove("done");
		emptyStateEl.classList.add("hidden");
		resultsEl.innerHTML = "";
	}

	function showError(msg) {
		scanStatusEl.classList.add("done");
		emptyStateEl.classList.remove("hidden");
		emptyStateEl.innerHTML = `
			<div class="empty-icon">⚠️</div>
			<div class="empty-title">${msg}</div>
		`;
	}

	function showToast(msg) {
		toastEl.textContent = msg;
		toastEl.classList.add("show");
		setTimeout(() => {
			toastEl.classList.remove("show");
		}, 2000);
	}

	// ─── Event Listeners ───
	btnRefresh.addEventListener("click", () => {
		location.reload(); // Reload popup to re-init
	});

	btnExport.addEventListener("click", () => {
		if (currentResults.length === 0) return;
		const dataStr = JSON.stringify(
			{
				url: currentUrl,
				scannedAt: new Date().toISOString(),
				count: currentResults.length,
				technologies: currentResults,
			},
			null,
			2,
		);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `stack-detection-${currentUrl.replace(/\./g, "-")}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		showToast("Exported JSON");
	});

	btnCopy.addEventListener("click", () => {
		if (currentResults.length === 0) return;
		const text = currentResults
			.map((t) => `${t.name} (${t.category})`)
			.join("\n");
		navigator.clipboard.writeText(text).then(() => {
			showToast("Copied to clipboard");
		});
	});

	btnMissing.addEventListener("click", () => {
		const subject = `Missing Tech: ${currentUrl}`;
		const body = `Hi,\n\nI noticed some technologies are missing for: ${currentUrl}\n\n[List missing tech here]`;
		window.open(
			`mailto:${MAILTO_EMAIL}?subject=${encodeURIComponent(
				subject,
			)}&body=${encodeURIComponent(body)}`,
		);
	});
})();
