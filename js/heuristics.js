/**
 * heuristics.js
 * Local, offline checks that flag common QR-phishing ("quishing") patterns.
 * These run instantly with no network call and no API key required.
 *
 * NOTE: These are signals, not proof. A "pass" means nothing suspicious was
 * detected locally — not that the link is guaranteed safe.
 */

const KNOWN_SHORTENERS = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "qr.ae",
  "lnkd.in", "s.id", "v.gd"
];

const SUSPICIOUS_TLDS = [
  ".zip", ".mov", ".xyz", ".top", ".gq", ".tk", ".ml", ".cf", ".ga",
  ".work", ".click", ".loan", ".men", ".date", ".stream", ".review"
];

const PHISHING_KEYWORDS = [
  "verify-account", "confirm-payment", "secure-login", "account-update",
  "signin-verify", "wallet-connect", "reset-password-now", "suspended-account",
  "unlock-account", "urgent-action"
];

function runHeuristicChecks(rawUrl) {
  const reasons = [];
  let url;

  try {
    url = new URL(rawUrl);
  } catch (e) {
    return {
      isUrl: false,
      flagged: false,
      reasons: [{ text: "Not a URL — this QR code contains plain text or other data, not a link.", type: "pass" }],
    };
  }

  const hostname = url.hostname.toLowerCase();

  // 1. Protocol check
  if (url.protocol !== "https:") {
    reasons.push({ text: `Not using HTTPS (uses "${url.protocol}") — traffic isn't encrypted.`, type: "flag" });
  } else {
    reasons.push({ text: "Uses HTTPS encryption.", type: "pass" });
  }

  // 2. Raw IP address as host
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
  if (isIp) {
    reasons.push({ text: "Link points to a raw IP address instead of a domain name — a common evasion tactic.", type: "flag" });
  }

  // 3. Known URL shortener (hides the real destination)
  const isShortener = KNOWN_SHORTENERS.some((s) => hostname === s || hostname.endsWith("." + s));
  if (isShortener) {
    reasons.push({ text: `Uses a URL shortener (${hostname}) — the real destination is hidden until you click.`, type: "flag" });
  }

  // 4. Punycode / homograph attack (lookalike domains using non-Latin characters)
  if (hostname.startsWith("xn--") || hostname.includes(".xn--")) {
    reasons.push({ text: "Domain uses Punycode encoding — often used to fake lookalike domains (e.g. Cyrillic characters mimicking Latin ones).", type: "flag" });
  }

  // 5. Suspicious / low-cost TLDs frequently abused for phishing
  const hasSuspiciousTld = SUSPICIOUS_TLDS.some((tld) => hostname.endsWith(tld));
  if (hasSuspiciousTld) {
    reasons.push({ text: `Uses a top-level domain (${hostname.slice(hostname.lastIndexOf("."))}) frequently associated with spam and phishing campaigns.`, type: "flag" });
  }

  // 6. Excessive subdomains (e.g. paypal.com.secure-login.xyz)
  const subdomainCount = hostname.split(".").length - 2;
  if (subdomainCount >= 3) {
    reasons.push({ text: "Unusually many subdomains — sometimes used to make a fake domain look like a trusted one.", type: "flag" });
  }

  // 7. Phishing-style keywords in the URL
  const fullUrlLower = rawUrl.toLowerCase();
  const matchedKeyword = PHISHING_KEYWORDS.find((kw) => fullUrlLower.includes(kw));
  if (matchedKeyword) {
    reasons.push({ text: `URL contains a common phishing phrase ("${matchedKeyword}").`, type: "flag" });
  }

  // 8. "@" in URL (browsers ignore everything before an "@", used to fake a trusted prefix)
  if (rawUrl.includes("@")) {
    reasons.push({ text: 'Contains an "@" symbol — can be used to disguise the real destination (everything before it is ignored by browsers).', type: "flag" });
  }

  // 9. Very long hostname (obfuscation / automated generation)
  if (hostname.length > 45) {
    reasons.push({ text: "Unusually long domain name — sometimes a sign of auto-generated phishing infrastructure.", type: "flag" });
  }

  if (!reasons.some((r) => r.type === "flag")) {
    reasons.push({ text: "No suspicious patterns found in the URL structure.", type: "pass" });
  }

  const flagged = reasons.some((r) => r.type === "flag");

  return { isUrl: true, flagged, reasons, hostname };
}
