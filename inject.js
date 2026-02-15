/* ==========================================
   SaaS Stack Detector — MAIN World Scanner
   Accesses global variables to detect technologies.
   Injected by content.js
   ========================================== */

(function () {
	// Prevent running multiple times
	if (window.__stackDetectorInjected) return;
	window.__stackDetectorInjected = true;

	function globalScanner() {
		const results = [];
		const seen = new Set();
		const win = window;

		function add(item) {
			if (seen.has(item.name)) return;
			seen.add(item.name);
			results.push(item);
		}

		// ────────────────────────────────────────────────────────
		// 1️⃣ Simple Global Variable Checks
		// ────────────────────────────────────────────────────────
		const simpleGlobals = [
			// Frameworks
			{
				v: "__NEXT_DATA__",
				name: "Next.js",
				icon: "⚛️",
				category: "JavaScript Frameworks",
			},
			{
				v: "__NUXT__",
				name: "Nuxt.js",
				icon: "💚",
				category: "JavaScript Frameworks",
			},
			{
				v: "$nuxt",
				name: "Nuxt.js",
				icon: "💚",
				category: "JavaScript Frameworks",
			},
			{
				v: "__GATSBY",
				name: "Gatsby",
				icon: "💜",
				category: "Static Site Generators",
			},
			{
				v: "__SVELTE",
				name: "Svelte",
				icon: "🧡",
				category: "JavaScript Frameworks",
			},
			{
				v: "__remixContext",
				name: "Remix",
				icon: "💿",
				category: "Web Frameworks",
			},
			{
				v: "__SAPPER__",
				name: "Sapper",
				icon: "🧡",
				category: "Web Frameworks",
			},
			{
				v: "Turbo",
				name: "Hotwire Turbo",
				icon: "⚡",
				category: "Web Frameworks",
			},
			{
				v: "Stimulus",
				name: "Hotwire Stimulus",
				icon: "⚡",
				category: "Web Frameworks",
			},

			// UI Frameworks
			{
				v: "Vuetify",
				name: "Vuetify",
				icon: "🎨",
				category: "UI Frameworks",
			},
			{
				v: "Radix",
				name: "Radix UI",
				icon: "🎨",
				category: "UI Frameworks",
			},

			// Libraries
			{
				v: "__mobxGlobal",
				name: "MobX",
				icon: "📦",
				category: "JavaScript Libraries",
			},
			{
				v: "Motion",
				name: "Framer Motion",
				icon: "✨",
				category: "JavaScript Libraries",
			},

			// Tools
			{
				v: "webpackJsonp",
				name: "Webpack",
				icon: "📦",
				category: "Miscellaneous",
			},
			{
				v: "__vite_is_modern_browser",
				name: "Vite",
				icon: "⚡",
				category: "Miscellaneous",
			},

			// Platforms
			{
				v: "Shopify",
				name: "Shopify",
				icon: "🛒",
				category: "E-Commerce",
			},
			{
				v: "Webflow",
				name: "Webflow",
				icon: "🎨",
				category: "Website Builder",
			},
			{ v: "Wix", name: "Wix", icon: "🎨", category: "Website Builder" },

			// Security
			{
				v: "grecaptcha",
				name: "reCAPTCHA",
				icon: "🛡️",
				category: "Security",
			},
			{
				v: "hcaptcha",
				name: "hCaptcha",
				icon: "🛡️",
				category: "Security",
			},

			// Analytics / Feature Management
			{
				v: "statsig",
				name: "Statsig",
				icon: "📊",
				category: "Feature Management",
			},
			{
				v: "Statsig",
				name: "Statsig",
				icon: "📊",
				category: "Feature Management",
			},
			{
				v: "segment",
				name: "Segment",
				icon: "📊",
				category: "Analytics",
			},
			{
				v: "analytics",
				name: "Segment",
				icon: "📊",
				category: "Analytics",
			},
			{
				v: "gtag",
				name: "Google Tag",
				icon: "📊",
				category: "Analytics",
			},
			{
				v: "ga",
				name: "Google Analytics",
				icon: "📊",
				category: "Analytics",
			},
			{
				v: "fbq",
				name: "Facebook Pixel",
				icon: "📣",
				category: "Marketing",
			},
			{ v: "hj", name: "Hotjar", icon: "📊", category: "Analytics" },
			{
				v: "mixpanel",
				name: "Mixpanel",
				icon: "📊",
				category: "Analytics",
			},
			{
				v: "amplitude",
				name: "Amplitude",
				icon: "📊",
				category: "Analytics",
			},
			{
				v: "plausible",
				name: "Plausible",
				icon: "📊",
				category: "Analytics",
			},
			{ v: "_paq", name: "Matomo", icon: "📊", category: "Analytics" },

			// Support
			{
				v: "Intercom",
				name: "Intercom",
				icon: "💬",
				category: "Live Chat",
			},
			{ v: "drift", name: "Drift", icon: "💬", category: "Live Chat" },
			{
				v: "$crisp",
				name: "Crisp Live Chat",
				icon: "💬",
				category: "Live Chat",
			},
			{
				v: "Tawk_API",
				name: "Tawk.to",
				icon: "💬",
				category: "Live Chat",
			},
			{ v: "zE", name: "Zendesk", icon: "💬", category: "Live Chat" },

			// Error Tracking
			{
				v: "Sentry",
				name: "Sentry",
				icon: "🐛",
				category: "Error Tracking",
			},
			{
				v: "_LR",
				name: "LogRocket",
				icon: "🐛",
				category: "Error Tracking",
			},
			{
				v: "Rollbar",
				name: "Rollbar",
				icon: "🐛",
				category: "Error Tracking",
			},
			{
				v: "Bugsnag",
				name: "Bugsnag",
				icon: "🐛",
				category: "Error Tracking",
			},

			// Payments
			{ v: "Stripe", name: "Stripe", icon: "💳", category: "Payments" },
			{ v: "Paddle", name: "Paddle", icon: "💳", category: "Payments" },
			{
				v: "Chargebee",
				name: "Chargebee",
				icon: "💳",
				category: "Payments",
			},

			// Realtime
			{ v: "Pusher", name: "Pusher", icon: "⚡", category: "Realtime" },
			{ v: "io", name: "Socket.io", icon: "⚡", category: "Realtime" },

			// Maps
			{
				v: "google",
				check: "maps",
				name: "Google Maps",
				icon: "🗺️",
				category: "Maps",
			},
			{ v: "mapboxgl", name: "Mapbox", icon: "🗺️", category: "Maps" },
			{ v: "L", name: "Leaflet", icon: "🗺️", category: "Maps" },
		];

		simpleGlobals.forEach((g) => {
			try {
				if (typeof win[g.v] !== "undefined" && win[g.v] !== null) {
					// Check for nested property if strict check needed
					if (g.check && typeof win[g.v][g.check] === "undefined")
						return;

					// Extraction logic for simple versions (if available on the object directly)
					let version = null;
					if (win[g.v].version) version = win[g.v].version;

					add({
						name: g.name,
						icon: g.icon,
						category: g.category,
						method: "Global",
						version,
					});
				}
			} catch (e) {}
		});

		// ────────────────────────────────────────────────────────
		// 2️⃣ Advanced Checks (Prefixes, specific logic)
		// ────────────────────────────────────────────────────────

		// Webpack Chunk Check
		try {
			const wkeys = Object.keys(win).filter((k) =>
				k.startsWith("webpackChunk"),
			);
			if (wkeys.length > 0)
				add({
					name: "Webpack",
					icon: "📦",
					category: "Miscellaneous",
					method: "Global",
				});
		} catch (e) {}

		// React (fixed: double underscore prefix)
		try {
			if (
				win.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
				document.querySelector("[data-reactroot]")
			) {
				add({
					name: "React",
					icon: "⚛️",
					category: "JavaScript Frameworks",
					method: "Global",
				});
			}
		} catch (e) {}

		// Turbopack
		try {
			if (win.__TURBOPACK__ || win.__turbopack_require__) {
				add({
					name: "Turbopack",
					icon: "📦",
					category: "Development",
					method: "Global",
				});
			}
		} catch (e) {}

		// Angular
		try {
			if (win.ng || document.querySelector("[ng-version]")) {
				add({
					name: "Angular",
					icon: "🅰️",
					category: "JavaScript Frameworks",
					method: "Global",
				});
			}
		} catch (e) {}

		// Next.js (advanced)
		try {
			if (win.next && win.next.version) {
				add({
					name: "Next.js",
					icon: "⚛️",
					category: "JavaScript Frameworks",
					version: win.next.version,
					method: "Global",
				});
			}
		} catch (e) {}

		// core-js
		try {
			if (win["__core-js_shared__"]) {
				let ver = null;
				if (
					win["__core-js_shared__"].versions &&
					win["__core-js_shared__"].versions.length
				) {
					ver =
						win["__core-js_shared__"].versions[
							win["__core-js_shared__"].versions.length - 1
						].version;
				}
				add({
					name: "core-js",
					icon: "📦",
					category: "JavaScript Libraries",
					version: ver,
					method: "Global",
				});
			}
		} catch (e) {}

		// jQuery
		try {
			if (win.jQuery || win.$) {
				const ver =
					(win.jQuery || win.$).fn ?
						(win.jQuery || win.$).fn.jquery
					:	null;
				if (ver)
					add({
						name: "jQuery",
						icon: "📦",
						category: "JavaScript Libraries",
						version: ver,
						method: "Global",
					});
			}
		} catch (e) {}

		// Vue.js
		try {
			if (win.Vue) {
				add({
					name: "Vue.js",
					icon: "💚",
					category: "JavaScript Frameworks",
					version: win.Vue.version,
					method: "Global",
				});
			}
		} catch (e) {}

		return results;
	}

	// Run scanner and post message
	const results = globalScanner();
	window.postMessage({ type: "STACK_DETECTOR_GLOBALS", data: results }, "*");
})();
