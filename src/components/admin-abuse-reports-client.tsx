"use client";

import { useCallback, useEffect, useState } from "react";
import type { AbuseReportRow } from "@/lib/abuse-reports";
import { EmptyState } from "@/components/ui/empty-state";
import Panel from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { TermButton } from "@/components/ui/term-button";

export const AdminAbuseReportsClient = () => {
  const [reports, setReports] = useState<AbuseReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notifyByReport, setNotifyByReport] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/admin/abuse-reports", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      reports?: AbuseReportRow[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Unable to load abuse reports.");
      return;
    }
    setReports(payload.reports ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchReport = async (
    reportId: string,
    body: Record<string, unknown>,
  ) => {
    setBusyId(reportId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/abuse-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed.");
      }
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {reports.length === 0 ? (
        <EmptyState title="Inbox zero">
          No pending abuse reports right now.
        </EmptyState>
      ) : (
        <div className="grid gap-5">
          {reports.map((report) => {
            const owners = [
              ...new Map(
                report.resolvedUrls
                  .filter((item) => item.ownerUserId)
                  .map((item) => [
                    item.ownerUserId!,
                    {
                      userId: item.ownerUserId!,
                      username: item.ownerUsername,
                      email: item.ownerEmail,
                    },
                  ]),
              ).values(),
            ];
            const deletable = report.resolvedUrls.filter(
              (item) =>
                item.valid &&
                item.mediaId &&
                item.ownerUserId &&
                item.kind &&
                item.kind !== "album",
            );
            const notify = Boolean(
              notifyByReport[report.id] && report.reporterEmail,
            );

            return (
              <Panel
                key={report.id}
                className="overflow-hidden p-0"
              >
                <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">
                      Report · {new Date(report.createdAt).toLocaleString()}
                    </p>
                    <p className="text-base font-medium leading-snug">
                      {report.description}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Reporter:{" "}
                      {report.reporterEmail ? (
                        <span>{report.reporterEmail}</span>
                      ) : (
                        <span>anonymous</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge tone="pend">pending</StatusBadge>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      URLs
                    </h3>
                    <ul className="space-y-2">
                      {report.resolvedUrls.map((item) => (
                        <li
                          key={`${report.id}-${item.url}`}
                          className="border border-neutral-200 bg-[var(--theme-card)] px-3 py-2 text-xs"
                        >
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all font-medium text-emerald-700 underline"
                          >
                            {item.url}
                          </a>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-neutral-500">
                            <span>
                              {item.valid
                                ? `${item.kind ?? "unknown"} · ${item.fileName ?? item.shareCode}`
                                : "unresolved share"}
                            </span>
                            {item.ownerUsername ? (
                              <span>
                                owner: {item.ownerUsername}
                                {item.ownerEmail ? ` (${item.ownerEmail})` : ""}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {owners.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Owners
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {owners.map((owner) => (
                          <TermButton
                            key={owner.userId}
                            variant="danger"
                            disabled={busyId === report.id}
                            onClick={() =>
                              void patchReport(report.id, {
                                action: "ban_user",
                                userId: owner.userId,
                              })
                            }
                          >
                            Ban {owner.username}
                          </TermButton>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-neutral-500">
                      <input
                        type="checkbox"
                        checked={notify}
                        disabled={!report.reporterEmail}
                        onChange={(event) =>
                          setNotifyByReport((current) => ({
                            ...current,
                            [report.id]: event.target.checked,
                          }))
                        }
                      />
                      Email reporter on resolve
                      {!report.reporterEmail ? " (no email)" : ""}
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {deletable.length > 0 ? (
                        <TermButton
                          disabled={busyId === report.id}
                          onClick={() =>
                            void patchReport(report.id, {
                              action: "delete_files",
                              mediaItems: deletable.map((item) => ({
                                userId: item.ownerUserId,
                                mediaId: item.mediaId,
                                kind: item.kind,
                              })),
                            })
                          }
                        >
                          Delete file(s)
                        </TermButton>
                      ) : null}
                      <TermButton
                        disabled={busyId === report.id}
                        onClick={() =>
                          void patchReport(report.id, {
                            action: "reject",
                            notifyReporter: notify,
                          })
                        }
                      >
                        Reject
                      </TermButton>
                      <TermButton
                        variant="primary"
                        disabled={busyId === report.id}
                        onClick={() =>
                          void patchReport(report.id, {
                            action: "action_taken",
                            notifyReporter: notify,
                          })
                        }
                      >
                        Mark action taken
                      </TermButton>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};
