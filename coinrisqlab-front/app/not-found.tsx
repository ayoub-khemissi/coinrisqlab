import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <h1 className="text-6xl font-bold text-default-300">404</h1>
      <h2 className="text-2xl font-semibold">Page Not Found</h2>
      <p className="text-default-500 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link
          className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          href="/"
        >
          Back to Dashboard
        </Link>
        <Link
          className="px-6 py-2 border border-default-300 rounded-lg hover:bg-default-100 transition-colors"
          href="/methodology"
        >
          Methodology
        </Link>
      </div>
    </div>
  );
}
