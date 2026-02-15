const fs = require("fs");
const https = require("https");
const path = require("path");

// Configuration
// We use a community fork that maintains compatibility
const REPO_OWNER = "enthec";
const REPO_NAME = "webappanalyzer";
const BRANCH = "main";
const TECH_DIR = "src/technologies";

const OUTPUT_FILE = path.join(__dirname, "signatures.json");

// Categories mapping (Wappalyzer uses IDs, we might need to map them if we want names)
// identifying categories is complex without the categories.json file too.
// For this script, we'll just download the technologies and try to keep the structure compatible
// with our extension's simple format if possible, or just dump the raw Wappalyzer format
// and let the extension adapt (which would require extension code changes).
//
// CURRENT STRATEGY:
// The extension uses a specific simple format (scripts, dom, headers, cookies).
// Wappalyzer format is different (cats, implies, patterns in different fields).
// Unifying them automatically is hard.
//
// INSTEAD: This script downloads the raw technologies.json from a time BEFORE it was split,
// OR fetches the split files and combines them.
//
// Let's try to fetch a known good combined file from detailed-technologies or similar.
// Actually, 'enthec' has the split files.
//
// Alternative: Use a static snapshot I can embed or download.
//
// Let's just create a placeholder that explains this complexity.
// Actually, the user asked for a "dataset".
// Let's write a script that fetches the *split* files and combines them into one JSON.

const BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${TECH_DIR}/`;
const LETTERS = "abcdefghijklmnopqrstuvwxyz_".split("");

async function fetchJson(filename) {
	return new Promise((resolve, reject) => {
		https
			.get(`${BASE_URL}${filename}`, (res) => {
				if (res.statusCode !== 200) {
					if (res.statusCode === 404) return resolve({}); // Some letters might be empty
					return reject(
						new Error(
							`Failed to fetch ${filename}: ${res.statusCode}`,
						),
					);
				}
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						reject(e);
					}
				});
			})
			.on("error", reject);
	});
}

async function main() {
	console.log(`Fetching signatures from ${REPO_OWNER}/${REPO_NAME}...`);

	const allTechnologies = {};

	for (const letter of LETTERS) {
		try {
			const filename = `${letter}.json`;
			console.log(`Fetching ${filename}...`);
			const tech = await fetchJson(filename);
			Object.assign(allTechnologies, tech);
		} catch (e) {
			console.error(`Error fetching letter ${letter}:`, e.message);
		}
	}

	console.log(`Fetched ${Object.keys(allTechnologies).length} technologies.`);

	// Save raw Wappalyzer format
	fs.writeFileSync(
		"wappalyzer_technologies.json",
		JSON.stringify(allTechnologies, null, 2),
	);
	console.log("Saved to wappalyzer_technologies.json");
	console.log(
		"NOTE: This file uses Wappalyzer format (categories as IDs, implies, etc).",
	);
	console.log(
		"You will need to adapt the extension logic to read this format if you want to replace signatures.json entirely.",
	);
}

main();
