"use client";

import { useEffect, useState } from "react";

type NodeSetupState = {
  isLinked: boolean;
  nodeHash: string | null;
  publicHttpsUrl: string | null;
  cloudBaseUrl: string;
  isLatexReachable: boolean;
};

type NodeHomeProps = {
  isSignedIn: boolean;
  updateInfo: {
    currentVersion: string | null;
    latestVersion: string | null;
    updateAvailable: boolean;
  };
};

const NodeHome = ({ isSignedIn, updateInfo }: NodeHomeProps) => {
  const [state, setState] = useState<NodeSetupState | null>(null);
  const [publicHttpsUrl, setPublicHttpsUrl] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStatus = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/node/setup", { cache: "no-store" });
      const payload = (await response.json()) as NodeSetupState & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load node status.");
      }
      setState(payload);
      setPublicHttpsUrl(payload.publicHttpsUrl ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load node status.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const linkNode = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/node/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicHttpsUrl, linkCode }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to link this node.");
      }
      await loadStatus();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to link this node.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorizeUrl =
    state?.isLinked && state.nodeHash
      ? `${state.cloudBaseUrl}/account/nodes/${encodeURIComponent(state.nodeHash)}/authorize`
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-6 py-12 text-sm">
      <header>
        <h1 className="text-2xl font-semibold">latex.gg self-hosted node</h1>
        <p className="mt-2 text-neutral-600">
          Files, thumbnails, galleries, shares, and metadata remain on this
          server.
        </p>
      </header>
      {isLoading ? (
        <section className="rounded border border-neutral-200 p-4">
          Checking node status…
        </section>
      ) : null}
      {state ? (
        <section className="space-y-3 rounded border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span>latex.gg connectivity</span>
            <strong
              className={
                state.isLatexReachable ? "text-emerald-600" : "text-red-600"
              }
            >
              {state.isLatexReachable
                ? "latex.gg reachable"
                : "latex.gg not reachable"}
            </strong>
          </div>
          {!state.isLatexReachable ? (
            <button
              type="button"
              onClick={loadStatus}
              className="text-xs text-emerald-700 underline"
            >
              Retry
            </button>
          ) : null}
        </section>
      ) : null}
      {state && !state.isLinked ? (
        <section className="space-y-4 rounded border border-neutral-200 p-4">
          <div>
            <h2 className="font-medium">Link this node</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Log in to latex.gg, open Account, choose “Add self-hosted node”,
              then enter the one-time code here.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium">Public HTTPS URL</span>
            <input
              type="url"
              required
              placeholder="https://files.example.com"
              value={publicHttpsUrl}
              onChange={(event) => setPublicHttpsUrl(event.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">Node link code</span>
            <input
              type="text"
              required
              autoComplete="off"
              placeholder="ABCD-EFGH-IJKL"
              value={linkCode}
              onChange={(event) => setLinkCode(event.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 font-mono uppercase"
            />
          </label>
          <button
            type="button"
            disabled={isSubmitting || !state.isLatexReachable}
            onClick={linkNode}
            className="rounded border border-emerald-500 px-4 py-2 text-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? "Linking…" : "Link node"}
          </button>
        </section>
      ) : null}
      {state?.isLinked ? (
        <section className="space-y-3 rounded border border-emerald-300 bg-emerald-50 p-4">
          <div>
            <h2 className="font-medium text-emerald-950">
              Node {state.nodeHash} is linked
            </h2>
            <p className="mt-1 break-all text-xs text-emerald-800">
              {state.publicHttpsUrl}
            </p>
          </div>
          {isSignedIn ? (
            <a
              href="/gallery"
              className="inline-flex rounded border border-emerald-600 px-4 py-2 text-emerald-800"
            >
              Open gallery
            </a>
          ) : authorizeUrl ? (
            <a
              href={authorizeUrl}
              className="inline-flex rounded border border-emerald-600 px-4 py-2 text-emerald-800"
            >
              Log in with latex.gg
            </a>
          ) : null}
        </section>
      ) : null}
      {updateInfo.updateAvailable ? (
        <section className="space-y-2 rounded border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h2 className="font-medium">
            Node update {updateInfo.latestVersion} is available
          </h2>
          <p className="text-xs">
            This node is running {updateInfo.currentVersion}. From the Compose
            directory, run:
          </p>
          <code className="block overflow-x-auto rounded bg-amber-100 p-2 text-xs">
            docker compose pull &amp;&amp; docker compose up -d
          </code>
        </section>
      ) : null}
      {error ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-neutral-500">
        Public share downloads expose this server’s hostname and IP address to
        viewers.
      </p>
    </main>
  );
};

export default NodeHome;
