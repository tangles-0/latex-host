import { useSyncExternalStore } from "react";
import { isTextPreviewDocument } from "@/lib/media-types";

export const GALLERY_PRIVACY_STORAGE_KEY = "latex-gallery-privacy";
const GALLERY_PRIVACY_CHANGE_EVENT = "latex-gallery-privacy-change";

export type PrivacyVisual = "shapes" | "text" | "icon";

export function privacyVisualFor(item: {
  kind: string;
  ext?: string;
  mimeType?: string;
}): PrivacyVisual {
  if (item.kind === "image" || item.kind === "video") {
    return "shapes";
  }
  if (
    item.kind === "note" ||
    isTextPreviewDocument(item.mimeType ?? "", item.ext ?? "")
  ) {
    return "text";
  }
  return "icon";
}

export function readGalleryPrivacyMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(GALLERY_PRIVACY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistGalleryPrivacyMode(enabled: boolean) {
  try {
    window.localStorage.setItem(
      GALLERY_PRIVACY_STORAGE_KEY,
      enabled ? "1" : "0",
    );
    window.dispatchEvent(new Event(GALLERY_PRIVACY_CHANGE_EVENT));
  } catch {
    // ignore storage errors
  }
}

function subscribeGalleryPrivacy(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(GALLERY_PRIVACY_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(GALLERY_PRIVACY_CHANGE_EVENT, onStoreChange);
  };
}

function readServerGalleryPrivacyMode(): boolean {
  return false;
}

export function useGalleryPrivacyMode(): boolean {
  return useSyncExternalStore(
    subscribeGalleryPrivacy,
    readGalleryPrivacyMode,
    readServerGalleryPrivacyMode,
  );
}
