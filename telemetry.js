const SUPABASE_URL = "https://ugvvlvdkjclkeccviefq.supabase.co";
const SUPABASE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVndnZsdmRramNsa2VjY3ZpZWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMjkxNTIsImV4cCI6MjA4NjcwNTE1Mn0.TL92uoo2_brq20SMQIA92uN72R4moOWDArUg7RnXJIA";
const ENDPOINT = `${SUPABASE_URL}/rest/v1/detections`;

// COOLDOWN: Only send data for a domain once every 24 hours
// stored in chrome.storage.local as { "telemetry_example.com": timestamp }
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getStorageKey(domain) {
	return `telemetry_${domain}`;
}

export async function sendDetections(detections, tabId) {
	if (!detections || detections.length === 0) return;

	try {
		// Check Consent
		const { telemetry_consent } =
			await chrome.storage.local.get("telemetry_consent");
		if (telemetry_consent !== true) {
			// console.log("[Telemetry] Aborted: No consent.");
			return;
		}

		const tab = await chrome.tabs.get(tabId);
		if (!tab || !tab.url) return;

		// Extract domain
		let domain;
		try {
			const urlObj = new URL(tab.url);
			domain = urlObj.hostname;
		} catch (e) {
			return;
		}

		// Skip local/internal domains
		if (domain === "localhost" || domain.includes("127.0.0.1")) return;

		// Check Storage Cooldown
		const storageKey = getStorageKey(domain);
		const storageData = await chrome.storage.local.get([storageKey]);
		const lastSent = storageData[storageKey];

		if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
			// console.log(`[Telemetry] Skipping ${domain} (Cooldown active)`);
			return;
		}

		// Prepare payload
		const payload = detections.map((tech) => ({
			domain: domain,
			tech_name: tech.name,
			category: (tech.categories && tech.categories[0]) || tech.category,
			url: tab.url,
		}));

		// Send to Supabase
		await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_KEY,
				Authorization: `Bearer ${SUPABASE_KEY}`,
				Prefer: "return=minimal",
			},
			body: JSON.stringify(payload),
		});

		// Update Cooldown
		await chrome.storage.local.set({ [storageKey]: Date.now() });

		// console.log(`[Telemetry] Sent ${payload.length} detections for ${domain}`);
	} catch (e) {
		// console.error("[Telemetry] Failed to send:", e);
	}
}
