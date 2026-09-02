"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

type SignOutActionsProps = {
  callbackUrl: string;
};

export default function SignOutActions({ callbackUrl }: SignOutActionsProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl, redirect: false });
      window.location.assign(callbackUrl);
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isSigningOut}
    >
      {isSigningOut ? "signing out... (lame)" : "sign out"}
    </button>
  );
}
