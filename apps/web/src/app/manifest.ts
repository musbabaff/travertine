import type { MetadataRoute } from "next";

/** Web app manifest. Colours are the brand off-white and navy sampled from docs/brand/original. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travertine — crop-rotation decisions from Earth observation data",
    short_name: "Travertine",
    description: "Mark a field, set your priorities and explore crop rotations scored with open satellite and climate records.",
    id: "/",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
