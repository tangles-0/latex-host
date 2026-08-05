export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
}

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() &&
      process.env.TURNSTILE_SECRET_KEY?.trim(),
  );
}

export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    // Local/dev without Turnstile keys: skip verification.
    if (!getTurnstileSiteKey()) {
      return { ok: true };
    }
    return { ok: false, error: "Captcha is not configured." };
  }

  const token = input.token.trim();
  if (!token) {
    return { ok: false, error: "Captcha token is required." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (input.remoteIp) {
    body.set("remoteip", input.remoteIp);
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      },
    );
    const payload = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!payload.success) {
      return { ok: false, error: "Captcha verification failed." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to verify captcha." };
  }
}
