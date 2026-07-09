import type { MetadataRoute } from "next";

/* Official WonderNest web-app manifest — home-screen name + app icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WonderNest",
    short_name: "WonderNest",
    description: "Turn every day into an adventure",
    start_url: "/",
    display: "standalone",
    background_color: "#060a18",
    theme_color: "#060a18",
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
