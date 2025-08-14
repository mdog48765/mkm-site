// File: api/send-email.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, route: "/api/send-email" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // read JSON body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const data = bodyText ? JSON.parse(bodyText) : {};

    const {
      name = "",
      email = "",
      phone = "",
      message = "",
      subject = "New MKM Website Inquiry",
      to,
    } = data;

    if (!message || !(email || phone || name)) {
      return res.status(400).json({
        error: "Missing required fields. Provide at least message and one of name/email/phone.",
      });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: "Server email not configured. Missing RESEND_API_KEY." });
    }

    const fromAddress = process.env.RESEND_FROM?.trim() || "no-reply@mkmentertainmentllc.com";
    const toAddress = to || "pizzarecords@aol.com";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 12px">MKM Website Inquiry</h2>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <hr/>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [toAddress], subject, html, reply_to: email || undefined }),
    });

    if (!resp.ok) {
      const err = await safeJson(resp);
      return res.status(502).json({ error: "Resend API error", details: err });
    }

    const json = await resp.json();
    return res.status(200).json({ ok: true, id: json.id || null });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function safeJson(resp) {
  try { return await resp.json(); }
  catch { return { status: resp.status, text: await resp.text().catch(()=>"") }; }
}
