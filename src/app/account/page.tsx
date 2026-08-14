import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listApiKeysForUser } from "@/lib/api-keys";
import { listApiDevices, formatUserCode, normalizeUserCode } from "@/lib/device-auth";
import { getUserById } from "@/lib/metadata-store";
import { getUserPgpKey } from "@/lib/messaging-store";
import AccountClient from "@/components/account-client";
import PageHeader from "@/components/ui/page-header";

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

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawDeviceCode = resolvedSearchParams?.device_code?.trim() ?? "";
  const initialDeviceCode =
    normalizeUserCode(rawDeviceCode).length === 8
      ? formatUserCode(rawDeviceCode)
      : rawDeviceCode;

  const [user, key, devices, apiKeys] = await Promise.all([
    getUserById(userId),
    getUserPgpKey(userId),
    listApiDevices(userId),
    listApiKeysForUser(userId),
  ]);
  if (!user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10 text-sm">
      <PageHeader
        title="Account"
        subtitle="Profile, API keys, devices, PGP key, and account controls."
        backLink={{ href: "/gallery", label: "back 2 gallery" }}
      />
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
      />
    </main>
  );
}
