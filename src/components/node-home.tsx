"use client";

import { useEffect, useState } from "react";

import AlertBanner from "@/components/ui/alert-banner";
import { PageScaffold } from "@/components/ui/page-scaffold";
import Panel from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { TermButton } from "@/components/ui/term-button";
import { TermInput } from "@/components/ui/term-input";

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
    <PageScaffold width="narrow">
      <SectionHeader
        title="latex.gg node"
        subtitle="Files, thumbnails, galleries, shares, and metadata remain on this server."
      />
      {isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {state ? (
        <Panel className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span>latex.gg connectivity</span>
            <StatusBadge tone={state.isLatexReachable ? "ok" : "err"}>
              {state.isLatexReachable
                ? "latex.gg reachable"
                : "latex.gg not reachable"}
            </StatusBadge>
          </div>
          {!state.isLatexReachable ? (
            <TermButton onClick={loadStatus}>Retry</TermButton>
          ) : null}
        </Panel>
      ) : null}
      {state && !state.isLinked ? (
        <Panel className="space-y-4">
          <div>
            <h2 className="font-medium">Link this node</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Log in to latex.gg, open Account, choose “Add self-hosted node”,
              then enter the one-time code here.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium">Public HTTPS URL</span>
            <TermInput
              type="url"
              required
              placeholder="https://files.example.com"
              value={publicHttpsUrl}
              onChange={(event) => setPublicHttpsUrl(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">Node link code</span>
            <TermInput
              type="text"
              required
              autoComplete="off"
              placeholder="ABCD-EFGH-IJKL"
              value={linkCode}
              onChange={(event) => setLinkCode(event.target.value)}
              className="font-mono uppercase"
            />
          </label>
          <TermButton
            variant="primary"
            disabled={isSubmitting || !state.isLatexReachable}
            onClick={linkNode}
          >
            {isSubmitting ? "Linking…" : "Link node"}
          </TermButton>
        </Panel>
      ) : null}
      {state?.isLinked ? (
        <Panel className="space-y-3">
          <h2 className="font-medium">Node {state.nodeHash} is linked</h2>
          <p className="break-all text-xs text-neutral-500">
            {state.publicHttpsUrl}
          </p>
          {isSignedIn ? (
            <TermButton variant="primary" href="/gallery">
              Open gallery
            </TermButton>
          ) : authorizeUrl ? (
            <a href={authorizeUrl} className="term-btn primary">
              Log in with latex.gg
            </a>
          ) : null}
        </Panel>
      ) : null}
      {updateInfo.updateAvailable ? (
        <AlertBanner tone="warning">
          <div className="space-y-2">
            <div className="font-medium">
              Node update {updateInfo.latestVersion} is available
            </div>
            <p>
              This node is running {updateInfo.currentVersion}. From the Compose
              directory, run:
            </p>
            <code className="block overflow-x-auto bg-[var(--theme-card)] p-2 text-xs">
              docker compose pull &amp;&amp; docker compose up -d
            </code>
          </div>
        </AlertBanner>
      ) : null}
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <p className="text-xs text-neutral-500">
        Public share downloads expose this server’s hostname and IP address to
        viewers.
      </p>
    </PageScaffold>
  );
};

export default NodeHome;
