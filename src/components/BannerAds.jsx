// src/components/BannerAds.jsx
import ads from "/src/ads.json";

export default function BannerAds() {
  const bannerAds = Array.isArray(ads) ? ads : [];
  if (!bannerAds.length) return null;

  return (
    <section
      id="sponsors"
      className="bg-neutral-950/80 border-y border-neutral-800 py-14"
    >
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Featured Sponsors
        </h2>
        <p className="text-sm text-neutral-400 mt-1 mb-10">
          Local businesses helping power MKM shows. Interested in a banner
          slot? Ask about sponsor pricing and availability.
        </p>

        {/* Full-width banners, centered, stacked */}
        <div className="flex flex-col gap-10 items-center">
          {bannerAds.map((ad) => (
            <a
              key={ad.id}
              href={ad.url}
              target="_blank"
              rel="noreferrer"
              className="
                block
                w-full
                max-w-4xl
                rounded-2xl
                overflow-hidden
                border border-neutral-700/80
                shadow-md
                transition-all duration-200
                hover:border-red-500
                hover:shadow-red-500/60 hover:shadow-2xl
              "
            >
              <img
                src={ad.image}
                alt={ad.label}
                className="w-full h-auto object-contain"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
