"use client";

import { useState } from "react";

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
    <section className="space-y-4 rounded-md border border-neutral-200 p-5">
      <div>
        <h1 className="text-xl font-semibold">Log in to self-hosted node</h1>
        <p className="mt-2 text-sm text-neutral-600">
          latex.gg will authorize your account for this registered node. Your
          password is never sent to the node.
        </p>
      </div>
      <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
        <div>Node: {nodeHash}</div>
        <div className="break-all">Destination: {publicHttpsUrl}</div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={isAuthorizing}
        onClick={authorize}
        className="rounded border border-emerald-500 px-4 py-2 text-sm text-emerald-700 disabled:opacity-50"
      >
        {isAuthorizing ? "Authorizing…" : "Continue to node"}
      </button>
    </section>
  );
};

export default NodeAuthorizeClient;
