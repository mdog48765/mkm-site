// /api/send-email.js
import { Resend } from "resend";

const VERSION = "route-dual-005"; // <-- we will verify this shows up

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || "no-reply@mkmentertainmentllc.com";

// CORRECT inboxes:
const MKM   = "michaelkylemusic@icloud.com";
const PIZZA = "pizzarecords@aol.com";

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
    const {
      name = "",
      email = "",
      phone = "",
      service = "",
      date = "",
      message = "",
      bookingType = "",
      selectedService = "",
      addOns = [],
      subject = "MKM Booking Request",
    } = req.body || {};

    const normalizedType = (bookingType || "").trim().toLowerCase();
    const isPizza = normalizedType === "pizza records"; // STRICT match

    const textBody = `
Booking Type: ${bookingType || "N/A"}
Selected Service: ${selectedService || service || "N/A"}
Add-Ons: ${Array.isArray(addOns) && addOns.length ? addOns.join(", ") : "None"}
Event Date: ${date || "Not specified"}

From: ${name || "(no name)"}
Email: ${email || "(no email)"}
Phone: ${phone || "(no phone)"}

Message:
${message || "(no message)"}
`.trim();

    // Routing:
    //  - Pizza Records -> BOTH MKM + PR (single send with array `to`)
    //  - External     -> MKM only
    const recipients = isPizza ? [MKM, PIZZA] : [MKM];

    console.log("Routing email", {
      version: VERSION,
      bookingType,
      normalizedType,
      recipients,
      from: email,
      selectedService,
      addOns,
    });

    const result = await resend.emails.send({
      from: `MKM Website <${FROM}>`,
      to: recipients,      // string | string[]
      subject,
      text: textBody,
      reply_to: email || undefined,
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
