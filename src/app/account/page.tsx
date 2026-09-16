import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listApiKeysForUser } from "@/lib/api-keys";
import {
  listApiDevices,
  formatUserCode,
  normalizeUserCode,
} from "@/lib/device-auth";
import { getUserById } from "@/lib/metadata-store";
import { getUserPgpKey } from "@/lib/messaging-store";
import AccountClient from "@/components/account-client";
import SelfHostedNodesClient from "@/components/self-hosted-nodes-client";
import { PageScaffold } from "@/components/ui/page-scaffold";
import { SectionHeader } from "@/components/ui/section-header";
import { SkeletonTable } from "@/components/ui/skeleton";
import { isNodeMode, listSelfHostedNodes } from "@/lib/self-hosted-nodes";

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ device_code?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }
  const nodeMode = isNodeMode();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawDeviceCode = resolvedSearchParams?.device_code?.trim() ?? "";
  const initialDeviceCode = nodeMode
    ? ""
    : normalizeUserCode(rawDeviceCode).length === 8
      ? formatUserCode(rawDeviceCode)
      : rawDeviceCode;

  const [user, key, devices, apiKeys, selfHostedNodes] = await Promise.all([
    getUserById(userId),
    nodeMode ? Promise.resolve(null) : getUserPgpKey(userId),
    nodeMode ? Promise.resolve([]) : listApiDevices(userId),
    listApiKeysForUser(userId),
    nodeMode ? Promise.resolve([]) : listSelfHostedNodes(userId),
  ]);
  if (!user) {
    redirect("/");
  }

  return (
    <PageScaffold>
      <SectionHeader
        title="account"
        subtitle={
          nodeMode
            ? "Profile and API access for this self-hosted node."
            : "Profile, API keys, devices, PGP key, and account controls."
        }
      />
      <Suspense fallback={<SkeletonTable rows={5} columns={2} />}>
      <AccountClient
        username={user.username}
        email={user.email}
        initialDeviceCode={initialDeviceCode}
        initialDevices={devices.map((device) => ({
          id: device.id,
          name: device.name,
          scopes: device.scopes,
          createdAt: device.createdAt.toISOString(),
          lastUsedAt: device.lastUsedAt?.toISOString() ?? null,
          expiresAt: device.expiresAt.toISOString(),
          isRevoked: device.isRevoked,
        }))}
        initialApiKeys={apiKeys
          .filter((apiKey) => !apiKey.isRevoked)
          .map((apiKey) => ({
            id: apiKey.id,
            description: apiKey.description,
            displayHint: apiKey.displayHint,
            allowedDomains: apiKey.allowedDomains,
            createdAt: apiKey.createdAt,
            lastUsedAt: apiKey.lastUsedAt,
            isRevoked: apiKey.isRevoked,
          }))}
        initialKey={
          key
            ? {
                ...key,
                verifyExpiresAt: key.verifyExpiresAt?.toISOString() ?? null,
                updatedAt: key.updatedAt.toISOString(),
              }
            : null
        }
        nodeMode={nodeMode}
        nodesPanel={
          nodeMode ? null : <SelfHostedNodesClient initialNodes={selfHostedNodes} />
        }
      />
      </Suspense>
    </PageScaffold>
  );
}
