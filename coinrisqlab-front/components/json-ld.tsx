import { siteConfig } from "@/config/site";

export default function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteConfig.siteUrl}/#website`,
        url: siteConfig.siteUrl,
        name: siteConfig.name,
        description: siteConfig.description,
        publisher: {
          "@id": `${siteConfig.siteUrl}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteConfig.siteUrl}/?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteConfig.siteUrl}/#organization`,
        name: siteConfig.name,
        url: siteConfig.siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteConfig.siteUrl}/favicon.ico`,
        },
        sameAs: [siteConfig.links.github, siteConfig.links.twitter].filter(
          Boolean,
        ),
      },
      {
        "@type": "WebPage",
        "@id": `${siteConfig.siteUrl}/#webpage`,
        url: siteConfig.siteUrl,
        name: "CoinRisqLab | Real-time Crypto Analytics & Risk Metrics",
        isPartOf: {
          "@id": `${siteConfig.siteUrl}/#website`,
        },
        about: {
          "@id": `${siteConfig.siteUrl}/#organization`,
        },
        description: siteConfig.description,
      },
    ],
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      type="application/ld+json"
    />
  );
}
