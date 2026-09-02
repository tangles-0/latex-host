"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NodeLoginCallbackProps = {
  code: string;
  nodeHash: string;
};

const NodeLoginCallback = ({ code, nodeHash }: NodeLoginCallbackProps) => {
  const hasStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    void signIn("node-login", {
      code,
      nodeHash,
      callbackUrl: "/gallery",
      redirect: false,
    }).then((result) => {
      if (!result?.ok || result.error) {
        setError("The latex.gg authorization code was invalid or expired.");
        return;
      }
      window.location.assign("/gallery");
    });
  }, [code, nodeHash]);

  return (
    <section className="rounded-md border border-neutral-200 p-5 text-sm">
      <h1 className="text-xl font-semibold">Signing in to this node…</h1>
      <p className="mt-2 text-neutral-600">
        Verifying the one-time authorization with latex.gg.
      </p>
      {error ? (
        <div className="mt-4 space-y-3">
          <p className="text-red-600">{error}</p>
          <Link href="/" className="text-emerald-700 underline">
            Return to node login
          </Link>
        </div>
      ) : null}
    </section>
  );
};

export default NodeLoginCallback;
