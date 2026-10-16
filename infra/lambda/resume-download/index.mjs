// mvcprogrammer.com resume download notifier.
// Publishes one SNS message per download, then redirects to the PDF on the
// site. The SNS message carries a different body per protocol: a short
// carrier-friendly text for SMS and a detailed report for email, built to
// make the visitor's IP address easy to look up. If anything in the lookup
// or publish fails the visitor still gets the file.
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { promises as dns } from "node:dns";

const sns = new SNSClient({});
const TOPIC_ARN = process.env.TOPIC_ARN;
const PDF_URL = process.env.PDF_URL;
// Each site edition's Resume button tags its edition (?edition=react). The matching
// resume variant sits beside the default PDF in S3 as Neal_Thomas_Resume-<edition>.pdf
// and carries a Portfolio section that links to that edition. Unknown or missing
// tags fall back to the default PDF.
const EDITIONS = new Set(["vanilla", "blazor", "angular", "react"]);
const QUIET_MS = 15 * 60 * 1000; // one alert per visitor IP per 15 minutes (per warm container)
const LOOKUP_MS = 1500;          // cap on how long the IP lookup may delay the redirect
const recent = new Map();

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slack|linkedinbot|whatsapp|telegram|discord|skype|twitterbot|headless|curl|wget|python-requests/i;

function browser(ua = "") {
  const b =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "browser";
  const os =
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b}/${os}` : b;
}

function host(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function stamp() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short"
  }).format(new Date());
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

// Geolocation, network owner and reverse DNS for the IP. ipinfo.io answers
// without a key for light use; reverse DNS is the fallback for the hostname.
async function lookup(ip) {
  const info = {};
  const geo = withTimeout(fetch(`https://ipinfo.io/${ip}/json`, { headers: { accept: "application/json" } }), LOOKUP_MS)
    .then(r => (r.ok ? r.json() : {}))
    .then(j => {
      if (j.hostname) info.hostname = j.hostname;
      if (j.org) info.org = j.org;
      const place = [j.city, j.region, j.country].filter(Boolean).join(", ");
      if (place) info.place = place;
      if (j.postal) info.postal = j.postal;
    })
    .catch(() => {});
  const ptr = withTimeout(dns.reverse(ip), LOOKUP_MS)
    .then(names => { if (!info.hostname && names?.[0]) info.hostname = names[0]; })
    .catch(() => {});
  await Promise.allSettled([geo, ptr]);
  return info;
}

function emailBody({ when, device, ip, info, source, ua }) {
  const location = info.place
    ? `${info.place}${info.postal ? " " + info.postal : ""} (approximate, from IP)`
    : "";
  const rows = [
    ["Device", device],
    ["IP", ip],
    ["Host", info.hostname],
    ["Network", info.org],
    ["Location", location],
    ["Source", source],
  ].filter(([, v]) => v);
  const width = Math.max(...rows.map(([k]) => k.length));
  return [
    `Resume downloaded ${when}`,
    "",
    ...rows.map(([k, v]) => `${k.padEnd(width)}  ${v}`),
    "",
    "Look up this IP:",
    `  https://ipinfo.io/${ip}`,
    `  https://search.arin.net/rdap/?query=${ip}`,
    `  https://www.abuseipdb.com/check/${ip}`,
    "",
    `User agent: ${ua || "(none)"}`,
  ].join("\n");
}

export const handler = async (event) => {
  const http = event.requestContext?.http ?? {};
  const headers = event.headers ?? {};
  const ip = http.sourceIp ?? "unknown";
  const ua = headers["user-agent"] ?? "";
  const ref = host(headers.referer ?? headers.referrer ?? "");
  const src = event.queryStringParameters?.src ?? "";
  const edition = EDITIONS.has(event.queryStringParameters?.edition) ? event.queryStringParameters.edition : "";
  const pdfUrl = edition ? PDF_URL.replace(/\.pdf$/i, `-${edition}.pdf`) : PDF_URL;

  const now = Date.now();
  for (const [k, t] of recent) if (now - t > QUIET_MS) recent.delete(k);
  const quiet = recent.has(ip);
  const isBot = BOT.test(ua) || http.method === "HEAD";

  if (!quiet && !isBot && TOPIC_ARN) {
    recent.set(ip, now);
    const when = stamp();
    const device = browser(ua);
    const source = [edition && `${edition} edition`, src ? `src ${src}` : ref ? `via ${ref}` : ""].filter(Boolean).join(", ");
    const info = await lookup(ip);

    // SMS body must keep the shape filed in the toll-free registration.
    const parts = [`Resume downloaded ${when}`, device, `ip ${ip}`];
    if (source) parts.push(source);
    const sms = `mvcprogrammer.com: ${parts.join(" · ")}. Reply STOP to end.`;
    const email = emailBody({ when, device, ip, info, source, ua });
    const subjectBits = ["Resume download", device, info.place?.split(",").slice(0, 2).join(",")].filter(Boolean);
    const subject = subjectBits.join(" | ").replace(/[^\x20-\x7E]/g, "").slice(0, 99);

    try {
      await sns.send(new PublishCommand({
        TopicArn: TOPIC_ARN,
        Subject: subject,
        MessageStructure: "json",
        Message: JSON.stringify({ default: email, email, sms }),
      }));
      console.log(JSON.stringify({ notified: true, ip, ua, ref, src, edition, info }));
    } catch (err) {
      console.error("SNS publish failed", err);
    }
  } else {
    console.log(JSON.stringify({ notified: false, quiet, isBot, ip, ua, edition }));
  }

  return {
    statusCode: 302,
    headers: {
      Location: pdfUrl,
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    body: ""
  };
};
