import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  messageMutes,
  messages,
  senderHashes,
  userPgpKeys,
} from "@/db/schema";
import {
  assertEncryptedOpenPgpMessage,
  createSenderDisplayHash,
  createVerifyCode,
  encryptTextToPublicKey,
  getVerifyExpiryDate,
  isValidFingerprint,
  isValidVerifyCodeFormat,
  mapPgpError,
  normalizeFingerprint,
  parsePublicKey,
  verifyCodesMatch,
} from "@/lib/pgp";

export type PgpKeyStatus = "pending" | "claimed";

export type UserPgpKeySummary = {
  id: string;
  fingerprint: string;
  status: PgpKeyStatus;
  verifyChallengeCiphertext: string | null;
  verifyExpiresAt: Date | null;
  hasUserIdsWarning: boolean;
  updatedAt: Date;
};

export type MessageThreadSummary = {
  senderHash: string;
  lastMessageAt: Date;
  unreadCount: number;
  messageCount: number;
  isMuted: boolean;
};

export type MessageSummary = {
  id: string;
  senderHash: string;
  size: number;
  createdAt: Date;
  readAt: Date | null;
};

export type MessageDetail = MessageSummary & {
  ciphertext: string;
};

function asPgpStatus(value: string): PgpKeyStatus {
  return value === "claimed" ? "claimed" : "pending";
}

export async function getUserPgpKey(userId: string): Promise<UserPgpKeySummary | null> {
  const [row] = await db
    .select()
    .from(userPgpKeys)
    .where(eq(userPgpKeys.userId, userId))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    status: asPgpStatus(row.status),
    verifyChallengeCiphertext: row.verifyChallengeCiphertext,
    verifyExpiresAt: row.verifyExpiresAt,
    hasUserIdsWarning: true,
    updatedAt: row.updatedAt,
  };
}

export async function getClaimedPgpKeyForUser(userId: string): Promise<{
  fingerprint: string;
  publicKeyArmored: string;
} | null> {
  const [row] = await db
    .select({
      fingerprint: userPgpKeys.fingerprint,
      publicKeyArmored: userPgpKeys.publicKeyArmored,
      status: userPgpKeys.status,
    })
    .from(userPgpKeys)
    .where(and(eq(userPgpKeys.userId, userId), eq(userPgpKeys.status, "claimed")))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    fingerprint: row.fingerprint,
    publicKeyArmored: row.publicKeyArmored,
  };
}

export async function getPublicKeyForFingerprint(fingerprintInput: string): Promise<{
  fingerprint: string;
  publicKeyArmored: string;
  isClaimed: boolean;
} | null> {
  const fingerprint = normalizeFingerprint(fingerprintInput);
  if (!isValidFingerprint(fingerprint)) {
    return null;
  }

  const [claimed] = await db
    .select({
      fingerprint: userPgpKeys.fingerprint,
      publicKeyArmored: userPgpKeys.publicKeyArmored,
    })
    .from(userPgpKeys)
    .where(and(eq(userPgpKeys.fingerprint, fingerprint), eq(userPgpKeys.status, "claimed")))
    .limit(1);
  if (claimed) {
    return {
      fingerprint: claimed.fingerprint,
      publicKeyArmored: claimed.publicKeyArmored,
      isClaimed: true,
    };
  }

  const [pending] = await db
    .select({
      fingerprint: userPgpKeys.fingerprint,
      publicKeyArmored: userPgpKeys.publicKeyArmored,
    })
    .from(userPgpKeys)
    .where(and(eq(userPgpKeys.fingerprint, fingerprint), eq(userPgpKeys.status, "pending")))
    .limit(1);
  if (!pending) {
    return null;
  }
  return {
    fingerprint: pending.fingerprint,
    publicKeyArmored: pending.publicKeyArmored,
    isClaimed: false,
  };
}

export async function savePendingPgpKey(
  userId: string,
  publicKeyArmoredInput: string,
): Promise<UserPgpKeySummary> {
  let parsed: Awaited<ReturnType<typeof parsePublicKey>>;
  try {
    parsed = await parsePublicKey(publicKeyArmoredInput);
  } catch (error) {
    throw new Error(mapPgpError(error, "Could not parse this as a PGP public key."));
  }

  const { code, codeHash } = createVerifyCode();
  let challenge: string;
  try {
    challenge = await encryptTextToPublicKey(code, parsed.publicKeyArmored);
  } catch (error) {
    throw new Error(
      mapPgpError(error, "Could not encrypt with this key. It may lack a usable encryption subkey."),
    );
  }
  const now = new Date();
  const expiresAt = getVerifyExpiryDate();

  const [existing] = await db
    .select()
    .from(userPgpKeys)
    .where(eq(userPgpKeys.userId, userId))
    .limit(1);
  if (existing?.status === "claimed") {
    throw new Error("Delete your claimed key before saving a new one.");
  }

  const id = existing?.id ?? randomUUID();
  if (existing) {
    await db
      .update(userPgpKeys)
      .set({
        fingerprint: parsed.fingerprint,
        publicKeyArmored: parsed.publicKeyArmored,
        status: "pending",
        verifyCodeHash: codeHash,
        verifyChallengeCiphertext: challenge,
        verifyExpiresAt: expiresAt,
        updatedAt: now,
      })
      .where(eq(userPgpKeys.userId, userId));
  } else {
    await db.insert(userPgpKeys).values({
      id,
      userId,
      fingerprint: parsed.fingerprint,
      publicKeyArmored: parsed.publicKeyArmored,
      status: "pending",
      verifyCodeHash: codeHash,
      verifyChallengeCiphertext: challenge,
      verifyExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    id,
    fingerprint: parsed.fingerprint,
    status: "pending",
    verifyChallengeCiphertext: challenge,
    verifyExpiresAt: expiresAt,
    hasUserIdsWarning: parsed.hasUserIds,
    updatedAt: now,
  };
}

export async function verifyPgpKeyOwnership(
  userId: string,
  code: string,
): Promise<UserPgpKeySummary> {
  const [row] = await db
    .select()
    .from(userPgpKeys)
    .where(eq(userPgpKeys.userId, userId))
    .limit(1);

  if (!row || row.status !== "pending" || !row.verifyCodeHash) {
    throw new Error("No pending PGP key to verify.");
  }
  if (!isValidVerifyCodeFormat(code)) {
    throw new Error("Verification code must be a hex string from the decrypted challenge.");
  }
  if (row.verifyExpiresAt && row.verifyExpiresAt.getTime() < Date.now()) {
    throw new Error("Verification code expired. Save your key again to get a new code.");
  }
  if (!verifyCodesMatch(code, row.verifyCodeHash)) {
    throw new Error("Invalid verification code.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    const [alreadyClaimed] = await tx
      .select({ id: userPgpKeys.id, userId: userPgpKeys.userId })
      .from(userPgpKeys)
      .where(
        and(eq(userPgpKeys.fingerprint, row.fingerprint), eq(userPgpKeys.status, "claimed")),
      )
      .limit(1);

    if (alreadyClaimed && alreadyClaimed.userId !== userId) {
      throw new Error("This fingerprint is already claimed by another account.");
    }

    await tx
      .delete(userPgpKeys)
      .where(
        and(
          eq(userPgpKeys.fingerprint, row.fingerprint),
          eq(userPgpKeys.status, "pending"),
          ne(userPgpKeys.userId, userId),
        ),
      );

    await tx
      .update(userPgpKeys)
      .set({
        status: "claimed",
        verifyCodeHash: null,
        verifyChallengeCiphertext: null,
        verifyExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(userPgpKeys.id, row.id));
  });

  return {
    id: row.id,
    fingerprint: row.fingerprint,
    status: "claimed",
    verifyChallengeCiphertext: null,
    verifyExpiresAt: null,
    hasUserIdsWarning: true,
    updatedAt: now,
  };
}

export async function deleteUserPgpKey(userId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(userPgpKeys)
    .where(eq(userPgpKeys.userId, userId))
    .limit(1);
  if (!row) {
    throw new Error("No PGP key on file.");
  }

  const fingerprint = row.fingerprint;
  const isClaimed = row.status === "claimed";

  await db.transaction(async (tx) => {
    if (isClaimed) {
      const hashRows = await tx
        .select({ displayHash: senderHashes.displayHash })
        .from(senderHashes)
        .where(eq(senderHashes.recipientFingerprint, fingerprint));
      const hashes = hashRows.map((item) => item.displayHash);

      await tx.delete(messages).where(eq(messages.recipientFingerprint, fingerprint));
      await tx
        .delete(senderHashes)
        .where(eq(senderHashes.recipientFingerprint, fingerprint));
      if (hashes.length > 0) {
        await tx
          .delete(messageMutes)
          .where(and(eq(messageMutes.userId, userId), inArray(messageMutes.senderHash, hashes)));
      }
    }
    await tx.delete(userPgpKeys).where(eq(userPgpKeys.userId, userId));
  });
}

async function ensureSenderHash(
  recipientFingerprint: string,
  senderUserId: string,
): Promise<string> {
  const [existing] = await db
    .select({ displayHash: senderHashes.displayHash })
    .from(senderHashes)
    .where(
      and(
        eq(senderHashes.recipientFingerprint, recipientFingerprint),
        eq(senderHashes.senderUserId, senderUserId),
      ),
    )
    .limit(1);
  if (existing) {
    return existing.displayHash;
  }

  const displayHash = createSenderDisplayHash();
  try {
    await db.insert(senderHashes).values({
      id: randomUUID(),
      recipientFingerprint,
      senderUserId,
      displayHash,
      createdAt: new Date(),
    });
    return displayHash;
  } catch {
    const [retry] = await db
      .select({ displayHash: senderHashes.displayHash })
      .from(senderHashes)
      .where(
        and(
          eq(senderHashes.recipientFingerprint, recipientFingerprint),
          eq(senderHashes.senderUserId, senderUserId),
        ),
      )
      .limit(1);
    if (!retry) {
      throw new Error("Failed to allocate sender hash.");
    }
    return retry.displayHash;
  }
}

export async function sendEncryptedMessage(input: {
  senderUserId: string;
  recipientFingerprint: string;
  ciphertext: string;
}): Promise<{ id: string }> {
  const fingerprint = normalizeFingerprint(input.recipientFingerprint);
  if (!isValidFingerprint(fingerprint)) {
    throw new Error("Invalid recipient fingerprint.");
  }

  const key = await getPublicKeyForFingerprint(fingerprint);
  if (!key) {
    throw new Error("No public key found for that fingerprint.");
  }

  await assertEncryptedOpenPgpMessage(input.ciphertext);
  const ciphertext = input.ciphertext.trim();
  const senderHash = await ensureSenderHash(fingerprint, input.senderUserId);
  const id = randomUUID();
  const now = new Date();

  await db.insert(messages).values({
    id,
    recipientFingerprint: fingerprint,
    senderUserId: input.senderUserId,
    senderHash,
    ciphertext,
    size: Buffer.byteLength(ciphertext, "utf8"),
    createdAt: now,
    readAt: null,
  });

  return { id };
}

export async function listMessageThreads(userId: string): Promise<{
  hasClaimedKey: boolean;
  threads: MessageThreadSummary[];
}> {
  const claimed = await getClaimedPgpKeyForUser(userId);
  if (!claimed) {
    return { hasClaimedKey: false, threads: [] };
  }

  const muteRows = await db
    .select({ senderHash: messageMutes.senderHash })
    .from(messageMutes)
    .where(eq(messageMutes.userId, userId));
  const muted = new Set(muteRows.map((row) => row.senderHash));

  const rows = await db
    .select({
      senderHash: messages.senderHash,
      lastMessageAt: sql<Date>`max(${messages.createdAt})`.mapWith(messages.createdAt),
      messageCount: sql<number>`count(*)::int`,
      unreadCount: sql<number>`count(*) filter (where ${messages.readAt} is null)::int`,
    })
    .from(messages)
    .where(eq(messages.recipientFingerprint, claimed.fingerprint))
    .groupBy(messages.senderHash)
    .orderBy(desc(sql`max(${messages.createdAt})`));

  return {
    hasClaimedKey: true,
    threads: rows.map((row) => ({
      senderHash: row.senderHash,
      lastMessageAt:
        row.lastMessageAt instanceof Date
          ? row.lastMessageAt
          : new Date(row.lastMessageAt),
      unreadCount: Number(row.unreadCount ?? 0),
      messageCount: Number(row.messageCount ?? 0),
      isMuted: muted.has(row.senderHash),
    })),
  };
}

export async function listThreadMessages(
  userId: string,
  senderHash: string,
): Promise<{ hasClaimedKey: boolean; messages: MessageSummary[]; isMuted: boolean }> {
  const claimed = await getClaimedPgpKeyForUser(userId);
  if (!claimed) {
    return { hasClaimedKey: false, messages: [], isMuted: false };
  }

  const [mute] = await db
    .select({ id: messageMutes.id })
    .from(messageMutes)
    .where(and(eq(messageMutes.userId, userId), eq(messageMutes.senderHash, senderHash)))
    .limit(1);

  const rows = await db
    .select({
      id: messages.id,
      senderHash: messages.senderHash,
      size: messages.size,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.recipientFingerprint, claimed.fingerprint),
        eq(messages.senderHash, senderHash),
      ),
    )
    .orderBy(asc(messages.createdAt));

  return {
    hasClaimedKey: true,
    messages: rows,
    isMuted: Boolean(mute),
  };
}

export async function getMessageAndMarkRead(
  userId: string,
  messageId: string,
): Promise<MessageDetail | null> {
  const claimed = await getClaimedPgpKeyForUser(userId);
  if (!claimed) {
    return null;
  }

  const [row] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.recipientFingerprint, claimed.fingerprint),
      ),
    )
    .limit(1);
  if (!row) {
    return null;
  }

  let readAt = row.readAt;
  if (!readAt) {
    readAt = new Date();
    await db.update(messages).set({ readAt }).where(eq(messages.id, messageId));
  }

  return {
    id: row.id,
    senderHash: row.senderHash,
    size: row.size,
    createdAt: row.createdAt,
    readAt,
    ciphertext: row.ciphertext,
  };
}

export async function setThreadMuted(
  userId: string,
  senderHash: string,
  isMuted: boolean,
): Promise<void> {
  const claimed = await getClaimedPgpKeyForUser(userId);
  if (!claimed) {
    throw new Error("Claim a PGP key before managing mutes.");
  }

  const [owned] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.recipientFingerprint, claimed.fingerprint),
        eq(messages.senderHash, senderHash),
      ),
    )
    .limit(1);
  if (!owned) {
    throw new Error("Thread not found.");
  }

  if (isMuted) {
    const [existing] = await db
      .select({ id: messageMutes.id })
      .from(messageMutes)
      .where(and(eq(messageMutes.userId, userId), eq(messageMutes.senderHash, senderHash)))
      .limit(1);
    if (!existing) {
      await db.insert(messageMutes).values({
        id: randomUUID(),
        userId,
        senderHash,
        createdAt: new Date(),
      });
    }
    return;
  }

  await db
    .delete(messageMutes)
    .where(and(eq(messageMutes.userId, userId), eq(messageMutes.senderHash, senderHash)));
}

export async function countUnreadForUser(userId: string): Promise<number> {
  const claimed = await getClaimedPgpKeyForUser(userId);
  if (!claimed) {
    return 0;
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.recipientFingerprint, claimed.fingerprint),
        isNull(messages.readAt),
      ),
    );
  return Number(row?.count ?? 0);
}
