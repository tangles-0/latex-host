"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import NoteRichEditor from "@/components/note-rich-editor";
import Panel from "@/components/ui/panel";
import {
  encryptPlaintextToPublicKey,
  validatePublicKeyArmored,
} from "@/lib/pgp-client";
import { fingerprintsMatch } from "@/lib/pgp-fingerprint";

type ThreadSummary = {
  senderHash: string;
  lastMessageAt: string;
  unreadCount: number;
  messageCount: number;
  isMuted: boolean;
};

type MessageSummary = {
  id: string;
  senderHash: string;
  size: number;
  createdAt: string;
  readAt: string | null;
};

type MessageDetail = MessageSummary & {
  ciphertext: string;
};

type FingerprintVerificationStatus = "checking" | "verified" | "mismatch" | null;

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function MessagesClient({
  initialHasClaimedKey,
  initialThreads,
}: {
  initialHasClaimedKey: boolean;
  initialThreads: ThreadSummary[];
}) {
  const [hasClaimedKey, setHasClaimedKey] = useState(initialHasClaimedKey);
  const [threads, setThreads] = useState(initialThreads);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessageSummary[]>([]);
  const [isThreadMuted, setIsThreadMuted] = useState(false);
  const [activeMessage, setActiveMessage] = useState<MessageDetail | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [recipientPublicKey, setRecipientPublicKey] = useState("");
  const [resolvedRecipientFingerprint, setResolvedRecipientFingerprint] = useState<string | null>(
    null,
  );
  const [recipientFingerprintToVerify, setRecipientFingerprintToVerify] = useState("");
  const [fingerprintVerificationStatus, setFingerprintVerificationStatus] =
    useState<FingerprintVerificationStatus>(null);
  const [isRecipientKeyLocked, setIsRecipientKeyLocked] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [isLoadingReplyKey, setIsLoadingReplyKey] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMuted, setShowMuted] = useState(false);

  const visibleThreads = threads.filter((thread) => (showMuted ? thread.isMuted : !thread.isMuted));

  useEffect(() => {
    if (
      isRecipientKeyLocked ||
      !recipientFingerprintToVerify.trim() ||
      !recipientPublicKey.trim()
    ) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      void validatePublicKeyArmored(recipientPublicKey)
        .then(validated => {
          if (!isCancelled) {
            setFingerprintVerificationStatus(
              fingerprintsMatch(validated.fingerprint, recipientFingerprintToVerify)
                ? "verified"
                : "mismatch",
            );
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setFingerprintVerificationStatus("mismatch");
          }
        });
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isRecipientKeyLocked, recipientFingerprintToVerify, recipientPublicKey]);

  async function refreshThreads() {
    const response = await fetch("/api/messages");
    const payload = (await response.json()) as {
      hasClaimedKey?: boolean;
      threads?: ThreadSummary[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load messages.");
    }
    setHasClaimedKey(Boolean(payload.hasClaimedKey));
    setThreads(
      (payload.threads ?? []).map((thread) => ({
        ...thread,
        lastMessageAt:
          typeof thread.lastMessageAt === "string"
            ? thread.lastMessageAt
            : new Date(thread.lastMessageAt).toISOString(),
      })),
    );
  }

  function resetComposeState() {
    setIsComposeOpen(false);
    setIsReplying(false);
    setRecipientPublicKey("");
    setResolvedRecipientFingerprint(null);
    setRecipientFingerprintToVerify("");
    setFingerprintVerificationStatus(null);
    setIsRecipientKeyLocked(false);
    setBody("");
  }

  async function openThread(senderHash: string) {
    setError(null);
    setSelectedHash(senderHash);
    setActiveMessage(null);
    resetComposeState();
    setIsLoadingThread(true);
    try {
      const response = await fetch(`/api/messages/threads/${encodeURIComponent(senderHash)}`);
      const payload = (await response.json()) as {
        messages?: MessageSummary[];
        isMuted?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load thread.");
      }
      setThreadMessages(
        (payload.messages ?? []).map((message) => ({
          ...message,
          createdAt:
            typeof message.createdAt === "string"
              ? message.createdAt
              : new Date(message.createdAt).toISOString(),
          readAt: message.readAt
            ? typeof message.readAt === "string"
              ? message.readAt
              : new Date(message.readAt).toISOString()
            : null,
        })),
      );
      setIsThreadMuted(Boolean(payload.isMuted));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread.");
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function openMessage(messageId: string) {
    setError(null);
    setIsLoadingMessage(true);
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}`);
      const payload = (await response.json()) as { message?: MessageDetail; error?: string };
      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Failed to open message.");
      }
      const message = {
        ...payload.message,
        createdAt:
          typeof payload.message.createdAt === "string"
            ? payload.message.createdAt
            : new Date(payload.message.createdAt).toISOString(),
        readAt: payload.message.readAt
          ? typeof payload.message.readAt === "string"
            ? payload.message.readAt
            : new Date(payload.message.readAt).toISOString()
          : null,
      };
      const previous = threadMessages.find((item) => item.id === message.id);
      const becameRead = Boolean(previous && !previous.readAt && message.readAt);
      setActiveMessage(message);
      setThreadMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, readAt: message.readAt } : item,
        ),
      );
      if (becameRead) {
        setThreads((current) =>
          current.map((thread) =>
            thread.senderHash === message.senderHash
              ? { ...thread, unreadCount: Math.max(0, thread.unreadCount - 1) }
              : thread,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open message.");
    } finally {
      setIsLoadingMessage(false);
    }
  }

  async function toggleMute() {
    if (!selectedHash) {
      return;
    }
    setError(null);
    const nextMuted = !isThreadMuted;
    try {
      const response = await fetch("/api/messages/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderHash: selectedHash, muted: nextMuted }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update mute.");
      }
      setIsThreadMuted(nextMuted);
      setThreads((current) =>
        current.map((thread) =>
          thread.senderHash === selectedHash ? { ...thread, isMuted: nextMuted } : thread,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update mute.");
    }
  }

  async function startReply() {
    if (!selectedHash) {
      return;
    }
    setError(null);
    setInfo(null);
    setIsLoadingReplyKey(true);
    try {
      const response = await fetch(
        `/api/messages/threads/${encodeURIComponent(selectedHash)}/reply-key`,
      );
      const payload = (await response.json()) as {
        fingerprint?: string;
        publicKeyArmored?: string;
        error?: string;
      };
      if (!response.ok || !payload.publicKeyArmored || !payload.fingerprint) {
        throw new Error(
          payload.error ??
            "This sender has no public key registered, so you cannot encrypt a reply yet.",
        );
      }
      setRecipientPublicKey(payload.publicKeyArmored);
      setResolvedRecipientFingerprint(payload.fingerprint);
      setIsRecipientKeyLocked(true);
      setIsReplying(true);
      setIsComposeOpen(false);
      setActiveMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare reply.");
    } finally {
      setIsLoadingReplyKey(false);
    }
  }

  async function sendMessage() {
    setError(null);
    setInfo(null);
    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }

    setIsSending(true);
    try {
      const validated = await validatePublicKeyArmored(recipientPublicKey);
      setResolvedRecipientFingerprint(validated.fingerprint);
      if (
        recipientFingerprintToVerify.trim() &&
        !fingerprintsMatch(validated.fingerprint, recipientFingerprintToVerify)
      ) {
        setFingerprintVerificationStatus("mismatch");
        return;
      }
      if (recipientFingerprintToVerify.trim()) {
        setFingerprintVerificationStatus("verified");
      }

      // Ensure this key is registered on the app (pending or claimed) so delivery can route.
      const keyResponse = await fetch(
        `/api/pgp/keys/${encodeURIComponent(validated.fingerprint)}`,
      );
      const keyPayload = (await keyResponse.json()) as {
        publicKeyArmored?: string;
        fingerprint?: string;
        error?: string;
      };
      if (!keyResponse.ok) {
        throw new Error(
          keyPayload.error ??
            "That public key is not registered here yet. The recipient must save it on their Account page first.",
        );
      }

      const ciphertext = await encryptPlaintextToPublicKey(body, validated.publicKeyArmored);
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientFingerprint: validated.fingerprint,
          ciphertext,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send message.");
      }

      setInfo(isReplying ? "Reply sent." : "Encrypted message sent.");
      resetComposeState();
      await refreshThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  }

  const composeForm = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {isReplying ? "Reply in conversation" : "New encrypted message"}
        </h2>
        <button
          type="button"
          onClick={() => {
            resetComposeState();
          }}
          className="text-xs text-neutral-500 underline"
        >
          Cancel
        </button>
      </div>
      {fingerprintVerificationStatus === "mismatch" ? (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          The supplied fingerprint does not match this public key. Do not send until you have
          verified the correct key.{" "}
          <Link
            href="/messages/best-practices"
            className="font-medium underline"
          >
            Review PGP messaging best practices.
          </Link>
        </div>
      ) : null}
      {isRecipientKeyLocked ? (
        <div className="space-y-1 text-xs text-neutral-500">
          <p>Recipient key loaded from this conversation — no need to paste it again.</p>
          {resolvedRecipientFingerprint ? (
            <p>
              Fingerprint:{" "}
              <code className="break-all font-mono">{resolvedRecipientFingerprint}</code>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <label className="block text-xs text-neutral-500">
            Recipient public key
            <div className="relative mt-1">
              {fingerprintVerificationStatus === "verified" ? (
                <span
                  id="recipient-key-verification-status"
                  className="absolute -top-2 right-2 z-10 bg-white px-1 text-[10px] font-medium text-green-700"
                >
                  verified
                </span>
              ) : fingerprintVerificationStatus === "mismatch" ? (
                <span
                  id="recipient-key-verification-status"
                  className="absolute -top-2 right-2 z-10 bg-white px-1 text-[10px] font-medium text-red-700"
                >
                  fingerprint mismatch
                </span>
              ) : null}
              <textarea
                value={recipientPublicKey}
                onChange={event => {
                  const nextPublicKey = event.target.value;
                  setRecipientPublicKey(nextPublicKey);
                  setResolvedRecipientFingerprint(null);
                  setFingerprintVerificationStatus(
                    recipientFingerprintToVerify.trim() && nextPublicKey.trim()
                      ? "checking"
                      : null,
                  );
                }}
                spellCheck={false}
                aria-describedby={
                  fingerprintVerificationStatus === "verified" ||
                  fingerprintVerificationStatus === "mismatch"
                    ? "recipient-key-verification-status"
                    : undefined
                }
                className={clsx(
                  "min-h-[140px] w-full rounded border px-3 py-2 font-mono text-xs outline-none",
                  fingerprintVerificationStatus === "verified"
                    ? "border-green-600"
                    : fingerprintVerificationStatus === "mismatch"
                      ? "border-red-600"
                      : "border-neutral-200",
                )}
                placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
              />
            </div>
          </label>
          <label className="block text-xs text-neutral-500">
            Verify Public Key with Fingerprint
            <input
              type="text"
              value={recipientFingerprintToVerify}
              onChange={event => {
                const nextFingerprint = event.target.value;
                setRecipientFingerprintToVerify(nextFingerprint);
                setFingerprintVerificationStatus(
                  nextFingerprint.trim() && recipientPublicKey.trim() ? "checking" : null,
                );
              }}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="mt-1 w-full rounded border border-neutral-200 px-3 py-2 font-mono text-xs uppercase outline-none"
              placeholder="40-character PGP fingerprint"
            />
          </label>
          {resolvedRecipientFingerprint ? (
            <p className="text-xs text-neutral-500">
              Fingerprint:{" "}
              <code className="break-all font-mono">{resolvedRecipientFingerprint}</code>
            </p>
          ) : (
            <p className="text-xs text-neutral-500">
              Paste the armored public key they shared with you. We&apos;ll encrypt to it and route
              by its fingerprint.
            </p>
          )}
        </>
      )}
      <div>
        <div className="mb-1 text-xs text-neutral-500">Message (markdown)</div>
        <NoteRichEditor value={body} onChange={setBody} layoutMode="windowed" />
      </div>
      <p className="text-xs text-neutral-500">
        The body is encrypted in your browser to that public key before upload. Plaintext never
        reaches the server.
      </p>
      <button
        type="button"
        disabled={
          isSending ||
          !recipientPublicKey.trim() ||
          !body.trim() ||
          fingerprintVerificationStatus === "checking" ||
          fingerprintVerificationStatus === "mismatch"
        }
        onClick={() => {
          void sendMessage();
        }}
        className="rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {isSending ? "Encrypting & sending…" : isReplying ? "Encrypt & reply" : "Encrypt & send"}
      </button>
    </div>
  );

  if (!hasClaimedKey) {
    return (
      <Panel>
        <h2 className="text-base font-semibold">Inbox unavailable</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Claim a PGP key on your Account page before you can view messages. Until then, this page
          will not show whether any mail exists.
        </p>
        <Link
          href="/account"
          className="mt-4 inline-flex rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white"
        >
          Go to Account
        </Link>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {info ? <p className="text-sm text-neutral-600">{info}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetComposeState();
              setSelectedHash(null);
              setActiveMessage(null);
              setIsComposeOpen(true);
            }}
            className="rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white"
          >
            Compose
          </button>
          <button
            type="button"
            onClick={() => setShowMuted((value) => !value)}
            className="rounded border border-neutral-200 px-3 py-1.5 text-sm"
          >
            {showMuted ? "Show inbox" : "Show muted"}
          </button>
          <Link
            href="/messages/best-practices"
            className="rounded border border-neutral-200 px-3 py-1.5 text-sm"
          >
            Best Practice
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshThreads().catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Failed to refresh.");
            });
          }}
          className="rounded border border-neutral-200 px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Panel className="min-h-[24rem] overflow-hidden p-0">
          <div className="border-b border-neutral-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            {showMuted ? "Muted threads" : "Conversations"}
          </div>
          {visibleThreads.length === 0 ? (
            <div className="px-4 py-8 text-sm text-neutral-500">
              {showMuted ? "No muted threads." : "No messages yet."}
            </div>
          ) : (
            <ul>
              {visibleThreads.map((thread) => {
                const isActive = selectedHash === thread.senderHash;
                return (
                  <li
                    key={thread.senderHash}
                    className="border-b border-neutral-200 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void openThread(thread.senderHash);
                      }}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                        isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="break-all font-mono text-[11px] leading-snug">
                          Sender: {thread.senderHash}
                        </span>
                        {thread.unreadCount > 0 ? (
                          <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[10px] text-white">
                            {thread.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        {formatWhen(thread.lastMessageAt)} · {thread.messageCount} msg
                        {thread.messageCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="min-h-[24rem]">
          {isComposeOpen ? composeForm : null}

          {!isComposeOpen && !selectedHash ? (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center text-sm text-neutral-500">
              <p>Select a conversation, or compose a new encrypted message.</p>
            </div>
          ) : null}

          {!isComposeOpen && selectedHash ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Sender: {selectedHash}</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Pairwise hash for your inbox only — other recipients see a different label.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isLoadingReplyKey}
                    onClick={() => {
                      void startReply();
                    }}
                    className="rounded border border-neutral-200 bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  >
                    {isLoadingReplyKey ? "Loading key…" : "Reply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleMute();
                    }}
                    className="rounded border border-neutral-200 px-3 py-1.5 text-xs"
                  >
                    {isThreadMuted ? "Unmute" : "Mute"}
                  </button>
                </div>
              </div>

              {isReplying ? (
                <div className="rounded border border-neutral-200 p-4">{composeForm}</div>
              ) : null}

              {isLoadingThread ? (
                <p className="text-sm text-neutral-500">Loading thread…</p>
              ) : (
                <ul className="space-y-2">
                  {threadMessages.map((message) => {
                    const isUnread = !message.readAt;
                    const isOpen = activeMessage?.id === message.id;
                    return (
                      <li key={message.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void openMessage(message.id);
                          }}
                          className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                            isOpen
                              ? "border-neutral-300 bg-neutral-50"
                              : "border-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={isUnread ? "font-semibold" : ""}>
                              {formatWhen(message.createdAt)}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {isUnread ? "Unread" : "Read"} · {message.size} B
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {isLoadingMessage ? (
                <p className="text-sm text-neutral-500">Opening message…</p>
              ) : null}

              {activeMessage ? (
                <div className="space-y-2 border-t border-neutral-200 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <span>Encrypted contents (decrypt offline with your private key)</span>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        void navigator.clipboard.writeText(activeMessage.ciphertext);
                        setInfo("Ciphertext copied.");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="max-h-[28rem] overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed">
                    {activeMessage.ciphertext}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
