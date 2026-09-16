"use client";

import { useState } from "react";

import AlertBanner from "@/components/ui/alert-banner";
import { EmptyState } from "@/components/ui/empty-state";
import Panel from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { TermButton } from "@/components/ui/term-button";
import type { SelfHostedNodeSummary } from "@/lib/self-hosted-nodes";

type SelfHostedNodesClientProps = {
  initialNodes: SelfHostedNodeSummary[];
};

const statusLabel = (status: SelfHostedNodeSummary["status"]): string =>
  status === "ok"
    ? "OK"
    : status === "not_linked"
      ? "not linked"
      : "not reachable";

const SelfHostedNodesClient = ({
  initialNodes,
}: SelfHostedNodesClientProps) => {
  const [nodes, setNodes] = useState(initialNodes);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/account/nodes", { cache: "no-store" });
    const payload = (await response.json()) as {
      nodes?: SelfHostedNodeSummary[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load nodes.");
    }
    setNodes(payload.nodes ?? []);
  };

  const addNode = async () => {
    setError(null);
    setLinkCode(null);
    setIsBusy(true);
    try {
      const response = await fetch("/api/account/nodes", { method: "POST" });
      const payload = (await response.json()) as {
        linkCode?: string;
        error?: string;
      };
      if (!response.ok || !payload.linkCode) {
        throw new Error(payload.error ?? "Unable to create a node link code.");
      }
      setLinkCode(payload.linkCode);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create a node.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const updateDisabled = async (nodeId: string, isDisabled: boolean) => {
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/account/nodes/${encodeURIComponent(nodeId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDisabled }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update the node.");
      }
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update the node.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const removeNode = async (nodeId: string) => {
    if (
      !window.confirm(
        "Remove this self-hosted node? Its latex.gg share URLs will stop working.",
      )
    ) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/account/nodes/${encodeURIComponent(nodeId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to remove the node.");
      }
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to remove the node.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Self-hosted nodes</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Link servers that keep files, thumbnails, galleries, and their
            database on your hardware.
          </p>
        </div>
        <TermButton
          variant="primary"
          disabled={isBusy}
          onClick={addNode}
        >
          Add self-hosted node
        </TermButton>
      </div>
      {linkCode ? (
        <AlertBanner tone="info">
          <div className="text-xs">
            Enter this one-time code in the node setup page:
          </div>
          <code className="mt-1 block select-all text-lg font-semibold tracking-wider">
            {linkCode}
          </code>
          <div className="mt-1 text-xs">
            This code is shown only once and expires in 15 minutes.
          </div>
        </AlertBanner>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {nodes.length === 0 ? (
        <EmptyState>No self-hosted nodes yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <article
              key={node.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-[var(--theme-card)] p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {node.nodeHash ? `Node ${node.nodeHash}` : "Pending node"}
                  </span>
                  <StatusBadge
                    tone={
                      node.status === "ok"
                        ? "ok"
                        : node.status === "not_linked"
                          ? "pend"
                          : "err"
                    }
                  >
                    {statusLabel(node.status)}
                  </StatusBadge>
                </div>
                <div className="mt-1 break-all text-xs text-neutral-500">
                  {node.publicHttpsUrl ??
                    "Waiting for the node to use its link code"}
                </div>
                <div className="mt-1 text-[11px] text-neutral-400">
                  Last ping:{" "}
                  {node.lastPingAt
                    ? new Date(node.lastPingAt).toLocaleString()
                    : "never"}
                  {" · "}
                  Forwarding:{" "}
                  {node.isForwardingEnabled ? "enabled" : "disabled"}
                </div>
              </div>
              <div className="flex gap-2">
                {node.nodeHash ? (
                  <TermButton
                    disabled={isBusy}
                    onClick={() =>
                      updateDisabled(node.id, !node.isOwnerDisabled)
                    }
                  >
                    {node.isOwnerDisabled ? "Enable" : "Disable"}
                  </TermButton>
                ) : null}
                <TermButton
                  variant="danger"
                  disabled={isBusy}
                  onClick={() => removeNode(node.id)}
                >
                  Remove
                </TermButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
};

export default SelfHostedNodesClient;
