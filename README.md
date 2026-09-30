# 🛡️ QR Shield

**Scan a QR code. Analyze the destination before you open it.**

QR Shield is a browser-based QR security scanner that checks links for common phishing and "quishing" signals before the user navigates to them.

It supports camera-based scanning and image uploads, performs local URL analysis without requiring an API key, and can optionally query Google Safe Browsing for an additional threat-intelligence signal.

**[Live Demo](https://sydney-o-connor.github.io/qr-shield/)**

## Why QR Shield?

QR codes hide their destinations behind a visual interface.

Instead of seeing:

```text
https://example.com/login
```

a user sees:

```text
[ █ █ ▀ ▄ █ █ ]
[ ▄ █ ▀ █ ▄ ▀ ]
[ █ ▄ █ █ ▀ █ ]
```

That makes it easy to scan first and inspect the destination later—or never inspect it at all.

QR Shield reverses that workflow:

```text
QR code
   │
   ▼
Decode destination
   │
   ▼
Analyze URL
   │
   ├── suspicious signals ──► warn / block
   │
   └── no known signals ────► allow with warning
```

## How it works

### 1. Scan

QR Shield can decode a QR code using:

* the device camera
* an uploaded image

The QR decoding layer uses `jsQR`.

### 2. Analyze locally

Before opening the destination, QR Shield evaluates the URL against a set of heuristic checks.

Current signals include:

* non-HTTPS URLs
* raw IP addresses
* known URL shorteners
* Punycode / homograph-style domains
* suspicious or high-abuse TLDs
* excessive subdomains
* common phishing-related URL keywords
* `@` URL-disguise patterns

These checks run locally in the browser and do not require an API key.

### 3. Optional threat-intelligence check

Users can optionally configure a Google Safe Browsing API key.

When enabled, the decoded URL can also be checked against Google's threat database.

This gives the application two complementary layers:

```text
                 URL
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
 Local heuristics     Safe Browsing
        │                   │
        └─────────┬─────────┘
                  ▼
               Verdict
```

### 4. Present a verdict

QR Shield presents a visual result before navigation.

A URL with no detected warning signals can be opened directly.

A URL that triggers suspicious checks is placed behind an explicit confirmation step.

## Threat model

QR Shield is designed to help identify **suspicious destinations**, not to prove that a website is safe.

It is particularly focused on URL-level indicators that can be evaluated before navigation.

For example:

```text
https://paypal.com.secure-login.example.xyz
```

contains a suspicious domain structure even though it includes a familiar brand name.

Similarly:

```text
https://192.0.2.10/login
```

can be treated differently from a conventional domain-based URL.

The tool looks for signals like these before the browser opens the destination.

## Important limitations

**A green result does not mean a URL is guaranteed to be safe.**

It means only that the URL did not trigger the checks currently implemented by QR Shield.

The local heuristics can produce both:

* false positives
* false negatives

For example, a newly created malicious domain may not yet appear in a threat database and may not contain obvious URL patterns.

Likewise, a legitimate URL can occasionally resemble a suspicious pattern.

QR Shield should therefore be treated as a **first line of defense**, not a replacement for browser security, endpoint protection, threat intelligence, or user judgment.

This is a portfolio project rather than a production security product.

## Privacy

The local URL-analysis checks run in the browser.

When Safe Browsing integration is enabled, the URL is sent to Google's Safe Browsing API as part of that external check.

The optional API key is stored in the browser's `localStorage` and is not sent anywhere other than the configured Google API.

## Getting started

QR Shield is a static web application with no build step.

Clone the repository:

```bash
git clone https://github.com/sydney-o-connor/qr-shield.git
cd qr-shield
```

You can open `index.html` directly in a browser.

For camera access, serve the project through `localhost` or HTTPS:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Enable Safe Browsing checks

Safe Browsing integration is optional.

1. Obtain a Google Safe Browsing API key.
2. Open the QR Shield settings panel.
3. Paste the key.
4. Save the configuration.
5. Scan a QR code normally.

Without a key, the local heuristic engine still works.

## Project structure

```text
qr-shield/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── heuristics.js
│   └── safeBrowsing.js
└── assets/
```

### `app.js`

Handles the application flow:

* camera scanning
* image uploads
* QR decoding
* result rendering
* user interaction

### `heuristics.js`

Contains the local URL-analysis rules.

### `safeBrowsing.js`

Handles the optional Google Safe Browsing integration.

## Design goals

QR Shield was intentionally designed around three constraints:

### 1. Analyze before navigation

The application should have an opportunity to inspect the destination before the browser follows it.

### 2. Work without an external service

The basic security checks should function offline.

This keeps the core experience fast and avoids requiring an API key.

### 3. Make uncertainty visible

Security heuristics are imperfect.

Rather than presenting a binary "safe / unsafe" claim as absolute truth, the application uses its checks to identify risk signals and makes the limitations explicit.

## Roadmap

Potential improvements include:

* Redirect-chain analysis
* Shortened-URL expansion
* Domain-age signals
* Local scan history
* Progressive Web App support
* Batch QR-code analysis
* Additional threat-intelligence providers

Possible integrations include services such as VirusTotal, PhishTank, or urlscan.io, subject to their respective APIs and usage policies.

## Technology

* **HTML**
* **CSS**
* **JavaScript**
* **jsQR**
* **Google Safe Browsing API**
* **Client-side security heuristics**

## License

MIT — see [LICENSE](LICENSE).
