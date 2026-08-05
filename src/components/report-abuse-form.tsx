"use client";

import { useState, type FormEvent } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

type ReportAbuseFormProps = {
  turnstileSiteKey: string;
};

export const ReportAbuseForm = ({ turnstileSiteKey }: ReportAbuseFormProps) => {
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addUrlField = () => {
    if (urls.length >= 20) {
      return;
    }
    setUrls((current) => [...current, ""]);
  };

  const updateUrl = (index: number, value: string) => {
    setUrls((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? value : entry,
      ),
    );
  };

  const removeUrl = (index: number) => {
    setUrls((current) =>
      current.length === 1
        ? [""]
        : current.filter((_, entryIndex) => entryIndex !== index),
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const cleanedUrls = urls.map((url) => url.trim()).filter(Boolean);
    if (!description.trim()) {
      setError("Please add a short description.");
      return;
    }
    if (description.trim().length > 120) {
      setError("Description must be 120 characters or fewer.");
      return;
    }
    if (cleanedUrls.length === 0) {
      setError("Provide at least one URL.");
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setError("Complete the captcha before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/abuse-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          urls: cleanedUrls,
          email: email.trim(),
          turnstileToken,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit report.");
      }
      setSuccess(true);
      setDescription("");
      setUrls([""]);
      setEmail("");
      setTurnstileToken("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <label
          htmlFor="abuse-description"
          className="block text-sm font-medium text-neutral-900"
        >
          Description
          <span className="ml-2 text-xs font-normal text-neutral-500">
            {description.length}/120
          </span>
        </label>
        <textarea
          id="abuse-description"
          value={description}
          maxLength={120}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is wrong with these shares?"
          className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-neutral-900">
            Reported URLs
          </label>
          <button
            type="button"
            onClick={addUrlField}
            className="rounded border border-neutral-200 px-2 py-1 text-xs"
          >
            + add URL
          </button>
        </div>
        <div className="space-y-2">
          {urls.map((url, index) => (
            <div
              key={`url-${index}`}
              className="flex gap-2"
            >
              <input
                type="url"
                value={url}
                onChange={(event) => updateUrl(index, event.target.value)}
                placeholder="https://latex.gg/share/..."
                className="min-w-0 flex-1 rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
                required={index === 0}
              />
              <button
                type="button"
                onClick={() => removeUrl(index)}
                className="rounded border border-neutral-200 px-2 text-xs text-neutral-500"
                aria-label="Remove URL"
              >
                −
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="abuse-email"
          className="block text-sm font-medium text-neutral-900"
        >
          Email for outcome{" "}
          <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <input
          id="abuse-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
        />
        <p className="text-xs text-neutral-500">
          If provided, you will get a confirmation email and can be notified when
          the report is resolved. Reported URLs are obfuscated in that email so
          your client will not open them.
        </p>
      </div>

      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />
      ) : (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Captcha is not configured in this environment. Bot protection still
          applies via BotID in production.
        </p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Report received. Thank you.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {isSubmitting ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
};
