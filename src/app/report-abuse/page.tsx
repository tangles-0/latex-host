import Link from "next/link";
import { ReportAbuseForm } from "@/components/report-abuse-form";
import { getTurnstileSiteKey } from "@/lib/turnstile";

export const metadata = {
  title: "Report abuse — latex",
  description: "Report abusive or malicious shared files on latex.gg.",
};

export default function ReportAbusePage() {
  const turnstileSiteKey = getTurnstileSiteKey();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10 text-sm">
      <header className="space-y-2">
        <p className="text-xs text-neutral-500">
          <Link
            href="/"
            className="underline"
          >
            ← home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">Report abuse</h1>
        <p className="text-neutral-600">
          Flag public share links that host malware, illegal content, or other
          abuse. No account required. Limited to two submissions per hour.
        </p>
      </header>

      <section className="rounded-md border border-neutral-200 bg-white p-4 sm:p-6">
        <ReportAbuseForm turnstileSiteKey={turnstileSiteKey} />
      </section>
    </main>
  );
}
