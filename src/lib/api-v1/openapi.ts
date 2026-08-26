export function buildOpenApiDocument(origin?: string): Record<string, unknown> {
  const servers = origin
    ? [{ url: origin.replace(/\/$/, "") }]
    : [{ url: "/" }];

  return {
    openapi: "3.1.0",
    info: {
      title: "latex! Public API",
      version: "1.0.0",
      description:
        "Public HTTP API for uploading files, creating notes, YouTube imports, and managing shares. Authenticate with an account API key: `Authorization: Bearer lh_live_…`.",
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API key",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
              },
            },
          },
        },
        File: {
          type: "object",
          properties: {
            id: { type: "string" },
            kind: {
              type: "string",
              enum: ["image", "video", "document", "other"],
            },
            fileName: { type: "string" },
            mimeType: { type: "string" },
            size: { type: "integer" },
            albumId: { type: "string", nullable: true },
            visibility: { type: "string", enum: ["private", "public"] },
            previewStatus: { type: "string" },
            previewError: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            shareUrl: { type: "string", nullable: true },
            shareUrls: {
              type: "object",
              nullable: true,
              properties: {
                original: { type: "string" },
                sm: { type: "string" },
                lg: { type: "string" },
              },
            },
            links: {
              type: "object",
              properties: {
                self: { type: "string" },
                content: { type: "string" },
              },
            },
          },
        },
        Note: {
          type: "object",
          properties: {
            id: { type: "string" },
            kind: { type: "string", enum: ["note"] },
            fileName: { type: "string" },
            content: { type: "string" },
            size: { type: "integer" },
            albumId: { type: "string", nullable: true },
            visibility: { type: "string", enum: ["private", "public"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            shareUrl: { type: "string", nullable: true },
            links: {
              type: "object",
              properties: { self: { type: "string" } },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1": {
        get: {
          summary: "API discovery and upload limits",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Discovery payload" } },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          summary: "OpenAPI document",
          security: [],
          responses: { "200": { description: "OpenAPI 3.1 JSON" } },
        },
      },
      "/api/v1/docs": {
        get: {
          summary: "Interactive API docs (Scalar)",
          security: [],
          responses: { "200": { description: "HTML documentation UI" } },
        },
      },
      "/api/v1/albums": {
        get: {
          summary: "List albums",
          responses: { "200": { description: "Album list" } },
        },
      },
      "/api/v1/files": {
        get: {
          summary: "List files",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "cursor", in: "query", schema: { type: "string" } },
            {
              name: "kind",
              in: "query",
              schema: {
                type: "string",
                enum: ["image", "video", "document", "other"],
              },
            },
            { name: "albumId", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Paginated files" } },
        },
        post: {
          summary: "Simple file upload",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    visibility: {
                      type: "string",
                      enum: ["private", "public"],
                    },
                    albumId: { type: "string" },
                    keepOriginalFileName: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Created file" },
            "413": { description: "Too large — use multipart" },
          },
        },
      },
      "/api/v1/files/{id}": {
        get: {
          summary: "Get file metadata",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "File" } },
        },
        delete: {
          summary: "Delete file",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/api/v1/files/{id}/content": {
        get: {
          summary: "Download file content",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            {
              name: "variant",
              in: "query",
              schema: { type: "string", enum: ["original", "sm", "lg"] },
            },
          ],
          responses: { "200": { description: "Binary content" } },
        },
      },
      "/api/v1/files/{id}/share": {
        post: {
          summary: "Create or return public share",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Share URLs" } },
        },
        delete: {
          summary: "Revoke public share",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Share revoked" } },
        },
      },
      "/api/v1/uploads": {
        post: {
          summary: "Init multipart upload",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["fileName", "fileSize"],
                  properties: {
                    fileName: { type: "string" },
                    fileSize: { type: "integer" },
                    mimeType: { type: "string" },
                    chunkSize: { type: "integer" },
                    checksum: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Upload session" } },
        },
      },
      "/api/v1/uploads/{id}": {
        get: {
          summary: "Upload session status",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Session status" } },
        },
      },
      "/api/v1/uploads/{id}/parts/{partNumber}": {
        put: {
          summary: "Upload or acknowledge a part",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            {
              name: "partNumber",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: { "200": { description: "Part accepted" } },
        },
      },
      "/api/v1/uploads/{id}/complete": {
        post: {
          summary: "Complete multipart upload and register media",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "201": { description: "Created file" } },
        },
      },
      "/api/v1/uploads/{id}/abort": {
        post: {
          summary: "Abort multipart upload",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Aborted" } },
        },
      },
      "/api/v1/notes": {
        get: {
          summary: "List notes",
          responses: { "200": { description: "Paginated notes" } },
        },
        post: {
          summary: "Create note",
          responses: { "201": { description: "Created note" } },
        },
      },
      "/api/v1/notes/{id}": {
        get: {
          summary: "Get note",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Note" } },
        },
        patch: {
          summary: "Update note content",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Updated note" } },
        },
        delete: {
          summary: "Delete note",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/api/v1/notes/{id}/share": {
        post: {
          summary: "Create or return note share",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Share URL" } },
        },
        delete: {
          summary: "Revoke note share",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Share revoked" } },
        },
      },
      "/api/v1/youtube/video/metadata": {
        post: {
          summary: "Resolve YouTube URL to video metadata and quality options",
          description:
            "Step 1 for video imports. Then POST /api/v1/youtube/video/ingests with url + qualityId.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: { url: { type: "string" } },
                },
              },
            },
          },
          responses: { "200": { description: "Metadata + qualities + size limits" } },
        },
      },
      "/api/v1/youtube/video/ingests": {
        get: {
          summary: "List YouTube video ingests",
          responses: { "200": { description: "Video ingest list" } },
        },
        post: {
          summary: "Start a YouTube video ingest",
          description:
            "Requires qualityId from POST /api/v1/youtube/video/metadata. Server re-fetches metadata to validate the quality.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "qualityId"],
                  properties: {
                    url: { type: "string" },
                    qualityId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Video ingest started" } },
        },
      },
      "/api/v1/youtube/video/ingests/{id}": {
        get: {
          summary: "Get YouTube video ingest status",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Video ingest" } },
        },
        delete: {
          summary: "Delete a YouTube video ingest record",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Deleted" } },
        },
      },
      "/api/v1/youtube/audio/ingests": {
        get: {
          summary: "List YouTube audio (MP3) ingests",
          responses: { "200": { description: "Audio ingest list" } },
        },
        post: {
          summary: "Start a YouTube MP3 ingest from a URL",
          description:
            "One-shot: pass only { url }. No metadata/quality step — highest-quality audio is selected automatically.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: { url: { type: "string" } },
                },
              },
            },
          },
          responses: { "201": { description: "Audio ingest started" } },
        },
      },
      "/api/v1/youtube/audio/ingests/{id}": {
        get: {
          summary: "Get YouTube audio ingest status",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Audio ingest" } },
        },
        delete: {
          summary: "Delete a YouTube audio ingest record",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "204": { description: "Deleted" } },
        },
      },
    },
  };
}

export function listedOpenApiPaths(): string[] {
  const doc = buildOpenApiDocument();
  return Object.keys((doc.paths as Record<string, unknown>) ?? {});
}
