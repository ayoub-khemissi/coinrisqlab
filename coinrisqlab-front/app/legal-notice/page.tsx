import { Metadata } from "next";

import { title } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Legal Notice",
  description:
    "Legal notice for CoinRisqLab - Publisher information, hosting, and legal disclaimers.",
  robots: { index: true, follow: true },
};

export default function LegalNoticePage() {
  return (
    <section className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className={title()}>Legal Notice</h1>
      </div>

      <div className="flex flex-col gap-8 text-default-600">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            1. Publisher
          </h2>
          <p>
            The website <strong>coinrisqlab.com</strong> is published by:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Name / Company:</strong> [COMPANY NAME]
            </li>
            <li>
              <strong>Legal form:</strong> [LEGAL FORM]
            </li>
            <li>
              <strong>Registered address:</strong> [ADDRESS]
            </li>
            <li>
              <strong>Registration number:</strong> [REGISTRATION NUMBER]
            </li>
            <li>
              <strong>Publication director:</strong> [PUBLICATION DIRECTOR]
            </li>
            <li>
              <strong>Email:</strong> [CONTACT EMAIL]
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            2. Hosting provider
          </h2>
          <p>The website is hosted by:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>OVH SAS</strong>
            </li>
            <li>2 rue Kellermann, 59100 Roubaix, France</li>
            <li>Phone: +33 9 72 10 10 07</li>
            <li>
              Website:{" "}
              <a
                className="text-primary hover:underline"
                href="https://www.ovhcloud.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                www.ovhcloud.com
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            3. Intellectual property
          </h2>
          <p>
            All content on the CoinRisqLab website (text, graphics, images,
            logos, icons, software, databases) is protected by French and
            international intellectual property laws.
          </p>
          <p className="mt-2">
            Any reproduction, representation, modification, publication, or
            adaptation of all or part of the website&apos;s content, by any means
            or process, is prohibited without prior written authorization from
            the publisher.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            4. Disclaimer
          </h2>
          <p>
            The information provided on CoinRisqLab is for informational
            purposes only. It does not constitute investment advice, a
            recommendation to buy or sell digital assets, or an incentive to
            carry out financial transactions.
          </p>
          <p className="mt-2">
            The publisher shall not be held liable for investment decisions made
            based on information published on this website. Cryptocurrency
            markets are volatile and carry significant risks of capital loss.
          </p>
          <p className="mt-2">
            The publisher strives to ensure the accuracy of the information
            provided but does not guarantee its completeness, precision, or
            timeliness.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            5. Market data
          </h2>
          <p>
            Market data displayed on CoinRisqLab is sourced from third parties,
            including{" "}
            <a
              className="text-primary hover:underline"
              href="https://www.coingecko.com/"
              rel="noopener noreferrer"
              target="_blank"
            >
              CoinGecko
            </a>
            . The publisher does not guarantee the accuracy, completeness, or
            availability of this data.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            6. External links
          </h2>
          <p>
            The website may contain links to external websites. The publisher
            exercises no control over these websites and disclaims all
            responsibility for their content or data protection practices.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            7. Governing law
          </h2>
          <p>
            This legal notice is governed by French law. In case of dispute,
            French courts shall have sole jurisdiction.
          </p>
        </div>

        <p className="text-sm text-default-400 mt-4">
          Last updated: March 2026
        </p>
      </div>
    </section>
  );
}
