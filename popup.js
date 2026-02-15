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
	const btnTheme = document.getElementById("btn-theme");
	const btnExport = document.getElementById("btn-export");
	const btnCopy = document.getElementById("btn-copy");
	const btnMissing = document.getElementById("btn-missing");

	// Telemetry Refs
	const btnTelemetry = document.getElementById("btn-telemetry");
	const iconTelemetryOn = document.getElementById("icon-telemetry-on");
	const iconTelemetryOff = document.getElementById("icon-telemetry-off");
	const onboardingOverlay = document.getElementById("onboarding-overlay");
	const btnAccept = document.getElementById("btn-accept");
	const btnDecline = document.getElementById("btn-decline");

	// ─── Theme Init ───
	const savedTheme = localStorage.getItem("theme") || "dark";
	if (savedTheme === "light") {
		document.documentElement.setAttribute("data-theme", "light");
	}

	// ─── Init ───
	document.addEventListener("DOMContentLoaded", init);

	async function init() {
		// 1. Check Telemetry Consent
		await checkTelemetryConsent();

		// 2. Start Scan
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

			// Fetch detections from content script + header detections from background
			const tabId = tab.id;

			// Get content script detections
			chrome.tabs.sendMessage(
				tabId,
				{ type: "GET_DETECTIONS" },
				async (contentResponse) => {
					let contentDetections = [];
					if (
						!chrome.runtime.lastError &&
						contentResponse &&
						contentResponse.detections
					) {
						contentDetections = contentResponse.detections;
					}

					// Also fetch header detections from background
					let headerDetections = [];
					try {
						const headerResponse = await chrome.runtime.sendMessage(
							{
								type: "GET_HEADER_DETECTIONS",
								tabId: tabId,
							},
						);
						if (headerResponse && headerResponse.detections) {
							headerDetections = headerResponse.detections;
						}
					} catch (e) {
						console.warn("Header detection fetch failed:", e);
					}

					// Merge all
					const allDetections = [
						...contentDetections,
						...headerDetections,
					];

					if (allDetections.length > 0) {
						currentResults = deduplicateResults(allDetections);
						renderResults(currentResults);
					} else if (
						contentDetections.length === 0 &&
						chrome.runtime.lastError
					) {
						showError("Please reload the page to scan");
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

	// ─── Privacy / Telemetry Logic ───
	async function checkTelemetryConsent() {
		const { telemetry_consent } =
			await chrome.storage.local.get("telemetry_consent");

		if (typeof telemetry_consent === "undefined") {
			// New user: Show onboarding
			onboardingOverlay.classList.remove("hidden");
		} else {
			// Existing user: Update UI
			updateTelemetryUI(telemetry_consent);
		}
	}

	function updateTelemetryUI(enabled) {
		if (enabled) {
			iconTelemetryOn.classList.remove("hidden");
			iconTelemetryOn.style.display = ""; // Clear inline style
			iconTelemetryOff.classList.add("hidden");
			btnTelemetry.title = "Telemetry: ON (Sharing anonymous data)";
		} else {
			iconTelemetryOn.classList.add("hidden");
			iconTelemetryOff.classList.remove("hidden");
			iconTelemetryOff.style.display = ""; // Clear inline style
			btnTelemetry.title = "Telemetry: OFF (Not sharing data)";
		}
	}

	async function setConsent(enabled) {
		await chrome.storage.local.set({ telemetry_consent: enabled });
		updateTelemetryUI(enabled);
		if (enabled) {
			showToast("Telemetry Enabled");
		} else {
			showToast("Telemetry Disabled");
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

				let iconHtml = `<span class="tech-icon-text">${tech.icon}</span>`;
				if (tech.website) {
					try {
						const domain = new URL(tech.website).hostname;
						const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
						// We use onerror to fallback to the emoji if the image fails or is transparent
						// (though google usually returns a default globe)
						// Actually simpler to just put img and if it fails hide it?
						// Google API practically always returns distinct image or generic globe.
						iconHtml = `<img src="${iconUrl}" alt="${tech.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
									<span class="tech-icon-text" style="display:none">${tech.icon}</span>`;
					} catch (e) {
						// Invalid URL, keep emoji
					}
				}

				card.innerHTML = `
					<div class="tech-icon">${iconHtml}</div>
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
	btnTheme.addEventListener("click", () => {
		const currentTheme = localStorage.getItem("theme") || "dark";
		const newTheme = currentTheme === "dark" ? "light" : "dark";

		if (newTheme === "light") {
			document.documentElement.setAttribute("data-theme", "light");
		} else {
			document.documentElement.removeAttribute("data-theme");
		}
		localStorage.setItem("theme", newTheme);
	});

	btnRefresh.addEventListener("click", () => {
		location.reload(); // Reload popup to re-init
	});

	// Telemetry Events
	btnTelemetry.addEventListener("click", async () => {
		const { telemetry_consent } =
			await chrome.storage.local.get("telemetry_consent");
		setConsent(!telemetry_consent);
	});

	btnAccept.addEventListener("click", () => {
		setConsent(true);
		onboardingOverlay.classList.add("hidden");
	});

	btnDecline.addEventListener("click", () => {
		setConsent(false);
		onboardingOverlay.classList.add("hidden");
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
