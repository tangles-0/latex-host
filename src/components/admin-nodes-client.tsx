"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { TermButton } from "@/components/ui/term-button";
import { TermTable } from "@/components/ui/term-table";
import type { AdminSelfHostedNodeSummary } from "@/lib/self-hosted-nodes";

type AdminNodesClientProps = {
  initialNodes: AdminSelfHostedNodeSummary[];
};

const formatTimestamp = (value: string | null): string =>
  value
    ? `${new Date(value).toISOString().replace("T", " ").slice(0, 19)} UTC`
    : "never";

const statusLabel = (node: AdminSelfHostedNodeSummary): string => {
  if (node.isAdminDisabled) {
    return "admin disabled";
  }
  if (node.isOwnerDisabled) {
    return "owner disabled";
  }
  if (node.status === "ok") {
    return "OK";
  }
  return node.status === "not_linked" ? "not linked" : "not reachable";
};

const AdminNodesClient = ({ initialNodes }: AdminNodesClientProps) => {
  const [nodes, setNodes] = useState(initialNodes);
  const [busyNodeId, setBusyNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateDisabled = async (
    node: AdminSelfHostedNodeSummary,
    isDisabled: boolean,
  ) => {
    setError(null);
    setBusyNodeId(node.id);
    try {
      const response = await fetch(
        `/api/admin/nodes/${encodeURIComponent(node.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDisabled }),
        },
      );
      const payload = (await response.json()) as {
        node?: AdminSelfHostedNodeSummary;
        error?: string;
      };
      if (!response.ok || !payload.node) {
        throw new Error(payload.error ?? "Unable to update the node.");
      }
      const updatedNode = payload.node;
      setNodes((current) =>
        current.map((item) => (item.id === node.id ? updatedNode : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update the node.",
      );
    } finally {
      setBusyNodeId(null);
    }
  };

  const deleteNode = async (node: AdminSelfHostedNodeSummary) => {
    const name = node.nodeHash ? `Node ${node.nodeHash}` : "This pending node";
    if (
      !window.confirm(
        `${name} will be permanently deleted and its latex.gg share URLs will stop working. Continue?`,
      )
    ) {
      return;
    }

    setError(null);
    setBusyNodeId(node.id);
    try {
      const response = await fetch(
        `/api/admin/nodes/${encodeURIComponent(node.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete the node.");
      }
      setNodes((current) => current.filter((item) => item.id !== node.id));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete the node.",
      );
    } finally {
      setBusyNodeId(null);
    }
  };

  if (nodes.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-300 p-4 text-xs text-neutral-500">
        No self-hosted nodes have been created.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <TermTable className="min-w-[1100px] text-xs">
          <thead className="text-left text-[11px] uppercase text-neutral-500">
            <tr>
              <th className="px-3 py-2" scope="col">
                Owner
              </th>
              <th className="px-3 py-2" scope="col">
                Node
              </th>
              <th className="px-3 py-2" scope="col">
                Public URL
              </th>
              <th className="px-3 py-2" scope="col">
                Status
              </th>
              <th className="px-3 py-2" scope="col">
                Forwarding
              </th>
              <th className="px-3 py-2" scope="col">
                Last ping
              </th>
              <th className="px-3 py-2" scope="col">
                Created
              </th>
              <th className="px-3 py-2" scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.id} className="border-t border-neutral-200">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/users/${node.userId}/gallery`}
                    className="font-medium underline"
                  >
                    {node.ownerUsername}
                  </Link>
                  <div className="text-neutral-500">{node.ownerEmail}</div>
                </td>
                <td className="px-3 py-2 font-mono">
                  {node.nodeHash ?? "pending"}
                </td>
                <td className="max-w-72 break-all px-3 py-2">
                  {node.publicHttpsUrl ? (
                    <a
                      href={node.publicHttpsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {node.publicHttpsUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={
                      node.status === "ok" &&
                      !node.isAdminDisabled &&
                      !node.isOwnerDisabled
                        ? "ok"
                        : "err"
                    }
                  >
                    {statusLabel(node)}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2">
                  {node.isForwardingEnabled ? "enabled" : "disabled"}
                </td>
                <td className="px-3 py-2">
                  {formatTimestamp(node.lastPingAt)}
                </td>
                <td className="px-3 py-2">{formatTimestamp(node.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <TermButton
                      onClick={() =>
                        void updateDisabled(node, !node.isAdminDisabled)
                      }
                      disabled={busyNodeId === node.id}
                    >
                      {node.isAdminDisabled ? "Enable" : "Disable"}
                    </TermButton>
                    <TermButton
                      variant="danger"
                      onClick={() => void deleteNode(node)}
                      disabled={busyNodeId === node.id}
                    >
                      Delete
                    </TermButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
      </TermTable>
    </div>
  );
};

export default AdminNodesClient;
