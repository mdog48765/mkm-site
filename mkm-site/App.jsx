import React, { useMemo, useState, useEffect } from "react";

/* ===== Imports for dynamic content ===== */
import GALLERY from "./galleryList.json";      // built by scripts/build-gallery.mjs
import SHOWS from "./shows.json";              // you edit this by hand

/* ===== Business info ===== */
const CONTACT_EMAIL = "michaelkylemusic@icloud.com"; // display-only email
const PIZZA_RECORDS_EMAIL = "pizzarecords@aol.com";
const BUSINESS_PHONE_DISPLAY = "(217) 883-0078";
const BUSINESS_PHONE_TEL = "+12178830078";
const PIZZA_RECORDS_PHONE_DISPLAY = "(217) 200-0896";
const PIZZA_RECORDS_PHONE_TEL = "+12172000896";
const VENUE_ADDRESS = "59 E Central Park Plaza, Jacksonville, IL 62650";
const LOGO_SRC = "/thumbnail_MKM%20Entertainment%20logo.png"; // file is in /public

/* ===== API endpoint (kept local-relative; Vercel routes /api) ===== */
const API_URL = "/api/send-email";

/* ===== Helpers ===== */
const trim = (s) => (s || "").replace(/\s+/g, " ").trim();
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(s || ""));

/* ===== Date helpers for shows ===== */
// keeps your existing helper (safe parse YYYY-MM-DD) for future use
function parseYMD(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}

/* ===== Reusable UI ===== */
function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="col-span-1 text-white/60">{label}</div>
      <div className="col-span-3">{value}</div>
    </div>
  );
}

/* ===== About Section ===== */
function AboutSection() {
  return (
    <section id="about" className="py-16 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3 items-start">
          {/* Photo + caption */}
          <div className="md:col-span-1">
            <img
              src="/images/michael-mixing.jpg"
              alt="Michael Kyle mixing a live event"
              className="rounded-2xl border border-white/10 object-cover w-full"
            />
            <p className="text-sm text-white/50 mt-2 italic text-center">Humble Beginnings</p>
          </div>

          {/* Text */}
          <div className="md:col-span-2">
            <h2 className="text-3xl sm:text-4xl font-bold">About MKM Entertainment</h2>
            <div className="mt-6 space-y-4 text-white/80">
              <p>
                MKM Entertainment started with a small, well-used, “Frankensteined” sound system and a mission:
                deliver affordable, quality sound to anyone ready to step into the world of live entertainment. From
                weddings to raves, rock shows to hip hop nights, and everything in between — we’ve done it all.
              </p>
              <p>Now in our third year of professionally running sound and lighting, we’ve grown into a trusted partner for events across Illinois.</p>
              <p>
                While we don’t currently handle sound for crowds over 400, we’re scaling toward serving all markets —
                big and small — with the same focus: quality production at fair prices. Our QSC rig is crystal-clear,
                plenty loud, and dynamic enough for everything from speeches and corporate events to local music festivals.
              </p>
              <p>
                We keep the whole process streamlined and stress-free — from booking to showtime to teardown — with
                clear communication and a balance of professionalism and customer care.
              </p>
              <p>
                Our partnership with Pizza Records has been pivotal to our growth, serving the community with
                affordable, regular, high-quality entertainment while simplifying production for both seasoned and
                first-time promoters.
              </p>
              <blockquote className="italic border-l-4 border-red-600 pl-4">
                “They were easy to work with and professional.”
              </blockquote>
              <p>
                <strong>About the Owner:</strong> I’m Michael Kyle — founder, owner, and operator of MKM
                Entertainment. I’m hands-on every step and committed to expanding our reach. A great night is a
                smooth-flowing show with great vibes — everyone working together to deliver an amazing experience.
              </p>
              <p>
                Based in Jacksonville, IL. Directly partnered with Pizza Records. We travel anywhere in Illinois
                (mileage applies outside the local area). Proud member of Harmony Lodge No. 3.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Safe image for Gallery ===== */
function SafeImg({ jpg, webp, alt }) {
  const [broken, setBroken] = useState(false);
  return (
    <picture>
      {!broken && <source srcSet={webp} type="image/webp" />}
      <img
        src={broken ? "/images/fallback.png" : jpg}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="aspect-video object-cover rounded-xl border border-white/10"
      />
    </picture>
  );
}

/* ===== Upcoming & Past Shows (Pizza Records) =====
   - Edit src/shows.json with strings like:
     { "dateText": "Sat, Nov 9", "timeText": "Doors 7 PM • Music 8 PM", "sortDate": "2025-11-09T19:00", ... }
   - `sortDate` should be ISO (YYYY-MM-DDTHH:mm) so we can auto-sort and move past shows.
*/
function UpcomingShows() {
  // source data (guard for non-arrays)
  const shows = Array.isArray(SHOWS) ? SHOWS : [];

  // start-of-today in local time
  const todayStart = startOfToday();

  // keep only shows with a valid sortDate we can parse
  const valid = shows.filter(
    (s) => s && s.sortDate && !Number.isNaN(new Date(s.sortDate).getTime())
  );

  // chronological sort (oldest -> newest)
  const sorted = [...valid].sort(
    (a, b) => new Date(a.sortDate) - new Date(b.sortDate)
  );

  // split by today
  const upcoming = sorted.filter((s) => new Date(s.sortDate) >= todayStart);

  if (upcoming.length === 0) {
    return (
      <section id="shows" className="py-16 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Upcoming Shows</h2>
          <p className="mt-4 text-white/70">No shows announced yet. Check back soon.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="shows" className="py-16 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold">Upcoming Shows</h2>
        <p className="mt-2 text-sm text-white/60">Click photo to view full flyer</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e) => (
            <article
              key={e.id || `${e.dateText}-${e.title}`}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] overflow-hidden"
            >
              {e.flyer ? (
                <a
                  href={e.flyer}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-black"
                  aria-label={`Open flyer for ${e.title}`}
                >
                  <img
                    src={e.flyer}
                    alt={`${e.title} flyer`}
                    className="w-full h-auto object-contain border-b border-white/10"
                    loading="lazy"
                  />
                </a>
              ) : null}

              <div className="p-5 space-y-2">
                <h3 className="text-xl font-semibold">{e.title}</h3>
                <p className="text-white/70">
                  {e.dateText || "Date TBA"}{e.timeText ? ` • ${e.timeText}` : ""} • Pizza Records, Jacksonville IL
                </p>

                <dl className="text-sm text-white/80 grid grid-cols-2 gap-x-4 gap-y-1">
                  {e.price && (<><dt className="text-white/60">Price</dt><dd>{e.price}</dd></>)}
                  {e.ages  && (<><dt className="text-white/60">Ages</dt><dd>{e.ages}</dd></>)}
                </dl>

                {Array.isArray(e.lineup) && e.lineup.length > 0 && (
                  <p className="text-sm text-white/80">
                    <span className="text-white/60">Lineup: </span>{e.lineup.join(", ")}
                  </p>
                )}

                {e.notes && <p className="text-sm text-white/60">{e.notes}</p>}

                <div className="pt-2 flex gap-3">
                  {e.ticketUrl ? (
                    <a
                      href={e.ticketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
                    >
                      Get Tickets
                    </a>
                  ) : (
                    <span className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm text-white/80">
                      Tickets at the door
                    </span>
                  )}
                  {e.flyer && (
                    <a
                      href={e.flyer}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm hover:border-white/40"
                    >
                      View Flyer
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PastShows() {
  // source data (guard)
  const shows = Array.isArray(SHOWS) ? SHOWS : [];

  const todayStart = startOfToday();

  // valid + sort (newest first for past)
  const valid = shows.filter(
    (s) => s && s.sortDate && !Number.isNaN(new Date(s.sortDate).getTime())
  );
  const sorted = [...valid].sort(
    (a, b) => new Date(b.sortDate) - new Date(a.sortDate)
  );

  // past only
  const past = sorted.filter((s) => new Date(s.sortDate) < todayStart).slice(0, 12);

  if (past.length === 0) return null;

  return (
    <section id="past-shows" className="py-16 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold">Past Shows</h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {past.map((e) => (
            <article
              key={`past-${e.id || `${e.dateText}-${e.title}`}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              {e.flyer ? (
                <a
                  href={e.flyer}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-black"
                  aria-label={`Open flyer for ${e.title}`}
                >
                  <img
                    src={e.flyer}
                    alt={`${e.title} flyer`}
                    className="w-full h-auto object-contain border-b border-white/10"
                    loading="lazy"
                  />
                </a>
              ) : null}

              <div className="p-5 space-y-2">
                <h3 className="text-lg font-semibold">{e.title}</h3>
                <p className="text-white/60">
                  {e.dateText || "Date"}{e.timeText ? ` • ${e.timeText}` : ""}
                </p>
                {Array.isArray(e.lineup) && e.lineup.length > 0 && (
                  <p className="text-sm text-white/70">
                    <span className="text-white/50">Lineup: </span>{e.lineup.join(", ")}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===== Validation ===== */
function validateForm(form, bookingType, selectedService, addOns) {
  const errs = {};
  const name = trim(form.get("name"));
  const email = trim(form.get("email"));
  const phone = trim(form.get("phone"));
  const message = trim(form.get("message"));
  const date = trim(form.get("date"));
  const service = trim(
    selectedService ||
      form.get("service") ||
      (bookingType === "External" ? "External – Compact PA" : "Pizza Records – Basic")
  );
  const company = trim(form.get("company")); // honeypot

  if (company.length > 0) {
    errs.honeypot = "Spam detected.";
  }
  if (name.length < 2) {
    errs.name = "Enter your full name (≥2 characters).";
  }
  if (!isEmail(email)) {
    errs.email = "Enter a valid email.";
  }
  if (message.length < 20) {
    errs.message = "Please provide more detail (≥20 characters).";
  }
  if (!service) {
    errs.service = "Please select a package.";
  }
  if (!["Pizza Records", "External"].includes(bookingType)) {
    errs.bookingType = "Choose a booking type.";
  }
  if (bookingType === "External" && addOns.length > 12) {
    errs.addOns = "Too many add-ons selected.";
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errs.date = "Invalid date.";
  }

  return errs;
}

/* ===== Main App ===== */
export default function App() {
  const [logoBroken, setLogoBroken] = useState(false);

  // Booking/cart state
  const [bookingType, setBookingType] = useState("Pizza Records"); // "Pizza Records" | "External"
  const [selectedService, setSelectedService] = useState(""); // package name
  const [addOns, setAddOns] = useState([]); // only for External

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [errors, setErrors] = useState({}); // field-level errors
  const [messagePreviewLen, setMessagePreviewLen] = useState(0); // live count

  // Client throttle (60s)
  const [canSubmit, setCanSubmit] = useState(true);
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem("mkm_last_submit_ts") || "0");
      setCanSubmit(Date.now() - last > 60_000);
    } catch {
      setCanSubmit(true);
    }
  }, [submitting, sent]);

  /* ===== Packages & Add-ons ===== */
  const pizzaPackages = useMemo(
    () => [
      { title: "Pizza Records – Basic", price: "$250", features: ["Venue space and sound"] },
      { title: "Pizza Records – Preferred", price: "$300", features: ["Venue space", "Sound", "Lighting"] },
      {
        title: "Pizza Records – Preferred PLUS",
        price: "$350",
        popular: true,
        features: ["Venue Space", "Sound", "Lighting", "Multi-track sound recording (No mastering, only files)"],
      },
      {
        title: "Pizza Records – Premium",
        price: "$450",
        features: [
          "Venue space",
          "Sound",
          "Lighting",
          "Projected Visuals",
          "Multi-track sound recording with Mastering",
          "Video recording and editing",
        ],
      },
    ],
    []
  );

  const externalPackages = useMemo(
    () => [
      {
        title: "External – Compact PA",
        price: "$250/day",
        features: [
          "2× QSC K12.2 tops",
          "1× QSC KS118 sub",
          "2 floor monitors",
          "2 wireless mics",
          "Basic mixer",
          "Delivery & setup included",
          "Operator included",
        ],
      },
      {
        title: "External – Full PA",
        price: "$350/day",
        popular: true,
        features: [
          "2× QSC K12.2 tops",
          "2× QSC KS118 subs",
          "4 floor monitors",
          "Full mic kit",
          "TouchMix 16 with operator",
          "Delivery & setup included",
          "Operator included",
        ],
      },
      {
        title: "External – Festival Rig",
        price: "$400/day",
        features: [
          "2× QSC K12.2 tops",
          "3× QSC KS118 subs",
          "4 floor monitors",
          "Full mic kit",
          "TouchMix 16 with operator",
          "Delivery & setup included",
          "Operator included",
        ],
      },
    ],
    []
  );

  const externalAddOns = useMemo(
    () => [
      { key: "Standard Lighting — $50", label: "Standard Lighting — $50 (4 small PARs, 2 thick PARs, DMX control)" },
      {
        key: "Moving Lights & Special FX — $100",
        label:
          "Moving Lights & Special FX — $100 (incl. Standard, +2 moving heads, 2 spider lights, laser box, fog)",
      },
      { key: "Full Lighting Show — $150", label: "Full Lighting Show — $150 (all above + 4 DJ boxes, 15 ft truss)" },
      { key: "Projected Visuals — $150", label: "Projected Visuals — $150 (1080p UST projector & screen)" },
      {
        key: "Live Multitrack Recording — $50",
        label: "Live Multitrack Recording — $50 (per-channel capture for post mix/master)",
      },
    ],
    []
  );

  /* ===== UI helpers ===== */
  function scrollToId(id) {
    const el = document.querySelector(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function selectPackage(title) {
    setSelectedService(title);
    if (bookingType === "External") {
      scrollToId("#addons");
    } else {
      scrollToId("#cart");
    }
  }

  function toggleAddOn(key) {
    setAddOns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function clearCart() {
    setSelectedService("");
    setAddOns([]);
  }

  /* ===== UI ===== */
  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600/40">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/70 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a href="#home" className="flex items-center gap-3">
            {logoBroken ? (
              <div className="h-20 w-20 rounded bg-red-600" aria-label="MKM Logo" />
            ) : (
              <img
                src={LOGO_SRC}
                alt="MKM Logo"
                className="h-20 w-20 object-contain"
                onError={() => setLogoBroken(true)}
              />
            )}
          </a>
          <nav className="flex items-center gap-5 text-sm">
            <a href="#gallery" className="hover:text-red-400">Gallery</a>
            <a href="#shows" className="hover:text-red-400">Shows</a>
            <a href="#about" className="hover:text-red-400">About</a>
            <a href="#book" className="hover:text-red-400">Book</a>
            <a href="#contact" className="inline-flex items-center rounded-full bg-red-600 px-4 py-2 font-medium hover:bg-red-500 transition">
               Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <p className="text-sm text-white/60">Jacksonville, Illinois • Weekends at Pizza Records</p>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">Get Off The Couch!!</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Full-service shows at Pizza Records and professional sound equipment rentals. Modern, sleek production by design.
          </p>
          <div className="mt-8">
            <a
              href="#book"
              className="inline-flex items-center rounded-full bg-red-600 px-6 py-3 font-semibold hover:bg-red-500 transition"
            >
              Book Now
            </a>
          </div>
        </div>
      </section>

      {/* Gallery (directly under Hero) */}
      <section id="gallery" className="py-16 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Gallery</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GALLERY.map((g, i) => (
              <SafeImg key={g.jpg} jpg={g.jpg} webp={g.webp} alt={`Event photo ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming & Past Shows */}
      <UpcomingShows />
      <PastShows />

      {/* About */}
      <AboutSection />

      {/* Booking */}
      <section id="book" className="py-16 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Book a Show</h2>
          <p className="mt-3 text-white/70">Choose the location, pick a package, and (for External) add any extras.</p>

          {/* Tabs */}
          <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 p-1 shadow-sm">
            {["Pizza Records", "External"].map((t) => {
              const active = bookingType === t;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setBookingType(t);
                    setSelectedService("");
                    if (t === "Pizza Records") setAddOns([]);
                  }}
                  aria-selected={active}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition outline-none ${
                    active
                      ? "bg-red-600 shadow ring-1 ring-red-400/40"
                      : "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
                  }`}
                >
                  {t === "External" ? "External Booking" : "Pizza Records"}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            {/* Packages */}
            <div className="lg:col-span-2 space-y-8">
              {bookingType === "Pizza Records" && (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {pizzaPackages.map((p) => (
                    <div
                      key={p.title}
                      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 flex flex-col
                        ${
                          selectedService === p.title
                            ? "ring-2 ring-red-500"
                            : "hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 transition"
                        }`}
                    >
                      {p.popular && (
                        <span className="self-end -mt-3 mb-2 inline-flex items-center rounded-full bg-red-600 px-2 py-1 text-xs font-semibold shadow">
                          Most popular
                        </span>
                      )}
                      <h3 className="text-lg font-semibold">{p.title}</h3>
                      <p className="mt-1 text-2xl font-extrabold text-red-400">{p.price}</p>
                      {p.features?.length > 0 && (
                        <ul className="mt-4 space-y-2 text-sm text-white/80">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => selectPackage(p.title)}
                        className="mt-6 inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
                      >
                        {selectedService === p.title ? "Selected" : "Select"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {bookingType === "External" && (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {externalPackages.map((p) => (
                      <div
                        key={p.title}
                        className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 flex flex-col
                          ${
                            selectedService === p.title
                              ? "ring-2 ring-red-500"
                              : "hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 transition"
                          }`}
                      >
                        {p.popular && (
                          <span className="self-end -mt-3 mb-2 inline-flex items-center rounded-full bg-red-600 px-2 py-1 text-xs font-semibold shadow">
                            Most popular
                          </span>
                        )}
                        <h3 className="text-lg font-semibold">{p.title}</h3>
                        <p className="mt-1 text-2xl font-extrabold text-red-400">{p.price}</p>
                        <ul className="mt-4 space-y-2 text-sm text-white/80">
                          {p.features?.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => selectPackage(p.title)}
                          className="mt-6 inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
                        >
                          {selectedService === p.title ? "Selected" : "Select"}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add-ons */}
                  <div id="addons" className="rounded-2xl border border-white/10 p-6 bg-white/[0.04]">
                    <h4 className="text-base font-semibold">Add-ons</h4>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {externalAddOns.map((a) => (
                        <label
                          key={a.key}
                          className={`flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 cursor-pointer
                            ${addOns.includes(a.key) ? "bg-white/[0.08]" : "bg-white/[0.03] hover:bg-white/[0.06]"}`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-red-600"
                            checked={addOns.includes(a.key)}
                            onChange={() => toggleAddOn(a.key)}
                          />
                          <span className="text-sm">{a.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-white/60">
                      Operator included when we run equipment. Travel outside local area billed at $0.50/mi (round trip).
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Cart */}
            <aside
              id="cart"
              className="lg:sticky lg:top-24 h-fit rounded-2xl border border-white/10 p-6 bg-gradient-to-br from-white/5 to-white/[0.02]"
            >
              <h3 className="text-xl font-semibold">Your Selection</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-4 gap-2">
                  <dt className="col-span-2 text-white/60">Booking Type</dt>
                  <dd className="col-span-2">{bookingType}</dd>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <dt className="col-span-2 text-white/60">Package</dt>
                  <dd className="col-span-2">{selectedService || "—"}</dd>
                </div>
                {bookingType === "External" && (
                  <div className="grid grid-cols-4 gap-2">
                    <dt className="col-span-2 text-white/60">Add-ons</dt>
                    <dd className="col-span-2">{addOns.length ? addOns.join(", ") : "None"}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setSelectedService("");
                    setAddOns([]);
                  }}
                  className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm hover:border-white/40"
                >
                  Clear
                </button>
                <button
                  onClick={() => scrollToId("#contact")}
                  className="inline-flex rounded-full bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
                >
                  Proceed to Contact
                </button>
              </div>

              <p className="mt-3 text-xs text-white/60">This summary is included in your booking request.</p>
            </aside>
          </div>
        </div>
      </section>

      {/* Contact & Booking */}
      <section id="contact" className="py-16 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Contact & Booking</h2>
          <p className="mt-3 text-white/70 max-w-2xl">Tell us about your event and we’ll get you on the calendar.</p>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitting) return;
                setSubmitting(true);
                setSent(false);
                setErrorMsg("");
                setErrors({});

                if (!canSubmit) {
                  setSubmitting(false);
                  setErrorMsg("Please wait a moment before sending again.");
                  return;
                }

                const formEl = e.currentTarget;
                const form = new FormData(formEl);

                const msgLen = trim(form.get("message") || "").length;
                setMessagePreviewLen(msgLen);

                // Validate
                const vErrs = validateForm(form, bookingType, selectedService, addOns);
                if (Object.keys(vErrs).length > 0) {
                  setErrors(vErrs);
                  setErrorMsg(vErrs.honeypot ? "Submission blocked by spam filter." : "Fix the highlighted fields.");
                  setSubmitting(false);
                  return;
                }

                const isPizzaBooking = bookingType === "Pizza Records";
                const subjectTag = isPizzaBooking ? "[Pizza Records]" : "[External]";
                const chosenService =
                  selectedService || form.get("service") || (isPizzaBooking ? "Pizza Records – Basic" : "External – Compact PA");

                const payload = {
                  name: trim(form.get("name") || ""),
                  email: trim(form.get("email") || ""),
                  phone: trim(form.get("phone") || ""),
                  service: chosenService,
                  date: trim(form.get("date") || ""),
                  message: trim(form.get("message") || ""),
                  bookingType,
                  selectedService: selectedService || "",
                  addOns: isPizzaBooking ? [] : addOns,
                  company: trim(form.get("company") || ""), // honeypot travels to server
                  subject: `${subjectTag} ${chosenService} — Booking Request`,
                };

                try {
                  const res = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);

                  try {
                    localStorage.setItem("mkm_last_submit_ts", String(Date.now()));
                  } catch {}

                  setSent(true);
                  formEl.reset();
                  setSelectedService("");
                  setAddOns([]);
                  setMessagePreviewLen(0);
                  setErrors({});
                  setErrorMsg("");
                } catch (err) {
                  setErrorMsg(err?.message || "Something went wrong sending your request.");
                } finally {
                  setSubmitting(false);
                }
              }}
              noValidate
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              {/* Honeypot (hidden from users; bots often fill it) */}
              <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input id="company" name="company" type="text" tabIndex={-1} autoComplete="organization" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm text-white/80">Your Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className={`mt-1 w-full rounded-lg bg-black/40 border px-3 py-2 outline-none focus:ring-2 focus:ring-red-600 ${
                      errors.name ? "border-red-500" : "border-white/10"
                    }`}
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>
                <div>
                  <label className="text-sm text-white/80">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className={`mt-1 w-full rounded-lg bg-black/40 border px-3 py-2 outline-none focus:ring-2 focus:ring-red-600 ${
                      errors.email ? "border-red-500" : "border-white/10"
                    }`}
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm text-white/80">Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>

                {/* Service (controlled & synced with cart) */}
                <div>
                  <label className="text-sm text-white/80">Service</label>
                  <select
                    name="service"
                    value={
                      selectedService || (bookingType === "External" ? "External – Compact PA" : "Pizza Records – Basic")
                    }
                    onChange={(e) => {
                      const next = e.target.value;
                      setSelectedService(next);
                      const nextType = next.startsWith("External") ? "External" : "Pizza Records";
                      setBookingType(nextType);
                      if (nextType === "Pizza Records") setAddOns([]);
                    }}
                    className={`mt-1 w-full rounded-lg bg-black/40 border px-3 py-2 outline-none focus:ring-2 focus:ring-red-600 ${
                      errors.service ? "border-red-500" : "border-white/10"
                    }`}
                  >
                    {pizzaPackages.map((p) => (
                      <option key={p.title}>{p.title}</option>
                    ))}
                    {externalPackages.map((p) => (
                      <option key={p.title}>{p.title}</option>
                    ))}
                  </select>
                  {errors.service && <p className="mt-1 text-xs text-red-500">{errors.service}</p>}
                </div>

                <div>
                  <label className="text-sm text-white/80">Target Date</label>
                  <input
                    name="date"
                    type="date"
                    className={`mt-1 w-full rounded-lg bg-black/40 border px-3 py-2 outline-none focus:ring-2 focus:ring-red-600 ${
                      errors.date ? "border-red-500" : "border-white/10"
                    }`}
                  />
                  {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm text-white/80">Message</label>
                  <textarea
                    name="message"
                    rows={5}
                    placeholder="Event date, location, set length, genre, audience size, special needs..."
                    className={`mt-1 w-full rounded-lg bg-black/40 border px-3 py-2 outline-none focus:ring-2 focus:ring-red-600 ${
                      errors.message ? "border-red-500" : "border-white/10"
                    }`}
                    required
                    onInput={(e) => setMessagePreviewLen(trim(e.currentTarget.value).length)}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
                    <span>{messagePreviewLen} / 20</span>
                    {errors.message && <span className="text-red-500">{errors.message}</span>}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className={`inline-flex items-center rounded-full px-6 py-3 font-semibold transition ${
                    submitting || !canSubmit ? "bg-red-800 cursor-not-allowed" : "bg-red-600 hover:bg-red-500"
                  }`}
                >
                  {submitting ? "Sending…" : canSubmit ? "Send Booking Request" : "Please wait…"}
                </button>
                <p className="text-sm text-white/60">
                  Direct email:{" "}
                  <a className="hover:text-red-400" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                </p>
              </div>

              {sent && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                  Thanks! Your request was sent. I’ll follow up at the email you provided.
                </div>
              )}
              {!!errorMsg && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
                  {errorMsg}
                </div>
              )}
              {"honeypot" in errors && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
                  Submission blocked by spam filter.
                </div>
              )}
            </form>

            {/* Venue info */}
            <div className="rounded-2xl border border-white/10 p-6 bg-gradient-to-br from-white/5 to-white/[0.02]">
              <h3 className="text-xl font-semibold">Find Pizza Records</h3>
              <div className="mt-4 grid gap-3 text-sm">
                <InfoRow label="Venue" value="Pizza Records (Jacksonville, IL)" />
                <InfoRow
                  label="Phone"
                  value={<a className="hover:text-red-400" href={`tel:${PIZZA_RECORDS_PHONE_TEL}`}>{PIZZA_RECORDS_PHONE_DISPLAY}</a>}
                />
                <InfoRow
                  label="Email"
                  value={<a className="hover:text-red-400" href={`mailto:${PIZZA_RECORDS_EMAIL}`}>{PIZZA_RECORDS_EMAIL}</a>}
                />
                <InfoRow label="Address" value={VENUE_ADDRESS} />
              </div>

              <div className="mt-8 aspect-video w-full rounded-xl border border-white/10 overflow-hidden">
                <iframe
                  title="Pizza Records Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3067.765392391368!2d-90.23048392336818!3d39.732049071558336!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x87e9e2f2d7b99f93%3A0x7a1f9e55fdc2dd3!2s59%20E%20Central%20Park%20Plaza%2C%20Jacksonville%2C%20IL%2062650!5e0!3m2!1sen!2sus!4v1699999999999!5m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/60">© {new Date().getFullYear()} MKM Entertainment LLC. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#book" className="hover:text-red-400">Book</a>
            <a href="#gallery" className="hover:text-red-400">Gallery</a>
            <a href="#shows" className="hover:text-red-400">Shows</a>
            <a href="#contact" className="hover:text-red-400">Contact</a>
          </div>
          <div className="text-white/60">
            MKM Line:{" "}
            <a className="hover:text-red-400" href={`tel:${BUSINESS_PHONE_TEL}`}>
              {BUSINESS_PHONE_DISPLAY}
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
          <a
            href="https://www.facebook.com/mkmentertainmentllc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full bg-red-600 px-5 py-2 text-sm font-semibold hover:bg-red-400 transition"
          >
            Follow MKM Entertainment on Facebook
          </a>
          <a
            href="https://www.facebook.com/share/1D2UXPisWA/?mibextid=wwXlfr"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full bg-red-600 px-5 py-2 text-sm font-semibold hover:bg-red-400 transition"
          >
            Follow Pizza Records on Facebook
          </a>
        </div>

      </footer>
    </div>
  );
}
