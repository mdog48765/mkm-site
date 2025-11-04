// /api/send-email.js
import { Resend } from "resend";

const VERSION = "route-dual-006-guarded";

// === Setup ===
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || "no-reply@mkmentertainmentllc.com";

// CORRECT inboxes:
const MKM   = "michaelkylemusic@icloud.com";
const PIZZA = "pizzarecords@aol.com";

// Naive in-memory rate limit map (per Vercel instance)
globalThis._mkm_rl = globalThis._mkm_rl || new Map();

// === Small helpers ===
const trim = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(s ?? ""));
const getIP = (req) =>
  (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()) ||
  req.headers["x-real-ip"] ||
  req.socket?.remoteAddress ||
  "unknown";

// Basic content checks
function validatePayload(body = {}) {
  const errors = {};
  const name = trim(body.name);
  const email = trim(body.email);
  const phone = trim(body.phone);
  const service = trim(body.service || body.selectedService);
  const bookingType = trim(body.bookingType);
  const message = (body.message ?? "").toString().replace(/\r/g, ""); // keep newlines
  const company = trim(body.company || ""); // honeypot

  if (company.length > 0) errors.honeypot = "Spam detected.";
  if (name.length < 2) errors.name = "Name too short.";
  if (!isEmail(email)) errors.email = "Invalid email.";
  if (trim(message).length < 20) errors.message = "Message too short (≥ 20 chars).";
  if (!["Pizza Records", "External"].includes(bookingType))
    errors.bookingType = "Choose a valid booking type.";
  if (!service) errors.service = "Select a package.";

  // soft content caps (defense-in-depth; keep generous)
  if (message.length > 5000) errors.messageLength = "Message too long.";
  const linkCount = (message.match(/https?:\/\/|www\./gi) || []).length;
  if (linkCount > 5) errors.links = "Too many links.";

  return { errors, safe: { name, email, phone, service, bookingType, message } };
}

export default async function handler(req, res) {
  // CORS + disable caching
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, route: "/api/send-email", version: VERSION });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // NOTE: Next/Vercel API routes parse JSON by default; if using Edge runtime you may need await req.json()
    const body = req.body || {};

    // Validation (hard-block blanks/spam)
    const { errors, safe } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      // Honeypot or invalid input → 400/422
      const status = errors.honeypot ? 400 : 422;
      return res.status(status).json({ ok: false, error: "Invalid submission", details: errors });
    }

    // Rate limit (60s per IP)
    const ip = getIP(req);
    const last = globalThis._mkm_rl.get(ip) || 0;
    if (Date.now() - last < 60_000) {
      return res.status(429).json({ ok: false, error: "Too many requests. Try again shortly." });
    }
    globalThis._mkm_rl.set(ip, Date.now());

    // Routing
    const isPizza = safe.bookingType.trim().toLowerCase() === "pizza records";
    const recipients = isPizza ? [MKM, PIZZA] : [MKM];

    const subject = trim(
      body.subject ||
      `${isPizza ? "[Pizza Records]" : "[External]"} ${safe.service} — Booking Request`
    );

    const addOns = Array.isArray(body.addOns) ? body.addOns : [];
    const date = trim(body.date);

    const textBody = `
Booking Type: ${safe.bookingType}
Selected Service: ${safe.service}
Add-Ons: ${addOns.length ? addOns.join(", ") : "None"}
Event Date: ${date || "Not specified"}

From: ${safe.name}
Email: ${safe.email}
Phone: ${trim(safe.phone) || "(no phone)"}

Message:
${safe.message}
`.trim();

    console.log("Routing email", {
      version: VERSION,
      ip,
      bookingType: safe.bookingType,
      recipients,
      from: safe.email.replace(/(.{2}).+(@.+)/, "$1***$2"), // mask in logs
      service: safe.service,
      addOnsCount: addOns.length,
    });

    const result = await resend.emails.send({
      from: `MKM Website <${FROM}>`,
      to: recipients, // string | string[]
      subject,
      text: textBody,
      reply_to: safe.email || undefined,
      headers: { "List-Unsubscribe": "<mailto:no-reply@mkmentertainmentllc.com>" },
    });

    if (result?.error) {
      console.error("Resend error:", result.error);
      return res.status(502).json({ ok: false, error: "Email send failed", details: result.error });
    }

    return res.status(200).json({
      ok: true,
      version: VERSION,
      to: recipients,
      id: result?.data?.id || null,
    });
  } catch (e) {
    console.error("Email handler error:", e);
    return res.status(500).json({ ok: false, error: "Server error", details: e?.message || String(e) });
  }
}
