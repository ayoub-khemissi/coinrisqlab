import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoinRisqLab - Real-time Crypto Analytics",
    short_name: "CoinRisqLab",
    description:
      "Free real-time crypto analytics platform with market-cap weighted index, volatility analysis, and risk metrics.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#006FEE",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
