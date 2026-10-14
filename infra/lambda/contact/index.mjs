// mvcprogrammer.com contact form → email through Amazon SES.
// Deployed as a Lambda (Node.js 22, arm64) behind a Function URL. CORS is
// configured on the URL itself (AllowOrigins = ALLOWED_ORIGIN, POST, content-type).
//
// Env vars (set on the function, never in code):
//   TO_EMAIL        where messages are delivered
//   FROM_EMAIL      a verified SES identity, e.g. website@mvcprogrammer.com
//   ALLOWED_ORIGIN  comma-separated list of browser origins allowed to post,
//                   e.g. https://mvcprogrammer.com,https://blazor.mvcprogrammer.com
//
// Spam defenses, cheapest first: the browser Origin must match, a hidden
// "website" field must stay empty (honeypot), the form must have been open for
// a few seconds before submit, each IP gets a small hourly budget per warm
// container, and every field is length-capped and stripped of header breaks.

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});
const { TO_EMAIL, FROM_EMAIL, ALLOWED_ORIGIN } = process.env;
const ALLOWED_ORIGINS = new Set((ALLOWED_ORIGIN ?? "").split(",").map((o) => o.trim()).filter(Boolean));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_FILL_MS = 3000;            // humans take longer than this to write a message
const BUDGET = 3;                    // messages per IP per window
const WINDOW_MS = 60 * 60 * 1000;    // one hour
const TOPICS = new Set(["Job opportunity", "Contract or consulting", "Freelance", "Something else"]);
const REPLIES = new Set(["Email", "Phone call"]);
const MIN_PHONE_DIGITS = 7;
const sent = new Map();              // ip -> [timestamps] (per warm container)

const reply = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

const line = (v, max) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

function overBudget(ip, now) {
  const stamps = (sent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  sent.set(ip, stamps);
  if (stamps.length >= BUDGET) return true;
  stamps.push(now);
  return false;
}

export const handler = async (event) => {
  const http = event.requestContext?.http ?? {};
  if (http.method !== "POST") return reply(405, { error: "method" });

  const origin = event.headers?.origin ?? "";
  if (ALLOWED_ORIGINS.size && !ALLOWED_ORIGINS.has(origin)) return reply(403, { error: "origin" });

  let data;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString() : event.body;
    data = JSON.parse(raw ?? "{}");
  } catch {
    return reply(400, { error: "json" });
  }

  const ip = http.sourceIp ?? "unknown";
  const ua = line(event.headers?.["user-agent"], 300);
  const now = Date.now();

  // Honeypot and timing: answer as if it worked so bots learn nothing.
  const elapsed = Number(data.elapsed);
  if (data.website || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    console.log(JSON.stringify({ dropped: "bot", ip, ua, elapsed: data.elapsed ?? null, honeypot: Boolean(data.website) }));
    return reply(200, { ok: true });
  }

  if (overBudget(ip, now)) {
    console.log(JSON.stringify({ dropped: "budget", ip, ua }));
    return reply(429, { error: "rate" });
  }

  const name = line(data.name, 120);
  const email = line(data.email, 200);
  const topic = TOPICS.has(data.topic) ? data.topic : "Something else";
  const replyBy = REPLIES.has(data.reply) ? data.reply : "Email";
  const phone = replyBy === "Phone call" ? line(data.phone, 30) : "";
  const message = String(data.message ?? "").trim().slice(0, 5000);
  if (!name || !EMAIL_RE.test(email) || message.length < 10) return reply(400, { error: "validation" });
  if (replyBy === "Phone call" && phone.replace(/\D/g, "").length < MIN_PHONE_DIGITS) return reply(400, { error: "validation" });

  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(now));

  const body = [
    `From:   ${name} <${email}>`,
    `Topic:  ${topic}`,
    `Reply:  ${phone ? `${replyBy}, ${phone}` : replyBy}`,
    `Sent:   ${when}`,
    `IP:     ${ip}`,
    `Agent:  ${ua || "(none)"}`,
    "",
    message,
  ].join("\n");

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination: { ToAddresses: [TO_EMAIL] },
      ReplyToAddresses: [email],
      Content: {
        Simple: {
          Subject: { Data: `mvcprogrammer.com: ${topic} from ${name}`.replace(/[^\x20-\x7E]/g, "").slice(0, 120) },
          Body: { Text: { Data: body, Charset: "UTF-8" } },
        },
      },
    }));
  } catch (err) {
    console.error("SES send failed", err);
    return reply(502, { error: "send" });
  }

  console.log(JSON.stringify({ sent: true, ip, topic, ua }));
  return reply(200, { ok: true });
};
