import { Metadata } from "next";

import { title } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Privacy Policy - GDPR",
  description:
    "Privacy policy and personal data protection (GDPR) for CoinRisqLab.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <section className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className={title({ size: "sm" })}>Privacy Policy</h1>
        <p className="text-lg text-default-600 mt-4">
          Personal data protection (GDPR)
        </p>
      </div>

      <div className="flex flex-col gap-8 text-default-600">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            1. Data controller
          </h2>
          <p>The data controller for personal data is:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Name / Company:</strong> [COMPANY NAME]
            </li>
            <li>
              <strong>Address:</strong> [ADDRESS]
            </li>
            <li>
              <strong>Email:</strong> [CONTACT EMAIL]
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            2. Data collected
          </h2>
          <p>
            CoinRisqLab collects minimal personal data. The website does not
            require account creation to access its main features.
          </p>
          <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
            Automatically collected data
          </h3>
          <p>
            During your browsing, only strictly necessary cookies are used. No
            advertising trackers or third-party analytics tools are deployed.
          </p>
          <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">
            Technical cookies
          </h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Theme preference:</strong> saves your choice of theme
              (light/dark)
            </li>
            <li>
              <strong>Cookie consent:</strong> remembers your cookie preference
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            3. Purpose of data processing
          </h2>
          <p>The collected data is used exclusively to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ensure the proper technical functioning of the website</li>
            <li>Remember your display preferences</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            4. Legal basis
          </h2>
          <p>
            Data processing is based on the legitimate interest of the publisher
            (Article 6(1)(f) of the GDPR) for cookies strictly necessary for the
            website&apos;s operation.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            5. Data retention
          </h2>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Technical cookies:</strong> maximum 13 months in accordance
              with CNIL recommendations
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            6. Data transfers
          </h2>
          <p>
            No personal data is transferred to third parties. Data is hosted in
            France by OVH SAS (2 rue Kellermann, 59100 Roubaix).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            7. Your rights
          </h2>
          <p>
            In accordance with the General Data Protection Regulation (GDPR),
            you have the following rights:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Right of access:</strong> obtain confirmation of whether
              your data is being processed
            </li>
            <li>
              <strong>Right to rectification:</strong> request correction of
              inaccurate data
            </li>
            <li>
              <strong>Right to erasure:</strong> request deletion of your data
            </li>
            <li>
              <strong>Right to restriction:</strong> request limitation of data
              processing
            </li>
            <li>
              <strong>Right to object:</strong> object to the processing of your
              data
            </li>
            <li>
              <strong>Right to portability:</strong> receive your data in a
              structured format
            </li>
          </ul>
          <p className="mt-3">
            To exercise your rights, contact us at:{" "}
            <strong>[CONTACT EMAIL]</strong>
          </p>
          <p className="mt-2">
            You also have the right to lodge a complaint with the CNIL (French
            Data Protection Authority):{" "}
            <a
              className="text-primary hover:underline"
              href="https://www.cnil.fr"
              rel="noopener noreferrer"
              target="_blank"
            >
              www.cnil.fr
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            8. Data security
          </h2>
          <p>
            The publisher implements appropriate technical and organizational
            measures to protect personal data against unauthorized access,
            alteration, disclosure, or destruction. The website uses HTTPS
            protocol to secure data exchanges.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-3">
            9. Policy changes
          </h2>
          <p>
            The publisher reserves the right to modify this privacy policy at
            any time. Changes will take effect upon publication on this page.
          </p>
        </div>

        <p className="text-sm text-default-400 mt-4">
          Last updated: March 2026
        </p>
      </div>
    </section>
  );
}
