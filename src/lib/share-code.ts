import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  albumShares,
  documentShares,
  fileShares,
  noteShares,
  selfHostedNodes,
  shareCodeRegistry,
  shares,
  videoShares,
} from "@/db/schema";

const CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SHARE_CODE_LENGTH = 8;
const ATTEMPTS_PER_LENGTH = 16;

export const randomShareCode = (length: number): string => {
  const bytes = randomBytes(length);
  let result = "";
  for (const byte of bytes) {
    result += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return result;
};

export const isGlobalShareCodeTaken = async (
  code: string,
): Promise<boolean> => {
  const lookups = await Promise.all([
    db
      .select({ id: shares.id })
      .from(shares)
      .where(eq(shares.code, code))
      .limit(1),
    db
      .select({ id: videoShares.id })
      .from(videoShares)
      .where(eq(videoShares.code, code))
      .limit(1),
    db
      .select({ id: documentShares.id })
      .from(documentShares)
      .where(eq(documentShares.code, code))
      .limit(1),
    db
      .select({ id: fileShares.id })
      .from(fileShares)
      .where(eq(fileShares.code, code))
      .limit(1),
    db
      .select({ id: noteShares.id })
      .from(noteShares)
      .where(eq(noteShares.code, code))
      .limit(1),
    db
      .select({ id: albumShares.id })
      .from(albumShares)
      .where(eq(albumShares.code, code))
      .limit(1),
    db
      .select({ id: selfHostedNodes.id })
      .from(selfHostedNodes)
      .where(eq(selfHostedNodes.nodeHash, code))
      .limit(1),
    db
      .select({ code: shareCodeRegistry.code })
      .from(shareCodeRegistry)
      .where(eq(shareCodeRegistry.code, code))
      .limit(1),
  ]);

  return lookups.some((rows) => Boolean(rows[0]));
};

const generateUniqueCode = async (
  startingLength: number,
  canGrow: boolean,
  kind: "share" | "node",
): Promise<string> => {
  let length = startingLength;
  while (length <= 64) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_LENGTH; attempt += 1) {
      const code = randomShareCode(length);
      if (!(await isGlobalShareCodeTaken(code))) {
        const reserved = await db
          .insert(shareCodeRegistry)
          .values({ code, kind, createdAt: new Date() })
          .onConflictDoNothing()
          .returning({ code: shareCodeRegistry.code });
        if (reserved[0]) {
          return code;
        }
      }
    }
    if (!canGrow) {
      break;
    }
    length += 1;
  }
  throw new Error("Unable to allocate a unique share code.");
};

export const generateUniqueShareCode = (): Promise<string> =>
  generateUniqueCode(SHARE_CODE_LENGTH, false, "share");

export const generateUniqueNodeHash = (): Promise<string> =>
  generateUniqueCode(2, true, "node");
