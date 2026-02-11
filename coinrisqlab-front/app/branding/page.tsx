import PresentationCard from "@/components/PresentationCard";
import { title } from "@/components/primitives";

export default function BrandingPage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className={title()}>Branding Assets</h1>
        <p className="text-lg text-default-600 mt-4">
          CoinRisqLab presentation cards and branding materials
        </p>
      </div>

      <div className="flex flex-col gap-12 items-center">
        <div className="flex flex-col gap-4 items-center">
          <h2 className="text-2xl font-semibold text-default-700">
            Preview Card (1024x500)
          </h2>
          <PresentationCard height={500} width={1024} />
        </div>

        <div className="flex flex-col gap-4 items-center">
          <h2 className="text-2xl font-semibold text-default-700">
            Open Graph Card (1200x630)
          </h2>
          <PresentationCard height={630} width={1200} />
        </div>
      </div>
    </section>
  );
}
