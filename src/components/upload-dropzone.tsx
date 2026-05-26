"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BlobMediaKind } from "@/lib/media-types";
import {
  DEFAULT_RESUMABLE_THRESHOLD,
  KEEP_ORIGINAL_FILE_NAME_STORAGE_KEY,
  uploadSingleMedia,
} from "@/lib/upload-client";
import { LightClock } from "@energiz3r/icon-library/Icons/Light/LightClock";
import { LightImages } from "@energiz3r/icon-library/Icons/Light/LightImages";
import { LightTrashAlt } from "@energiz3r/icon-library/Icons/Light/LightTrashAlt";
import { getFileIconForExtension } from "@/lib/FileIconHelper";

type UploadState = "idle" | "uploading" | "success" | "error";
type PreviewStatus = "pending" | "started" | "complete" | "error";
const PREVIEW_POLL_MAX_MS = 2 * 60 * 1000;

type UploadedImage = {
  id: string;
  kind: BlobMediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType?: string;
  previewStatus?: PreviewStatus;
};

type ShareInfo = {
  id: string;
  urls: {
    original: string;
  };
};

type UploadMessage = {
  id: string;
  text: string;
  tone: "success" | "error";
};

type YoutubeQualityOption = {
  id: string;
  label: string;
  height?: number;
  fps?: number;
  ext?: string;
  filesizeBytes?: number;
};

type YoutubeMetadata = {
  youtubeId: string;
  title: string;
  channelName?: string;
  durationSeconds?: number;
  qualities: YoutubeQualityOption[];
};

type YoutubeIngest = {
  id: string;
  youtubeId: string;
  title: string;
  channelName?: string;
  qualityLabel?: string;
  status:
    | "pending"
    | "started"
    | "downloading"
    | "uploading"
    | "complete"
    | "error";
  progress: number;
  error?: string;
  mediaId?: string;
  updatedAt: string;
};

type DeleteConfirmation =
  | {
      type: "upload";
      media: UploadedImage;
    }
  | {
      type: "youtube-upload";
      ingest: YoutubeIngest;
      media: UploadedImage;
    }
  | {
      type: "youtube-ingest";
      ingest: YoutubeIngest;
    };

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "textarea" ||
    tagName === "input" ||
    tagName === "select"
  );
}

function isPreviewPollingStatus(status: PreviewStatus | undefined): boolean {
  return status === "pending" || status === "started";
}

function extensionForClipboardMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

function clipboardImageFileName(index: number, mimeType: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `clipboard-image-${stamp}-${index + 1}.${extensionForClipboardMimeType(mimeType)}`;
}

function extractClipboardImageFiles(event: ClipboardEvent): File[] {
  const items = Array.from(event.clipboardData?.items ?? []);
  return items
    .filter(
      (item) =>
        item.kind === "file" && item.type.toLowerCase().startsWith("image/"),
    )
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) {
        return null;
      }
      if (file.name) {
        return file;
      }
      return new File([file], clipboardImageFileName(index, file.type), {
        type: file.type,
        lastModified: Date.now(),
      });
    })
    .filter(Boolean) as File[];
}

export default function UploadDropzone({
  uploadsEnabled = true,
  resumableThresholdBytes = DEFAULT_RESUMABLE_THRESHOLD,
}: {
  uploadsEnabled?: boolean;
  resumableThresholdBytes?: number;
}) {
  const [albumId, setAlbumId] = useState("");
  const [status, setStatus] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [globalDragging, setGlobalDragging] = useState(false);
  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [albumPickerUpload, setAlbumPickerUpload] =
    useState<UploadedImage | null>(null);
  const [albumPickerAlbumId, setAlbumPickerAlbumId] = useState("");
  const [albumPickerNewAlbumName, setAlbumPickerNewAlbumName] = useState("");
  const [albumPickerError, setAlbumPickerError] = useState<string | null>(null);
  const [isCreatingAlbumFromPicker, setIsCreatingAlbumFromPicker] =
    useState(false);
  const [isSavingAlbumPicker, setIsSavingAlbumPicker] = useState(false);
  const [recentUploads, setRecentUploads] = useState<UploadedImage[]>([]);
  const [shareStates, setShareStates] = useState<Record<string, ShareInfo>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [messages, setMessages] = useState<UploadMessage[]>([]);
  const [youtubeIngestMedia, setYoutubeIngestMedia] = useState<
    Record<string, UploadedImage>
  >({});
  const [uploadProgress, setUploadProgress] = useState<
    Record<
      string,
      { name: string; uploaded: number; total: number; resumed: boolean }
    >
  >({});
  const [incompleteSessions, setIncompleteSessions] = useState<
    Array<{
      id: string;
      fileName: string;
      fileSize: number;
      state: string;
      uploadedPartsCount: number;
      totalParts: number;
      checksum?: string;
      updatedAt: string;
    }>
  >([]);
  const [isClearingFailed, setIsClearingFailed] = useState(false);
  const [keepOriginalFileName, setKeepOriginalFileName] = useState(false);
  const [hasLoadedKeepOriginalFileName, setHasLoadedKeepOriginalFileName] =
    useState(false);
  const [youtubeIngests, setYoutubeIngests] = useState<YoutubeIngest[]>([]);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeMetadata, setYoutubeMetadata] =
    useState<YoutubeMetadata | null>(null);
  const [selectedYoutubeQualityId, setSelectedYoutubeQualityId] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isFetchingYoutubeMetadata, setIsFetchingYoutubeMetadata] =
    useState(false);
  const [isStartingYoutubeIngest, setIsStartingYoutubeIngest] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);
  const [isDeletingConfirmedItem, setIsDeletingConfirmedItem] = useState(false);
  const dragCounter = useRef(0);
  const uploadFilesRef = useRef<(files: FileList | File[]) => Promise<void>>(
    async () => {},
  );
  const inputId = useId();

  const statusText = useMemo(() => {
    if (status === "uploading") return "uploading...";
    if (status === "success") return "upload complete.";
    if (status === "error") return message ?? "oh shi-";
    return "drag N drop files here, or click 2 browse";
  }, [message, status]);

  const pushMessage = useCallback(
    (text: string, tone: UploadMessage["tone"]) => {
      const entry: UploadMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        tone,
      };
      setMessages((current) => [entry, ...current]);
      window.setTimeout(() => {
        setMessages((current) =>
          current.filter((item) => item.id !== entry.id),
        );
      }, 4000);
    },
    [],
  );

  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
    const gb = 1024 * 1024 * 1024;
    const mb = 1024 * 1024;
    if (bytes >= gb) {
      return `${(bytes / gb).toFixed(2)} GB`;
    }
    return `${(bytes / mb).toFixed(1)} MB`;
  }

  async function hashFileForResume(file: File): Promise<string> {
    // Use full-file SHA-256 so resume matching and server-side integrity validation
    // use the same checksum value.
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
  }

  async function loadIncompleteSessions() {
    const response = await fetch("/api/uploads/list", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      sessions?: Array<{
        id: string;
        fileName: string;
        fileSize: number;
        state: string;
        uploadedPartsCount: number;
        totalParts: number;
        checksum?: string;
        updatedAt: string;
      }>;
    };
    setIncompleteSessions(payload.sessions ?? []);
  }

  const loadYoutubeIngests = useCallback(async () => {
    const response = await fetch("/api/youtube/ingests", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { ingests?: YoutubeIngest[] };
    const incoming = payload.ingests ?? [];
    setYoutubeIngests((current) => {
      const incomingIds = new Set(incoming.map((ingest) => ingest.id));
      const localCompleted = current.filter(
        (ingest) =>
          ingest.status === "complete" &&
          Boolean(ingest.mediaId) &&
          Boolean(youtubeIngestMedia[ingest.id]) &&
          !incomingIds.has(ingest.id),
      );
      return [...incoming, ...localCompleted];
    });
  }, [youtubeIngestMedia]);

  const loadCompletedYoutubeIngestMedia = useCallback(
    async (ingest: YoutubeIngest) => {
      if (!ingest.mediaId || youtubeIngestMedia[ingest.id]) {
        return;
      }
      const response = await fetch(
        `/api/media?kind=video&mediaId=${encodeURIComponent(ingest.mediaId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        media?: UploadedImage;
      };
      if (!payload.media) {
        return;
      }
      setYoutubeIngestMedia((current) => ({
        ...current,
        [ingest.id]: payload.media!,
      }));
      const deleteResponse = await fetch(
        `/api/youtube/ingests/${encodeURIComponent(ingest.id)}`,
        {
          method: "DELETE",
        },
      );
      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        pushMessage(
          "Unable to clear completed YouTube ingest record.",
          "error",
        );
      }
    },
    [pushMessage, youtubeIngestMedia],
  );

  async function clearFailedSessions() {
    const clearableIds = incompleteSessions
      .filter(
        (session) =>
          session.state === "failed" || session.state === "finalizing",
      )
      .map((session) => session.id);
    if (clearableIds.length === 0) {
      return;
    }
    setIsClearingFailed(true);
    const response = await fetch("/api/uploads/clear-failed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: clearableIds }),
    });
    if (!response.ok) {
      pushMessage("Unable to clear stuck uploads.", "error");
      setIsClearingFailed(false);
      return;
    }
    setIncompleteSessions((current) =>
      current.filter(
        (session) =>
          session.state !== "failed" && session.state !== "finalizing",
      ),
    );
    pushMessage("Cleared stuck uploads.", "success");
    setIsClearingFailed(false);
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        KEEP_ORIGINAL_FILE_NAME_STORAGE_KEY,
      );
      setKeepOriginalFileName(stored === "1");
    } catch {
      // ignore storage errors
    } finally {
      setHasLoadedKeepOriginalFileName(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedKeepOriginalFileName) {
      return;
    }
    try {
      window.localStorage.setItem(
        KEEP_ORIGINAL_FILE_NAME_STORAGE_KEY,
        keepOriginalFileName ? "1" : "0",
      );
    } catch {
      // ignore storage errors
    }
  }, [hasLoadedKeepOriginalFileName, keepOriginalFileName]);

  useEffect(() => {
    let isMounted = true;
    async function loadAlbumsAndSessions() {
      const [albumsResponse, sessionsResponse, youtubeResponse] =
        await Promise.all([
          fetch("/api/albums"),
          fetch("/api/uploads/list", { cache: "no-store" }),
          fetch("/api/youtube/ingests", { cache: "no-store" }),
        ]);
      if (albumsResponse.ok) {
        const payload = (await albumsResponse.json()) as {
          albums?: { id: string; name: string }[];
        };
        if (isMounted && payload.albums) {
          setAlbums(payload.albums);
        }
      }
      if (sessionsResponse.ok) {
        const payload = (await sessionsResponse.json()) as {
          sessions?: Array<{
            id: string;
            fileName: string;
            fileSize: number;
            state: string;
            uploadedPartsCount: number;
            totalParts: number;
            checksum?: string;
            updatedAt: string;
          }>;
        };
        if (isMounted) {
          setIncompleteSessions(payload.sessions ?? []);
        }
      }
      if (youtubeResponse.ok) {
        const payload = (await youtubeResponse.json()) as {
          ingests?: YoutubeIngest[];
        };
        if (isMounted) {
          setYoutubeIngests(payload.ingests ?? []);
        }
      }
    }

    void loadAlbumsAndSessions();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const activeIngests = youtubeIngests.filter(
      (ingest) => ingest.status !== "complete" && ingest.status !== "error",
    );
    if (activeIngests.length === 0) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadYoutubeIngests();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [loadYoutubeIngests, youtubeIngests]);

  useEffect(() => {
    const completed = youtubeIngests.filter(
      (ingest) => ingest.status === "complete" && Boolean(ingest.mediaId),
    );
    for (const ingest of completed) {
      void loadCompletedYoutubeIngestMedia(ingest);
    }
  }, [loadCompletedYoutubeIngestMedia, youtubeIngests]);

  useEffect(() => {
    function handleDragEnter(event: DragEvent) {
      if (!uploadsEnabled) return;
      event.preventDefault();
      dragCounter.current += 1;
      setGlobalDragging(true);
    }

    function handleDragOver(event: DragEvent) {
      if (!uploadsEnabled) return;
      event.preventDefault();
    }

    function handleDragLeave(event: DragEvent) {
      if (!uploadsEnabled) return;
      event.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        setGlobalDragging(false);
      }
    }

    function handleDrop(event: DragEvent) {
      if (!uploadsEnabled) return;
      event.preventDefault();
      dragCounter.current = 0;
      setGlobalDragging(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        void uploadFilesRef.current(files);
      }
    }

    function handlePaste(event: ClipboardEvent) {
      if (!uploadsEnabled || isEditablePasteTarget(event.target)) {
        return;
      }
      const files = extractClipboardImageFiles(event);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      void uploadFilesRef.current(files);
    }

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("paste", handlePaste);
    };
  }, [uploadsEnabled]);

  useEffect(() => {
    const pending = [
      ...recentUploads,
      ...Object.values(youtubeIngestMedia),
    ].filter((item) => isPreviewPollingStatus(item.previewStatus));
    if (pending.length === 0) {
      return;
    }
    let isMounted = true;
    const startedAt = Date.now();
    let timeoutId: number | undefined;
    const poll = async () => {
      const response = await fetch("/api/media/preview-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaIds: pending.slice(0, 100).map((item) => item.id),
        }),
        cache: "no-store",
      });
      if (response.ok && isMounted) {
        const payload = (await response.json()) as {
          media?: Array<{ mediaId: string; previewStatus?: PreviewStatus }>;
        };
        const statusById = new Map(
          (payload.media ?? []).map((item) => [
            item.mediaId,
            item.previewStatus,
          ]),
        );
        setRecentUploads((current) => {
          let changed = false;
          const next = current.map((entry) => {
            const previewStatus = statusById.get(entry.id);
            if (!previewStatus || entry.previewStatus === previewStatus) {
              return entry;
            }
            changed = true;
            return { ...entry, previewStatus };
          });
          return changed ? next : current;
        });
        setYoutubeIngestMedia((current) => {
          let changed = false;
          const next = Object.fromEntries(
            Object.entries(current).map(([ingestId, entry]) => {
              const previewStatus = statusById.get(entry.id);
              if (!previewStatus || entry.previewStatus === previewStatus) {
                return [ingestId, entry];
              }
              changed = true;
              return [ingestId, { ...entry, previewStatus }];
            }),
          );
          return changed ? next : current;
        });
      }
      if (isMounted && Date.now() - startedAt < PREVIEW_POLL_MAX_MS) {
        const hasSlowItem = pending.some(
          (item) => item.kind === "video" || item.kind === "document",
        );
        timeoutId = window.setTimeout(
          () => {
            void poll();
          },
          hasSlowItem ? 10000 : 5000,
        );
      }
    };
    timeoutId = window.setTimeout(
      () => {
        void poll();
      },
      pending.some((item) => item.kind === "video" || item.kind === "document")
        ? 10000
        : 5000,
    );
    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [recentUploads, youtubeIngestMedia]);

  async function uploadFiles(files: FileList | File[]) {
    if (!uploadsEnabled) {
      setStatus("error");
      setMessage("Uploads are currently disabled.");
      return;
    }
    const items = Array.from(files);
    if (items.length === 0) {
      setStatus("error");
      setMessage("Please drop files.");
      return;
    }

    setStatus("uploading");
    setMessage(null);

    for (const file of items) {
      const fileKey = `${file.name}::${file.size}::${file.lastModified}`;
      let checksum: string | undefined;
      try {
        checksum = await hashFileForResume(file);
      } catch {
        checksum = undefined;
      }
      const resumeCandidate = checksum
        ? incompleteSessions.find(
            (session) =>
              session.checksum === checksum &&
              session.fileSize === file.size &&
              session.fileName === file.name &&
              session.state !== "complete",
          )
        : undefined;
      const fallbackResumeCandidate = !resumeCandidate
        ? incompleteSessions.find(
            (session) =>
              session.fileSize === file.size &&
              session.fileName === file.name &&
              session.state !== "complete",
          )
        : undefined;
      const selectedResumeCandidate =
        resumeCandidate ?? fallbackResumeCandidate;
      const isResumed = Boolean(selectedResumeCandidate?.id);
      if (selectedResumeCandidate?.id) {
        setIncompleteSessions((current) =>
          current.filter(
            (session) => session.id !== selectedResumeCandidate.id,
          ),
        );
      }
      setUploadProgress((current) => ({
        ...current,
        [fileKey]: {
          name: file.name,
          uploaded: 0,
          total: file.size,
          resumed: isResumed,
        },
      }));
      const result = await uploadSingleMedia(
        file,
        albumId.trim() || undefined,
        {
          resumableThresholdBytes,
          resumeFromSessionId: selectedResumeCandidate?.id,
          checksum,
          keepOriginalFileName,
          onProgress: (uploaded, total) => {
            setUploadProgress((current) => ({
              ...current,
              [fileKey]: {
                name: file.name,
                uploaded,
                total,
                resumed: isResumed,
              },
            }));
          },
        },
      );
      pushMessage(result.message, result.ok ? "success" : "error");

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        setUploadProgress((current) => {
          const next = { ...current };
          delete next[fileKey];
          return next;
        });
        await loadIncompleteSessions();
        continue;
      }

      const image = result.media;
      if (!image) {
        continue;
      }
      setRecentUploads((current) => {
        const next = [
          {
            id: image.id,
            kind: image.kind,
            baseName: image.baseName,
            originalFileName:
              image.originalFileName ??
              (keepOriginalFileName ? file.name : undefined),
            ext: image.ext,
            mimeType: image.mimeType,
            previewStatus: image.previewStatus,
          },
          ...current,
        ];
        return next.slice(0, 10);
      });
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[fileKey];
        return next;
      });
      // Session row already removed when resume started.
    }

    setStatus("success");
    setMessage(null);
    await loadIncompleteSessions();
  }

  useEffect(() => {
    uploadFilesRef.current = uploadFiles;
  });

  async function createAlbum(
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    const response = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Unable to create album.");
    }

    const payload = (await response.json()) as {
      album: { id: string; name: string };
    };
    setAlbums((current) => [payload.album, ...current]);
    return payload.album;
  }

  async function handleCreateAlbum() {
    const name = newAlbumName.trim();
    if (!name) {
      setAlbumError("Album name is required.");
      return;
    }

    setAlbumError(null);
    try {
      const album = await createAlbum(name);
      if (!album) {
        setAlbumError("Album name is required.");
        return;
      }
      setAlbumId(album.id);
      setNewAlbumName("");
      setIsAlbumModalOpen(false);
    } catch (error) {
      setAlbumError(
        error instanceof Error ? error.message : "Unable to create album.",
      );
    }
  }

  function openYoutubeModal() {
    setYoutubeUrl("");
    setYoutubeMetadata(null);
    setSelectedYoutubeQualityId("");
    setYoutubeError(null);
    setIsYoutubeModalOpen(true);
  }

  async function fetchYoutubeMetadata() {
    const url = youtubeUrl.trim();
    if (!url) {
      setYoutubeError("YouTube URL is required.");
      return;
    }
    setYoutubeError(null);
    setIsFetchingYoutubeMetadata(true);
    try {
      const response = await fetch("/api/youtube/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as {
        metadata?: YoutubeMetadata;
        error?: string;
      };
      if (!response.ok || !payload.metadata) {
        throw new Error(payload.error ?? "Unable to fetch YouTube metadata.");
      }
      setYoutubeMetadata(payload.metadata);
      setSelectedYoutubeQualityId(payload.metadata.qualities[0]?.id ?? "");
    } catch (error) {
      setYoutubeError(
        error instanceof Error
          ? error.message
          : "Unable to fetch YouTube metadata.",
      );
    } finally {
      setIsFetchingYoutubeMetadata(false);
    }
  }

  async function startYoutubeIngest() {
    if (!youtubeMetadata || !selectedYoutubeQualityId) {
      setYoutubeError("Choose a quality option.");
      return;
    }
    const quality = youtubeMetadata.qualities.find(
      (item) => item.id === selectedYoutubeQualityId,
    );
    setYoutubeError(null);
    setIsStartingYoutubeIngest(true);
    try {
      const response = await fetch("/api/youtube/ingests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: youtubeUrl.trim(),
          youtubeId: youtubeMetadata.youtubeId,
          title: youtubeMetadata.title,
          channelName: youtubeMetadata.channelName,
          durationSeconds: youtubeMetadata.durationSeconds,
          qualityId: selectedYoutubeQualityId,
          qualityLabel: quality?.label ?? selectedYoutubeQualityId,
        }),
      });
      const payload = (await response.json()) as {
        ingest?: YoutubeIngest;
        error?: string;
      };
      if (!response.ok || !payload.ingest) {
        throw new Error(payload.error ?? "Unable to start YouTube ingest.");
      }
      setYoutubeIngests((current) => [payload.ingest!, ...current]);
      setIsYoutubeModalOpen(false);
      pushMessage("YouTube ingest started.", "success");
    } catch (error) {
      setYoutubeError(
        error instanceof Error
          ? error.message
          : "Unable to start YouTube ingest.",
      );
    } finally {
      setIsStartingYoutubeIngest(false);
    }
  }

  async function deleteYoutubeIngest(ingest: YoutubeIngest) {
    const response = await fetch(
      `/api/youtube/ingests/${encodeURIComponent(ingest.id)}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      pushMessage(payload.error ?? "Unable to delete YouTube ingest.", "error");
      return;
    }
    setYoutubeIngests((current) =>
      current.filter((item) => item.id !== ingest.id),
    );
  }

  function openAlbumPicker(upload: UploadedImage) {
    setAlbumPickerUpload(upload);
    setAlbumPickerAlbumId("");
    setAlbumPickerNewAlbumName("");
    setAlbumPickerError(null);
    setIsCreatingAlbumFromPicker(false);
  }

  function closeAlbumPicker(force = false) {
    if (isSavingAlbumPicker && !force) {
      return;
    }
    setAlbumPickerUpload(null);
    setAlbumPickerAlbumId("");
    setAlbumPickerNewAlbumName("");
    setAlbumPickerError(null);
    setIsCreatingAlbumFromPicker(false);
  }

  async function addRecentUploadToAlbum(
    upload: UploadedImage,
    targetAlbumId: string,
  ) {
    const response = await fetch("/api/media/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addToAlbum",
        albumId: targetAlbumId,
        mediaItems: [{ id: upload.id, kind: upload.kind }],
      }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Unable to add file to album.");
    }
  }

  async function handleSaveAlbumPicker() {
    if (!albumPickerUpload) {
      return;
    }
    setAlbumPickerError(null);

    const existingAlbumId = albumPickerAlbumId.trim();
    const newAlbumName = albumPickerNewAlbumName.trim();
    if (!existingAlbumId && !newAlbumName) {
      setAlbumPickerError("Pick an album or create a new one.");
      return;
    }

    setIsSavingAlbumPicker(true);
    try {
      let targetAlbumId = existingAlbumId;
      if (!targetAlbumId) {
        const album = await createAlbum(newAlbumName);
        if (!album) {
          throw new Error("Album name is required.");
        }
        targetAlbumId = album.id;
      }
      await addRecentUploadToAlbum(albumPickerUpload, targetAlbumId);
      pushMessage("added 2 album.", "success");
      closeAlbumPicker(true);
    } catch (error) {
      setAlbumPickerError(
        error instanceof Error ? error.message : "Unable to add file to album.",
      );
    } finally {
      setIsSavingAlbumPicker(false);
    }
  }

  async function enableSharing(
    image: UploadedImage,
  ): Promise<ShareInfo | null> {
    const response = await fetch("/api/media-shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: image.kind, mediaId: image.id }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      share: { id: string };
      urls: { original: string };
    };
    const nextShare = {
      id: payload.share.id,
      urls: { original: payload.urls.original },
    };
    setShareStates((current) => ({
      ...current,
      [image.id]: nextShare,
    }));
    return nextShare;
  }

  async function copyShare(image: UploadedImage) {
    let share: ShareInfo | null | undefined = shareStates[image.id];
    if (!share) {
      share = await enableSharing(image);
    }
    if (!share) {
      return;
    }
    await navigator.clipboard.writeText(
      `${window.location.origin}${share.urls.original}`,
    );
    setCopied(image.id);
    window.setTimeout(
      () => setCopied((current) => (current === image.id ? null : current)),
      1200,
    );
  }

  async function deleteRecentUpload(image: UploadedImage): Promise<boolean> {
    const response = await fetch("/api/media/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        mediaItems: [{ id: image.id, kind: image.kind }],
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      pushMessage(payload.error ?? "Unable to delete image.", "error");
      return false;
    }

    setRecentUploads((current) =>
      current.filter((item) => item.id !== image.id),
    );
    setShareStates((current) => {
      if (!(image.id in current)) {
        return current;
      }
      const next = { ...current };
      delete next[image.id];
      return next;
    });
    pushMessage("img deleted.", "success");
    return true;
  }

  async function deleteCompletedYoutubeIngest(
    ingest: YoutubeIngest,
    media: UploadedImage,
  ): Promise<boolean> {
    const deleted = await deleteRecentUpload(media);
    if (!deleted) {
      return false;
    }
    setYoutubeIngests((current) =>
      current.filter((item) => item.id !== ingest.id),
    );
    setYoutubeIngestMedia((current) => {
      const next = { ...current };
      delete next[ingest.id];
      return next;
    });
    return true;
  }

  async function confirmDelete() {
    if (!deleteConfirmation || isDeletingConfirmedItem) {
      return;
    }
    setIsDeletingConfirmedItem(true);
    try {
      if (deleteConfirmation.type === "upload") {
        const deleted = await deleteRecentUpload(deleteConfirmation.media);
        if (deleted) {
          setDeleteConfirmation(null);
        }
        return;
      }
      if (deleteConfirmation.type === "youtube-upload") {
        const deleted = await deleteCompletedYoutubeIngest(
          deleteConfirmation.ingest,
          deleteConfirmation.media,
        );
        if (deleted) {
          setDeleteConfirmation(null);
        }
        return;
      }
      await deleteYoutubeIngest(deleteConfirmation.ingest);
      setDeleteConfirmation(null);
    } finally {
      setIsDeletingConfirmedItem(false);
    }
  }

  function deleteConfirmationCopy(): {
    title: string;
    body: string;
    confirmLabel: string;
  } {
    if (!deleteConfirmation) {
      return { title: "", body: "", confirmLabel: "delete" };
    }
    if (deleteConfirmation.type === "youtube-ingest") {
      const isFailed = deleteConfirmation.ingest.status === "error";
      return {
        title: isFailed ? "Delete YouTube ingest?" : "Cancel YouTube ingest?",
        body: isFailed
          ? `Delete the failed YouTube ingest for "${deleteConfirmation.ingest.title}"?`
          : `Cancel the YouTube ingest for "${deleteConfirmation.ingest.title}"?`,
        confirmLabel: isFailed ? "delete" : "cancel ingest",
      };
    }
    const name =
      deleteConfirmation.type === "upload"
        ? deleteConfirmation.media.originalFileName ||
          deleteConfirmation.media.baseName
        : deleteConfirmation.ingest.title;
    return {
      title: "Delete upload?",
      body: `Delete "${name}" from your gallery? This cannot be undone.`,
      confirmLabel: "delete",
    };
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onDropVisual(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  return (
    <section className="space-y-3 rounded-md border border-neutral-200 p-4">
      <h2 className="text-lg font-medium">upload files</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="block text-xs text-neutral-500" htmlFor={inputId}>
          album (optional)
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAlbumError(null);
              setIsAlbumModalOpen(true);
            }}
            className="rounded border border-neutral-200 px-3 py-1 text-xs"
          >
            + album
          </button>
          <button
            type="button"
            onClick={openYoutubeModal}
            className="rounded border border-neutral-200 px-3 py-1 text-xs"
          >
            + youtube
          </button>
        </div>
      </div>
      <select
        id={inputId}
        name="albumId"
        value={albumId}
        onChange={(event) => setAlbumId(event.target.value)}
        className="w-full rounded border px-3 py-2 pr-8 appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 0.75rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1rem",
        }}
      >
        <option value="">no album</option>
        {albums.map((album) => (
          <option key={album.id} value={album.id}>
            {album.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={keepOriginalFileName}
          onChange={(event) => setKeepOriginalFileName(event.target.checked)}
        />
        keep original file name
      </label>

      <div
        role="button"
        tabIndex={0}
        onDragOver={uploadsEnabled ? onDragOver : undefined}
        onDragLeave={uploadsEnabled ? onDragLeave : undefined}
        onDrop={uploadsEnabled ? onDropVisual : undefined}
        onClick={
          uploadsEnabled
            ? () => document.getElementById(`${inputId}-file`)?.click()
            : undefined
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (uploadsEnabled) {
              document.getElementById(`${inputId}-file`)?.click();
            }
          }
        }}
        className={`flex min-h-[180px] flex-col items-center justify-center rounded border border-dashed px-6 py-8 text-center text-sm transition ${
          uploadsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"
        } ${isDragging || globalDragging ? "border-black bg-neutral-50" : "border-neutral-300"}`}
      >
        <p className="font-medium">{statusText}</p>
        <p className="mt-2 text-xs text-neutral-500">
          files are stored by upload time with metadata removed.
        </p>
      </div>

      <input
        id={`${inputId}-file`}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        disabled={!uploadsEnabled}
        onChange={(event) => {
          if (event.target.files?.length) {
            void uploadFiles(event.target.files);
          }
        }}
      />

      {globalDragging ? (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black/30" />
      ) : null}

      {messages.length > 0 ? (
        <div className="fixed top-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 space-y-2 px-4">
          {messages.map((item) => (
            <div
              key={item.id}
              className={`rounded border px-3 py-2 text-xs shadow ${
                item.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {item.text}
            </div>
          ))}
        </div>
      ) : null}

      {recentUploads.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-neutral-600">
            ur recent uploads
          </h3>
          <div className="space-y-2">
            {recentUploads.map((image) => {
              const thumbUrl =
                image.kind === "image"
                  ? `/media/${image.kind}/${image.id}/${image.baseName}-sm.${image.ext}`
                  : `/media/${image.kind}/${image.id}/${image.baseName}-sm.png`;
              return (
                <div
                  key={image.id}
                  className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {image.previewStatus === "pending" ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500">
                        <LightClock className="h-4 w-4" fill="currentColor" />
                      </div>
                    ) : image.previewStatus !== "complete" &&
                      image.kind !== "other" ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500">
                        {(() => {
                          const Icon = getFileIconForExtension(image.ext);
                          return (
                            <Icon className="h-4 w-4" fill="currentColor" />
                          );
                        })()}
                      </div>
                    ) : image.kind === "other" ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500">
                        {(() => {
                          const Icon = getFileIconForExtension(image.ext);
                          return (
                            <Icon className="h-4 w-4" fill="currentColor" />
                          );
                        })()}
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumbUrl}
                        alt="Uploaded thumbnail"
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <span className="max-w-[160px] truncate">
                      {image.originalFileName || image.baseName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAlbumPicker(image)}
                      className="rounded border border-neutral-200 px-3 py-1 text-xs"
                      aria-label="Add to album"
                      title="Add to album"
                    >
                      <LightImages className="h-4 w-4" fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyShare(image)}
                      className="rounded border border-neutral-200 px-3 py-1 text-xs"
                    >
                      {copied === image.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirmation({ type: "upload", media: image })
                      }
                      className="rounded border border-neutral-200 px-3 py-1 text-xs text-neutral-500"
                      aria-label="Delete image"
                      title="Delete image"
                    >
                      <LightTrashAlt className="h-4 w-4" fill="currentColor" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {Object.keys(uploadProgress).length > 0 ? (
        <div className="space-y-2 rounded border border-neutral-200 p-3">
          <h3 className="text-xs font-medium text-neutral-600">
            upload progress
          </h3>
          <div className="space-y-1">
            {Object.entries(uploadProgress).map(([key, progress]) => (
              <div key={key} className="text-xs text-neutral-600">
                {progress.resumed ? `Resumed: ${progress.name}` : progress.name}
                : {formatBytes(progress.uploaded)} /{" "}
                {formatBytes(progress.total)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {youtubeIngests.length > 0 ? (
        <div className="space-y-2 rounded border border-neutral-200 p-3">
          <h3 className="text-xs font-medium text-neutral-600">
            Youtube Ingests
          </h3>
          <div className="space-y-2">
            {youtubeIngests.slice(0, 20).map((ingest) => {
              const media = youtubeIngestMedia[ingest.id];
              const thumbUrl = media
                ? `/media/${media.kind}/${media.id}/${media.baseName}-sm.png`
                : "";
              return (
                <div
                  key={ingest.id}
                  className="flex items-center justify-between gap-3 text-xs text-neutral-600"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {media ? (
                      media.previewStatus === "pending" ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500">
                          <LightClock className="h-4 w-4" fill="currentColor" />
                        </div>
                      ) : media.previewStatus !== "complete" ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500">
                          {(() => {
                            const Icon = getFileIconForExtension(media.ext);
                            return (
                              <Icon className="h-4 w-4" fill="currentColor" />
                            );
                          })()}
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={thumbUrl}
                          alt="YouTube upload thumbnail"
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      )
                    ) : null}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-neutral-700">
                        {ingest.title}
                      </div>
                      <div>
                        {ingest.channelName ? `${ingest.channelName} - ` : ""}
                        {ingest.qualityLabel ? `${ingest.qualityLabel} - ` : ""}
                        {ingest.status}
                        {ingest.status !== "complete" &&
                        ingest.status !== "error"
                          ? ` ${ingest.progress}%`
                          : ""}
                      </div>
                      {ingest.error ? (
                        <div className="text-red-600">{ingest.error}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {media ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openAlbumPicker(media)}
                          className="rounded border border-neutral-200 px-3 py-1 text-xs"
                          aria-label="Add to album"
                          title="Add to album"
                        >
                          <LightImages
                            className="h-4 w-4"
                            fill="currentColor"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyShare(media)}
                          className="rounded border border-neutral-200 px-3 py-1 text-xs"
                        >
                          {copied === media.id ? "Copied" : "Copy link"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirmation({
                              type: "youtube-upload",
                              ingest,
                              media,
                            })
                          }
                          className="rounded border border-neutral-200 px-3 py-1 text-xs text-neutral-500"
                          aria-label="Delete YouTube upload"
                          title="Delete YouTube upload"
                        >
                          <LightTrashAlt
                            className="h-4 w-4"
                            fill="currentColor"
                          />
                        </button>
                      </>
                    ) : null}
                    {!media && ingest.status !== "complete" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirmation({
                            type: "youtube-ingest",
                            ingest,
                          })
                        }
                        className="rounded border border-neutral-200 px-3 py-1 text-xs text-neutral-500"
                        aria-label={
                          ingest.status === "error"
                            ? "Delete YouTube ingest"
                            : "Cancel YouTube ingest"
                        }
                        title={
                          ingest.status === "error"
                            ? "Delete YouTube ingest"
                            : "Cancel YouTube ingest"
                        }
                      >
                        <LightTrashAlt
                          className="h-4 w-4"
                          fill="currentColor"
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {incompleteSessions.length > 0 ? (
        <div className="space-y-2 rounded border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-neutral-600">
              failed / interrupted uploads
            </h3>
            <button
              type="button"
              onClick={() => void clearFailedSessions()}
              disabled={
                isClearingFailed ||
                !incompleteSessions.some(
                  (session) =>
                    session.state === "failed" ||
                    session.state === "finalizing",
                )
              }
              className="rounded border border-neutral-200 px-2 py-1 text-[11px] disabled:opacity-50"
            >
              {isClearingFailed ? "Clearing..." : "Clear"}
            </button>
          </div>
          <div className="space-y-1">
            {incompleteSessions.slice(0, 20).map((session) => (
              <div key={session.id} className="text-xs text-neutral-600">
                {session.fileName} - {session.state} (
                {session.uploadedPartsCount}/{session.totalParts} parts,{" "}
                {formatBytes(session.fileSize)})
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {deleteConfirmation
        ? (() => {
            const copy = deleteConfirmationCopy();
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                <div className="w-full max-w-md rounded-md bg-white p-6 text-sm">
                  <h3 className="text-lg font-semibold">{copy.title}</h3>
                  <p className="mt-2 text-xs text-neutral-600">{copy.body}</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmation(null)}
                      disabled={isDeletingConfirmedItem}
                      className="rounded border border-neutral-200 px-3 py-1 text-xs disabled:opacity-50"
                    >
                      cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDelete()}
                      disabled={isDeletingConfirmedItem}
                      className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                    >
                      {isDeletingConfirmedItem
                        ? "working..."
                        : copy.confirmLabel}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        : null}

      {isAlbumModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 text-sm">
            <h3 className="text-lg font-semibold">create album</h3>
            <p className="mt-1 text-xs text-neutral-500">
              give the album a nice name so u can find it later. like Sir Pooty
              Pants
            </p>
            <input
              className="mt-4 w-full rounded border px-3 py-2"
              placeholder="album name"
              value={newAlbumName}
              onChange={(event) => setNewAlbumName(event.target.value)}
            />
            {albumError ? (
              <p className="mt-2 text-xs text-red-600">{albumError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAlbumModalOpen(false)}
                className="rounded border border-neutral-200 px-3 py-1 text-xs"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAlbum}
                className="rounded bg-black px-3 py-1 text-xs text-white"
              >
                saveth the album
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isYoutubeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-md bg-white p-6 text-sm">
            <h3 className="text-lg font-semibold">add youtube video</h3>
            <p className="mt-1 text-xs text-neutral-500">
              paste any YouTube URL. latex can handle the usual watch, short,
              shorts, and share URL shapes.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded border px-3 py-2"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(event) => {
                  setYoutubeUrl(event.target.value);
                  setYoutubeMetadata(null);
                  setSelectedYoutubeQualityId("");
                }}
              />
              <button
                type="button"
                onClick={() => void fetchYoutubeMetadata()}
                disabled={isFetchingYoutubeMetadata}
                className="rounded border border-neutral-200 px-3 py-1 text-xs disabled:opacity-50"
              >
                {isFetchingYoutubeMetadata ? "checking..." : "fetch"}
              </button>
            </div>
            {youtubeMetadata ? (
              <div className="mt-4 space-y-3 rounded border border-neutral-200 p-3">
                <div>
                  <div className="font-medium">{youtubeMetadata.title}</div>
                  <div className="text-xs text-neutral-500">
                    {youtubeMetadata.channelName
                      ? `${youtubeMetadata.channelName} - `
                      : ""}
                    {youtubeMetadata.durationSeconds
                      ? `${Math.round(youtubeMetadata.durationSeconds / 60)} min`
                      : ""}
                  </div>
                </div>
                <label className="block text-xs text-neutral-600">
                  quality
                  <select
                    value={selectedYoutubeQualityId}
                    onChange={(event) =>
                      setSelectedYoutubeQualityId(event.target.value)
                    }
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    {youtubeMetadata.qualities.map((quality) => (
                      <option key={quality.id} value={quality.id}>
                        {quality.label}
                        {quality.filesizeBytes
                          ? ` (${formatBytes(quality.filesizeBytes)})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {youtubeError ? (
              <p className="mt-2 text-xs text-red-600">{youtubeError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsYoutubeModalOpen(false)}
                className="rounded border border-neutral-200 px-3 py-1 text-xs"
              >
                cancel
              </button>
              {youtubeMetadata ? (
                <button
                  type="button"
                  onClick={() => {
                    setYoutubeMetadata(null);
                    setSelectedYoutubeQualityId("");
                    setYoutubeError(null);
                  }}
                  className="rounded border border-neutral-200 px-3 py-1 text-xs"
                >
                  new url
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void startYoutubeIngest()}
                disabled={!youtubeMetadata || isStartingYoutubeIngest}
                className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {isStartingYoutubeIngest ? "starting..." : "start download"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {albumPickerUpload ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 text-sm">
            <h3 className="text-lg font-semibold">add file 2 album</h3>
            <p className="mt-1 text-xs text-neutral-500">
              {albumPickerUpload.originalFileName || albumPickerUpload.baseName}
            </p>
            <select
              value={albumPickerAlbumId}
              onChange={(event) => {
                setAlbumPickerAlbumId(event.target.value);
                if (event.target.value) {
                  setIsCreatingAlbumFromPicker(false);
                }
              }}
              className="mt-4 w-full rounded border px-3 py-2 pr-8 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundPosition: "right 0.75rem center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "1rem",
              }}
            >
              <option value="">choose an existing album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setIsCreatingAlbumFromPicker((current) => !current);
                setAlbumPickerAlbumId("");
              }}
              className="mt-3 rounded border border-neutral-200 px-3 py-1 text-xs"
            >
              {isCreatingAlbumFromPicker ? "cancel new album" : "+ new album"}
            </button>
            {isCreatingAlbumFromPicker ? (
              <input
                className="mt-3 w-full rounded border px-3 py-2"
                placeholder="album name"
                value={albumPickerNewAlbumName}
                onChange={(event) =>
                  setAlbumPickerNewAlbumName(event.target.value)
                }
              />
            ) : null}
            {albumPickerError ? (
              <p className="mt-2 text-xs text-red-600">{albumPickerError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeAlbumPicker()}
                className="rounded border border-neutral-200 px-3 py-1 text-xs"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAlbumPicker()}
                disabled={isSavingAlbumPicker}
                className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {isSavingAlbumPicker ? "saving..." : "add 2 album"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
