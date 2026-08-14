import { z } from "zod";

export const visibilitySchema = z.enum(["private", "public"]);

export const fileKindSchema = z.enum(["image", "video", "document", "other"]);

export const mediaKindSchema = z.enum([
  "image",
  "video",
  "document",
  "other",
  "note",
]);

export const shareUrlsSchema = z.object({
  original: z.string().url(),
  sm: z.string().url(),
  lg: z.string().url(),
});

export const fileResourceSchema = z.object({
  id: z.string(),
  kind: fileKindSchema,
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  albumId: z.string().nullable(),
  visibility: visibilitySchema,
  previewStatus: z.string(),
  previewError: z.string().nullable().optional(),
  createdAt: z.string(),
  shareUrl: z.string().url().nullable().optional(),
  shareUrls: shareUrlsSchema.nullable().optional(),
  links: z.object({
    self: z.string(),
    content: z.string(),
  }),
});

export const noteResourceSchema = z.object({
  id: z.string(),
  kind: z.literal("note"),
  fileName: z.string(),
  content: z.string().optional(),
  size: z.number().int().nonnegative(),
  albumId: z.string().nullable(),
  visibility: visibilitySchema,
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  shareUrl: z.string().url().nullable().optional(),
  links: z.object({
    self: z.string(),
  }),
});

export const createNoteBodySchema = z.object({
  content: z.string().default(""),
  originalFileName: z.string().max(255).optional(),
  albumId: z.string().optional().nullable(),
  visibility: visibilitySchema.optional().default("private"),
});

export const patchNoteBodySchema = z.object({
  content: z.string(),
});

export const createUploadBodySchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().optional(),
  chunkSize: z.number().int().positive().optional(),
  checksum: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
});

export const completeUploadBodySchema = z.object({
  visibility: visibilitySchema.optional().default("private"),
  albumId: z.string().optional().nullable(),
  keepOriginalFileName: z.boolean().optional(),
  expectedTotalParts: z.number().int().positive().optional(),
  checksum: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
});

export const createShareBodySchema = z.object({
  password: z.string().min(1).max(256).optional().nullable(),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
  kind: fileKindSchema.optional(),
  albumId: z.string().optional(),
});

export const notesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
  albumId: z.string().optional(),
});

export type FileResource = z.infer<typeof fileResourceSchema>;
export type NoteResource = z.infer<typeof noteResourceSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
