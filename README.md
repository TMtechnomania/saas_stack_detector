# SaaS Stack Detector

**Current Version:** 1.0.0

A lightweight, developer-focused Chrome Extension that instantly detects the technology stack of any website you visit. It identifies generic technologies (like WordPress, React, Shopify) as well as specific SaaS tools (like HubSpot, Intercom, Segment, Google Analytics) by analyzing HTTP headers, JavaScript variables, and DOM elements.

## Features

- ⚡ **Instant Detection:** Scans headers and page content automatically.
- 🛠️ **Deep Analysis:** Recognizes 1000+ technologies across categories like CMS, Analytics, Marketing, CDN, and DevTools.
- 🔒 **Privacy-First:** All detection happens locally on your device. Telemetry is opt-in/opt-out and fully anonymous.
- 🎨 **Modern UI:** Clean, dark-mode interface with category grouping.

## Installation (Developer Mode)

1.  Clone this repository:
    ```bash
    git clone https://github.com/tmtechnomania/saas_stack_detector.git
    ```
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** in the top right corner.
4.  Click **"Load unpacked"**.
5.  Select the folder where you cloned this repository.

## Privacy Policy & Telemetry

This extension includes an optional telemetry feature to help the community improve detection accuracy.

### What Data We Collect

If you opt-in (or do not opt-out), the extension sends an anonymous report when it successfully detects a technology stack. This report contains only:

- **Domain Name:** The hostname of the site (e.g., `example.com`).
- **Detected Technologies:** The names and categories of tools found (e.g., "React", "Google Analytics").
- **Page URL:** The specific page URL where the technology was found, used to verify false positives/negatives.

**We DO NOT collect:**

- IP Addresses
- Cookies or Session Data
- Personal Information (PII)
- Browsing History (other than the specific active tab being analyzed)

### How to Opt-Out

You are in control. You can disable telemetry at any time:

1.  Open the extension popup.
2.  Scroll to the footer.
3.  Click the **Signal Icon** (bottom left) to toggle Telemetry **OFF**.
4.  The icon will turn gray, indicating no data is being sent.

---

## Chrome Web Store Listing

### Description

**Headline:** Instantly reveal the SaaS tools, frameworks, and libraries behind any website.

**Long Description:**
SaaS Stack Detector is the essential tool for developers, marketers, and sales professionals who need to know what technology a website is built with.

Unlike other heavy extensions, SaaS Stack Detector is designed to be lightweight and respectful of your privacy. It passively scans the website you are visiting to identify:

- **Frontend Frameworks:** React, Vue, Angular, Svelte, Tailwind CSS
- **CMS & Ecommerce:** WordPress, Shopify, Webflow, Magento
- **Analytics & Marketing:** Google Analytics, Segment, HubSpot, Hotjar
- **Server Tech:** Nginx, Apache, Varnish, PHP, Node.js
- **SaaS Tools:** Intercom, Zendesk, Stripe, Drift

**New in Version 1.0:**

- **AI-Enhanced Accuracy:** Improved detection rules for modern SPAs and headless CMS.
- **Community Data:** Optional anonymous sharing to help update our library of 1000+ signatures.
- **Dark Mode:** Sleek "Midnight Developer" theme by default.

### Justification for Permissions

To provide its core functionality, this extension requires the following permissions. Here is why we need them:

1.  **`activeTab`**:
    - **Reason:** To access the current page's URL and content only when you click the extension icon. This ensures we only scan pages you explicitly want to check.
2.  **`webRequest`**:
    - **Reason:** To passively analyze HTTP response headers (like `Server`, `X-Powered-By`) which often reveal backend technologies that are invisible in the HTML.
3.  **`scripting`**:
    - **Reason:** To inject a lightweight content script that checks for JavaScript variables (e.g., `window.React`) and specific DOM elements that indicate certain tools.
4.  **`storage`**:
    - **Reason:** To save your user preferences (like Dark/Light mode and Telemetry consent) locally on your device.
5.  **`webNavigation`**:
    - **Reason:** To reset the "Technology Count" badge when you navigate to a new page, ensuring the count is always accurate for the current site.
6.  **Host Permission: `*://*/*` (All URLs)**:
    - **Reason:** The extension needs to work on any website you visit, not just specific domains. We cannot predict which sites you will want to analyze.

---

## Contributing

Contributions are welcome! If you find a new technology signature or have a feature request, please open an issue or submit a Pull Request.

## License

[MIT](LICENSE)
