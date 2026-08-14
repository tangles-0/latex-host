"use client";

import { useState } from "react";
import Panel from "@/components/ui/panel";
import { validatePublicKeyArmored } from "@/lib/pgp-client";
import { isValidVerifyCodeFormat } from "@/lib/pgp-verify-code";

type PgpKeyState = {
  id: string;
  fingerprint: string;
  publicKeyArmored: string;
  status: "pending" | "claimed";
  verifyChallengeCiphertext: string | null;
  verifyExpiresAt: string | Date | null;
  hasUserIdsWarning: boolean;
  updatedAt: string | Date;
} | null;

type DeviceRow = {
  id: string;
  name: string;
  scopes: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isRevoked: boolean;
};

type ApiKeyRow = {
  id: string;
  description: string;
  displayHint: string;
  allowedDomains: string[];
  createdAt: string;
  lastUsedAt: string | null;
  isRevoked: boolean;
};

function formatWhen(value: string | null): string {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AccountClient({
  username,
  email,
  initialKey,
  initialDevices,
  initialApiKeys = [],
  initialDeviceCode = "",
}: {
  username: string;
  email: string;
  initialKey: PgpKeyState;
  initialDevices: DeviceRow[];
  initialApiKeys?: ApiKeyRow[];
  initialDeviceCode?: string;
}) {
  const [key, setKey] = useState<PgpKeyState>(initialKey);
  const [devices, setDevices] = useState(initialDevices);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>(initialApiKeys);
  const [publicKeyArmored, setPublicKeyArmored] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [deviceCode, setDeviceCode] = useState(initialDeviceCode);
  const [apiKeyDescription, setApiKeyDescription] = useState("");
  const [apiKeyDomains, setApiKeyDomains] = useState("");
  const [createdApiKeyToken, setCreatedApiKeyToken] = useState<string | null>(null);
  const [didCopyApiKey, setDidCopyApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState(false);
  const [isApprovingDevice, setIsApprovingDevice] = useState(false);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [revokingApiKeyId, setRevokingApiKeyId] = useState<string | null>(null);
  const [didCopyPublicKey, setDidCopyPublicKey] = useState(false);

  async function refreshDevices() {
    const response = await fetch("/api/account/devices");
    const payload = (await response.json()) as { devices?: DeviceRow[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load devices.");
    }
    setDevices(payload.devices ?? []);
  }

  async function refreshApiKeys() {
    const response = await fetch("/api/account/api-keys");
    const payload = (await response.json()) as { keys?: ApiKeyRow[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load API keys.");
    }
    setApiKeys(payload.keys ?? []);
  }

  async function createApiKey() {
    setError(null);
    setInfo(null);
    setCreatedApiKeyToken(null);
    setIsCreatingApiKey(true);
    try {
      const response = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: apiKeyDescription,
          allowedDomains: apiKeyDomains,
        }),
      });
      const payload = (await response.json()) as {
        key?: ApiKeyRow;
        token?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create API key.");
      }
      if (!payload.token || !payload.key) {
        throw new Error("API key was created but the token was not returned.");
      }
      setCreatedApiKeyToken(payload.token);
      setApiKeyDescription("");
      setApiKeyDomains("");
      setInfo("API key created. Copy it now — it will not be shown again.");
      await refreshApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key.");
    } finally {
      setIsCreatingApiKey(false);
    }
  }

  async function revokeApiKey(keyId: string) {
    const confirmed = window.confirm(
      "Revoke this API key? Clients using it will lose access immediately.",
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    setInfo(null);
    setRevokingApiKeyId(keyId);
    try {
      const response = await fetch(`/api/account/api-keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to revoke API key.");
      }
      if (createdApiKeyToken) {
        setCreatedApiKeyToken(null);
      }
      setInfo("API key revoked.");
      await refreshApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key.");
    } finally {
      setRevokingApiKeyId(null);
    }
  }

  async function saveKey() {
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      const validated = await validatePublicKeyArmored(publicKeyArmored);
      const response = await fetch("/api/account/pgp-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKeyArmored: validated.publicKeyArmored }),
      });
      const payload = (await response.json()) as { key?: PgpKeyState; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save key.");
      }
      setKey(payload.key ?? null);
      setPublicKeyArmored("");
      setInfo("Key saved as unclaimed. Decrypt the challenge below and enter the code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key.");
    } finally {
      setIsSaving(false);
    }
  }

  async function verifyKey() {
    setError(null);
    setInfo(null);
    if (!isValidVerifyCodeFormat(verifyCode)) {
      setError("Verification code must be a hex string from the decrypted challenge.");
      return;
    }
    setIsVerifying(true);
    try {
      const response = await fetch("/api/account/pgp-key/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const payload = (await response.json()) as { key?: PgpKeyState; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Verification failed.");
      }
      setKey(payload.key ?? null);
      setVerifyCode("");
      setInfo("PGP key claimed. You can now receive messages.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function deleteKey() {
    const warnings =
      key?.status === "claimed"
        ? [
            "Delete your claimed PGP key?",
            "",
            "This will permanently delete all messages sent to this fingerprint,",
            "and all sender hashes used in your inbox.",
            "Further messages will not be visible until someone re-adds and re-verifies a key.",
            "You will need to complete verification again if you re-add the key.",
          ]
        : [
            "Remove this unclaimed PGP key from your profile?",
            "",
            "Messages addressed to this fingerprint are not purged (you never claimed it).",
            "You can save and verify a key again later.",
          ];
    const confirmed = window.confirm(warnings.join("\n"));
    if (!confirmed) {
      return;
    }

    setError(null);
    setInfo(null);
    setIsDeletingKey(true);
    try {
      const response = await fetch("/api/account/pgp-key", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete key.");
      }
      setKey(null);
      setVerifyCode("");
      setInfo("PGP key and related messages removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key.");
    } finally {
      setIsDeletingKey(false);
    }
  }

  async function approveDevice() {
    setError(null);
    setInfo(null);
    setIsApprovingDevice(true);
    try {
      const response = await fetch("/api/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: deviceCode.trim() }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        deviceName?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to approve device.");
      }
      setDeviceCode("");
      setInfo(
        `Approved device${payload.deviceName ? ` “${payload.deviceName}”` : ""}. The TUI can finish login now.`,
      );
      await refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve device.");
    } finally {
      setIsApprovingDevice(false);
    }
  }

  async function revokeDevice(deviceId: string) {
    const confirmed = window.confirm(
      "Revoke this device? It will lose API access on the next request/refresh.",
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    setInfo(null);
    setRevokingDeviceId(deviceId);
    try {
      const response = await fetch(`/api/account/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to revoke device.");
      }
      setInfo("Device revoked.");
      await refreshDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke device.");
    } finally {
      setRevokingDeviceId(null);
    }
  }

  const activeDevices = devices.filter((device) => !device.isRevoked);
  const activeApiKeys = apiKeys.filter((apiKey) => !apiKey.isRevoked);

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {info ? <p className="text-sm text-neutral-600">{info}</p> : null}

      <Panel>
        <h2 className="text-base font-semibold">Profile</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-neutral-500">Username</dt>
            <dd>{username}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-neutral-500">Email</dt>
            <dd>{email}</dd>
          </div>
        </dl>
      </Panel>

      <Panel>
        <h2 className="text-base font-semibold">API keys</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Create long-lived keys for the public{" "}
          <code className="font-mono">/api/v1</code> API. Provide a description. Optionally
          restrict the key to specific domains (immutable after creation). The full key is shown
          once.
        </p>
        <label className="mt-4 block text-xs text-neutral-500">
          Description
          <input
            value={apiKeyDescription}
            onChange={(event) => setApiKeyDescription(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-3 py-2 text-sm outline-none"
            placeholder="CI upload script"
            maxLength={200}
          />
        </label>
        <label className="mt-3 block text-xs text-neutral-500">
          Domain whitelist (optional)
          <textarea
            value={apiKeyDomains}
            onChange={(event) => setApiKeyDomains(event.target.value)}
            className="mt-1 min-h-[72px] w-full rounded border border-neutral-200 px-3 py-2 font-mono text-xs outline-none"
            placeholder={"example.com\n*.example.com"}
            spellCheck={false}
          />
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          Hosts only, comma or newline separated. Leave empty to allow any origin (and curl).
          Domains cannot be edited later.
        </p>
        <button
          type="button"
          disabled={isCreatingApiKey || !apiKeyDescription.trim()}
          onClick={() => {
            void createApiKey();
          }}
          className="mt-3 rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isCreatingApiKey ? "Creating…" : "Create API key"}
        </button>

        {createdApiKeyToken ? (
          <div className="mt-4 space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Copy this key now. It will not be shown again after you leave or refresh this page.
            </p>
            <code className="block break-all font-mono text-xs text-amber-950">
              {createdApiKeyToken}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(createdApiKeyToken).then(() => {
                  setDidCopyApiKey(true);
                  setInfo("API key copied to clipboard.");
                  window.setTimeout(() => setDidCopyApiKey(false), 2000);
                });
              }}
              className="rounded border border-amber-300 bg-white px-3 py-1.5 text-xs text-amber-900"
            >
              {didCopyApiKey ? "Copied" : "Copy key"}
            </button>
          </div>
        ) : null}

        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Active keys</h3>
            <button
              type="button"
              className="text-xs text-neutral-500 underline"
              onClick={() => {
                void refreshApiKeys().catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Failed to refresh API keys.");
                });
              }}
            >
              Refresh
            </button>
          </div>
          {activeApiKeys.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No active API keys.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activeApiKeys.map((apiKey) => (
                <li
                  key={apiKey.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded border border-neutral-200 px-3 py-2 text-sm"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{apiKey.description}</div>
                    <code className="block font-mono text-xs text-neutral-600">
                      {apiKey.displayHint}
                    </code>
                    <div className="text-xs text-neutral-500">
                      Created {formatWhen(apiKey.createdAt)} · Last used{" "}
                      {formatWhen(apiKey.lastUsedAt)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Domains:{" "}
                      {apiKey.allowedDomains.length > 0
                        ? apiKey.allowedDomains.join(", ")
                        : "any"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={revokingApiKeyId === apiKey.id}
                    onClick={() => {
                      void revokeApiKey(apiKey.id);
                    }}
                    className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                  >
                    {revokingApiKeyId === apiKey.id ? "Revoking…" : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-base font-semibold">TUI / device login</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Approve a code shown by the Go TUI (or other API client). Tokens never include your
          private key.
        </p>
        <label className="mt-4 block text-xs text-neutral-500">
          Device code
          <input
            value={deviceCode}
            onChange={(event) => setDeviceCode(event.target.value.toUpperCase())}
            className="mt-1 w-full rounded border border-neutral-200 px-3 py-2 font-mono text-sm outline-none"
            placeholder="ABCD-EFGH"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
          />
        </label>
        <button
          type="button"
          disabled={isApprovingDevice || !deviceCode.trim()}
          onClick={() => {
            void approveDevice();
          }}
          className="mt-3 rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isApprovingDevice ? "Approving…" : "Approve device"}
        </button>

        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Authorized devices</h3>
            <button
              type="button"
              className="text-xs text-neutral-500 underline"
              onClick={() => {
                void refreshDevices().catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Failed to refresh devices.");
                });
              }}
            >
              Refresh
            </button>
          </div>
          {activeDevices.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No active devices.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activeDevices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded border border-neutral-200 px-3 py-2 text-sm"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-neutral-500">
                      Created {formatWhen(device.createdAt)} · Last used{" "}
                      {formatWhen(device.lastUsedAt)}
                    </div>
                    <div className="text-xs text-neutral-500">Scopes: {device.scopes}</div>
                  </div>
                  <button
                    type="button"
                    disabled={revokingDeviceId === device.id}
                    onClick={() => {
                      void revokeDevice(device.id);
                    }}
                    className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                  >
                    {revokingDeviceId === device.id ? "Revoking…" : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">PGP key</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Public keys only. Private keys never leave your machine.
            </p>
          </div>
          {key ? (
            <span
              className={`rounded px-2 py-1 text-xs ${
                key.status === "claimed"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {key.status === "claimed" ? "Claimed" : "Unclaimed"}
            </span>
          ) : null}
        </div>

        {key ? (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-xs text-neutral-500">Fingerprint</div>
              <code className="mt-1 block break-all font-mono text-xs">{key.fingerprint}</code>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(key.publicKeyArmored).then(() => {
                    setDidCopyPublicKey(true);
                    setInfo("Public key copied to clipboard.");
                    window.setTimeout(() => setDidCopyPublicKey(false), 2000);
                  });
                }}
                className="rounded border border-neutral-200 bg-black px-3 py-1.5 text-xs text-white"
              >
                {didCopyPublicKey ? "Copied" : "Copy public key"}
              </button>
              <span className="text-xs text-neutral-500">
                Share this with people who want to message you.
              </span>
            </div>
            {key.hasUserIdsWarning ? (
              <p className="text-xs text-amber-700">
                Your public key may include User ID packets (name/email) visible to anyone who
                encrypts to this fingerprint.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No PGP key on file.</p>
        )}

        {key?.status !== "claimed" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-neutral-500">
              Paste armored public key
              <textarea
                value={publicKeyArmored}
                onChange={(event) => setPublicKeyArmored(event.target.value)}
                spellCheck={false}
                className="mt-1 min-h-[160px] w-full rounded border border-neutral-200 px-3 py-2 font-mono text-xs outline-none"
                placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
              />
            </label>
            <button
              type="button"
              disabled={isSaving || !publicKeyArmored.trim()}
              onClick={() => {
                void saveKey();
              }}
              className="rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {isSaving ? "Validating & saving…" : key ? "Update key & new challenge" : "Save key"}
            </button>
          </div>
        ) : null}

        {key?.status === "pending" && key.verifyChallengeCiphertext ? (
          <div className="mt-6 space-y-3 border-t border-neutral-200 pt-4">
            <p className="text-sm">
              Decrypt this challenge with your private key, then paste the code:
            </p>
            <pre className="max-h-56 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed">
              {key.verifyChallengeCiphertext}
            </pre>
            <p className="text-xs text-neutral-500">
              Example: <code className="font-mono">gpg -d</code> (paste the block, then Ctrl-D)
            </p>
            <label className="block text-xs text-neutral-500">
              Decrypted verification code
              <input
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value)}
                className="mt-1 w-full rounded border border-neutral-200 px-3 py-2 font-mono text-sm outline-none"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
                inputMode="text"
                pattern="[0-9a-fA-F]+"
              />
            </label>
            <button
              type="button"
              disabled={isVerifying || !verifyCode.trim()}
              onClick={() => {
                void verifyKey();
              }}
              className="rounded border border-neutral-200 bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {isVerifying ? "Verifying…" : "Verify ownership"}
            </button>
          </div>
        ) : null}
      </Panel>

      <Panel className="border-red-200 bg-red-50">
        <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-xs text-red-700">
          Destructive actions. Deleting a claimed PGP key removes all messages and sender hashes
          for that fingerprint.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!key || isDeletingKey}
            onClick={() => {
              void deleteKey();
            }}
            className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
          >
            {isDeletingKey ? "Deleting…" : "Delete PGP key"}
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 opacity-60"
          >
            Delete account (coming soon)
          </button>
        </div>
      </Panel>
    </div>
  );
}
