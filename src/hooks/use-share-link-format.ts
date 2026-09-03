"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  SHARE_LINK_FORMAT_CHANGE_EVENT,
  SHARE_LINK_FORMAT_STORAGE_KEY,
  type ShareLinkFormat,
} from "@/lib/share-link-format";

let memoryFormat: ShareLinkFormat = "cloud";

const readStoredFormat = (): ShareLinkFormat => {
  try {
    const stored = window.localStorage.getItem(SHARE_LINK_FORMAT_STORAGE_KEY);
    if (stored === "cloud" || stored === "direct") {
      memoryFormat = stored;
    }
  } catch {}
  return memoryFormat;
};

export const useShareLinkFormat = (
  enabled: boolean,
): readonly [ShareLinkFormat, (format: ShareLinkFormat) => void] => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled) {
        return () => {};
      }
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== SHARE_LINK_FORMAT_STORAGE_KEY && event.key !== null) {
          return;
        }
        memoryFormat = event.newValue === "direct" ? "direct" : "cloud";
        onStoreChange();
      };
      const handleFormatChange = (event: Event) => {
        const nextFormat = (event as CustomEvent<ShareLinkFormat>).detail;
        if (nextFormat === "cloud" || nextFormat === "direct") {
          memoryFormat = nextFormat;
          onStoreChange();
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener(
        SHARE_LINK_FORMAT_CHANGE_EVENT,
        handleFormatChange,
      );
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(
          SHARE_LINK_FORMAT_CHANGE_EVENT,
          handleFormatChange,
        );
      };
    },
    [enabled],
  );
  const getSnapshot = useCallback(
    (): ShareLinkFormat => (enabled ? readStoredFormat() : "cloud"),
    [enabled],
  );
  const getServerSnapshot = useCallback(
    (): ShareLinkFormat => "cloud",
    [],
  );
  const format = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setFormat = useCallback(
    (nextFormat: ShareLinkFormat) => {
      if (!enabled) {
        return;
      }
      memoryFormat = nextFormat;
      try {
        window.localStorage.setItem(SHARE_LINK_FORMAT_STORAGE_KEY, nextFormat);
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
      window.dispatchEvent(
        new CustomEvent<ShareLinkFormat>(SHARE_LINK_FORMAT_CHANGE_EVENT, {
          detail: nextFormat,
        }),
      );
    },
    [enabled],
  );

  return [format, setFormat] as const;
};
