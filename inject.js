/* ==========================================
   SaaS Stack Detector — MAIN World Scanner
   Accesses global variables to detect technologies.
   Injected by content.js
   ========================================== */

(function () {
	// Prevent running multiple times
	if (window.__stackDetectorInjected) return;
	window.__stackDetectorInjected = true;

	// Helper to safely access deep properties (e.g. "google.maps")
	function getDeepValue(obj, path) {
		if (!path) return undefined;
		const parts = path.split(".");
		let current = obj;
		for (const part of parts) {
			if (current === null || typeof current === "undefined")
				return undefined;
			current = current[part];
		}
		return current;
	}

	function globalScanner(signatures) {
		const results = [];
		const seen = new Set();
		const win = window;

		function add(item) {
			const id = item.name;
			if (seen.has(id)) return;
			seen.add(id);
			results.push(item);
		}

		if (!signatures || !Array.isArray(signatures)) return results;

		// Iterate through signatures provided by content script
		signatures.forEach((sig) => {
			// sig.var is the global variable name (e.g. "jQuery" or "google.maps")
			if (!sig.var) return;

			try {
				const val = getDeepValue(win, sig.var);

				if (typeof val !== "undefined" && val !== null) {
					// Wappalyzer patterns often match against the value of the property

					let version = null;
					let matched = false;

					if (!sig.pattern) {
						// Simple existence check
						matched = true;
					} else {
						// Pattern check
						// If val is a string/number, check regex
						if (
							typeof val === "string" ||
							typeof val === "number"
						) {
							const strVal = String(val);
							try {
								const regex = new RegExp(sig.pattern, "i");
								const match = strVal.match(regex);
								if (match) {
									matched = true;
									// Verify if capture group exists for version
									if (match[1]) version = match[1];
								}
							} catch (e) {
								// Invalid regex or pattern issue
							}
						} else {
							// Value is object/function/array but we have a pattern.
							matched = true;
						}
					}

					if (matched) {
						add({
							name: sig.name,
							icon: sig.icon,
							category:
								(sig.categories && sig.categories[0]) ||
								"JavaScript Libraries",
							description: sig.description,
							website: sig.website,
							version, // Shorthand for version: version
							method: "Global",
						});
					}
				}
			} catch (e) {
				// Ignore access errors
			}
		});

		return results;
	}

	// Listen for configuration from Content Script
	window.addEventListener("message", (event) => {
		if (event.source !== window) return;
		if (event.data.type === "STACK_DETECTOR_INIT") {
			const signatures = event.data.signatures || [];

			// Run Scan
			const results = globalScanner(signatures);

			// Return Results
			window.postMessage(
				{ type: "STACK_DETECTOR_GLOBALS", data: results },
				"*",
			);
		}
	});
})();
