"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import Panel from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import TextLink from "@/components/ui/text-link";

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
    <Panel className="space-y-3 text-sm">
      <h1 className="text-xl font-semibold">Signing in to this node…</h1>
      <p className="text-neutral-600">
        Verifying the one-time authorization with latex.gg.
      </p>
      {error ? (
        <div className="space-y-3">
          <p className="text-red-600">{error}</p>
          <TextLink href="/" variant="loud">
            Return to node login
          </TextLink>
        </div>
      ) : (
        <StatusBadge tone="pend" />
      )}
    </Panel>
  );
};

export default NodeLoginCallback;
