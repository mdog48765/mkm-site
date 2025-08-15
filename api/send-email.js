// api/send-email.js
import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name,
      email,
      phone,
      service,
      date,
      message,
      bookingType,
      selectedService,
      addOns,
      subject,
    } = req.body;

    if (!name || !email || !subject) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Decide who gets the email based on bookingType
    let recipients = [];
    if (bookingType === "Pizza Records") {
      recipients = [
        "pizzarecords@aol.com",         // Pizza Records
        "mkmentertainmentllc@icloud.com" // MKM copy
      ];
    } else {
      recipients = [
        "mkmentertainmentllc@icloud.com" // External bookings only go to MKM
      ];
    }

    const emailBody = `
      Name: ${name}
      Email: ${email}
      Phone: ${phone}
      Service: ${service}
      Date: ${date}
      Booking Type: ${bookingType}
      Selected Service: ${selectedService}
      Add-ons: ${Array.isArray(addOns) ? addOns.join(", ") : ""}
      Message: ${message}
    `;

    const results = [];
    for (const to of recipients) {
      const result = await resend.emails.send({
        from: "MKM Entertainment <no-reply@mkmentertainmentllc.com>",
        to,
        subject,
        text: emailBody,
      });
      results.push({ to, id: result.id });
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
