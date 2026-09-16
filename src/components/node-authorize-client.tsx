"use client";

import { useState } from "react";

import Panel from "@/components/ui/panel";
import { TermButton } from "@/components/ui/term-button";

type NodeAuthorizeClientProps = {
  nodeHash: string;
  publicHttpsUrl: string;
};

const NodeAuthorizeClient = ({
  nodeHash,
  publicHttpsUrl,
}: NodeAuthorizeClientProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const authorize = async () => {
    setError(null);
    setIsAuthorizing(true);
    try {
      const response = await fetch(
        `/api/account/nodes/${encodeURIComponent(nodeHash)}/authorize`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.redirectUrl) {
        throw new Error(payload.error ?? "Unable to authorize this node.");
      }
      window.location.assign(payload.redirectUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to authorize this node.",
      );
      setIsAuthorizing(false);
    }
  };

  return (
    <Panel className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Log in to self-hosted node</h1>
        <p className="mt-2 text-sm text-neutral-600">
          latex.gg will authorize your account for this registered node. Your
          password is never sent to the node.
        </p>
      </div>
      <div className="border border-neutral-200 bg-[var(--theme-card)] p-3 text-xs">
        <div>Node: {nodeHash}</div>
        <div className="break-all">Destination: {publicHttpsUrl}</div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <TermButton
        variant="primary"
        disabled={isAuthorizing}
        onClick={authorize}
      >
        {isAuthorizing ? "Authorizing…" : "Continue to node"}
      </TermButton>
    </Panel>
  );
};

export default NodeAuthorizeClient;
