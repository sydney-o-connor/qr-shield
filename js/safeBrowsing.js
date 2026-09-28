/**
 * safeBrowsing.js
 * Optional real threat-database lookup via Google's Safe Browsing API.
 * Only runs if the user has saved their own API key (stored in localStorage,
 * never sent anywhere except https://safebrowsing.googleapis.com).
 *
 * Get a free key: https://developers.google.com/safe-browsing/v4/get-started
 */

const SAFE_BROWSING_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

function getSavedApiKey() {
  return localStorage.getItem("qrshield_sb_api_key") || "";
}

function saveApiKey(key) {
  localStorage.setItem("qrshield_sb_api_key", key.trim());
}

function clearApiKey() {
  localStorage.removeItem("qrshield_sb_api_key");
}

/**
 * Checks a URL against Google Safe Browsing's threat lists.
 * Returns { checked: boolean, threatFound: boolean, threatTypes: string[], error?: string }
 */
async function checkSafeBrowsing(rawUrl) {
  const apiKey = getSavedApiKey();
  if (!apiKey) {
    return { checked: false, threatFound: false, threatTypes: [] };
  }

  const body = {
    client: { clientId: "qr-shield", clientVersion: "1.0.0" },
    threatInfo: {
      threatTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING",
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION",
      ],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: rawUrl }],
    },
  };

  try {
    const response = await fetch(`${SAFE_BROWSING_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { checked: true, threatFound: false, threatTypes: [], error: `API error (${response.status}): ${errText.slice(0, 120)}` };
    }

    const data = await response.json();
    const matches = data.matches || [];
    const threatTypes = matches.map((m) => m.threatType);

    return { checked: true, threatFound: matches.length > 0, threatTypes };
  } catch (err) {
    return { checked: true, threatFound: false, threatTypes: [], error: `Network error: ${err.message}` };
  }
}
