"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GalleryClient from "@/components/gallery-client";
import { getFileIconForExtension } from "@/lib/FileIconHelper";
import type { MediaKind } from "@/lib/media-types";
import { LightPencil } from "@energiz3r/icon-library/Icons/Light/LightPencil";
import { LightTrashAlt } from "@energiz3r/icon-library/Icons/Light/LightTrashAlt";
import { LightFolderTimes } from '@energiz3r/icon-library/Icons/Light/LightFolderTimes';
import { LightFolderOpen } from '@energiz3r/icon-library/Icons/Light/LightFolderOpen';
import { LightFilePlus } from '@energiz3r/icon-library/Icons/Light/LightFilePlus';

const HIDE_ALBUM_IMAGES_STORAGE_KEY = "latex-gallery-hide-album-images";

type AlbumInfo = {
  id: string;
  name: string;
};

type GalleryImage = {
  id: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType?: string;
  albumId?: string;
  albumIds?: string[];
  width?: number;
  height?: number;
  uploadedAt: string;
  shared?: boolean;
  previewStatus?: "pending" | "started" | "complete" | "error";
  previewText?: string;
};

type AlbumPreview =
  | {
      type: "thumbnail";
      id: string;
      kind: MediaKind;
      baseName: string;
      ext: string;
    }
  | {
      type: "icon";
      id: string;
      ext: string;
    };

function mediaBelongsToAlbum(image: GalleryImage, albumId: string): boolean {
  return image.albumIds?.includes(albumId) || image.albumId === albumId;
}

function hasThumbnailPreview(image: GalleryImage): boolean {
  return (
    (image.kind === "image" ||
      image.kind === "video" ||
      image.kind === "document") &&
    image.previewStatus === "complete"
  );
}

function previewExtForMedia(image: GalleryImage): string {
  return image.kind === "image" ? image.ext : "png";
}

function albumPreviewTileClass(index: number): string {
  const transforms = [
    "-rotate-3 -skew-y-1",
    "rotate-1 translate-y-1",
    "rotate-3 -translate-y-1 skew-y-1",
  ];
  return `h-20 w-full rounded object-cover shadow-sm ring-1 ring-black/5 transform-gpu ${transforms[index] ?? ""}`;
}

export default function GalleryTabs({
  albums,
  media,
  initialTab = "files",
  isAdmin,
  actions,
}: {
  albums: AlbumInfo[];
  media: GalleryImage[];
  initialTab?: "albums" | "files";
  isAdmin?: boolean;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [imageItems, setImageItems] = useState<GalleryImage[]>(media);
  const [activeTab, setActiveTab] = useState<"albums" | "files">(initialTab);
  const [fileTypeFilter, setFileTypeFilter] = useState<"all" | MediaKind>(
    "all",
  );
  const [albumItems, setAlbumItems] = useState(albums);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [albumToDelete, setAlbumToDelete] = useState<AlbumInfo | null>(null);
  const [albumToRename, setAlbumToRename] = useState<AlbumInfo | null>(null);
  const [renameAlbumName, setRenameAlbumName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createNoteRequestId, setCreateNoteRequestId] = useState(0);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  let storedSetting = "";
  try {
    storedSetting =
      window.localStorage.getItem(HIDE_ALBUM_IMAGES_STORAGE_KEY) ?? "0";
  } catch {} // ignore storage errors
  const [hideAlbumImages, setHideAlbumImages] = useState(storedSetting === "1");
  const [delBtnLabel, setDelBtnLabel] = useState("del album");

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HIDE_ALBUM_IMAGES_STORAGE_KEY,
        hideAlbumImages ? "1" : "0",
      );
    } catch {} // ignore storage errors
  }, [hideAlbumImages]);

  const albumPreviews = albumItems.map((album) => {
    const albumFiles = imageItems.filter((image) =>
      mediaBelongsToAlbum(image, album.id),
    );
    const thumbnailPreviews: AlbumPreview[] = albumFiles
      .filter(hasThumbnailPreview)
      .slice(0, 3)
      .map((image) => ({
        type: "thumbnail" as const,
        id: image.id,
        kind: image.kind,
        baseName: image.baseName,
        ext: previewExtForMedia(image),
      }));
    const thumbnailPreviewIds = new Set(
      thumbnailPreviews.map((preview) => preview.id),
    );
    const iconPreviews: AlbumPreview[] = albumFiles
      .filter((image) => !thumbnailPreviewIds.has(image.id))
      .slice(0, 3 - thumbnailPreviews.length)
      .map((image) => ({
        type: "icon" as const,
        id: image.id,
        ext: image.ext,
      }));

    return {
      ...album,
      fileCount: albumFiles.length,
      previews: [...thumbnailPreviews, ...iconPreviews],
    };
  });

  function setTab(next: "albums" | "files") {
    setActiveTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "albums") {
      params.set("tab", "albums");
    } else if (next === "files") {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  async function createAlbum() {
    const name = newAlbumName.trim();
    if (!name) {
      setCreateError("Album name is required.");
      return;
    }
    setCreateError(null);
    const response = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setCreateError(payload.error ?? "Unable to create album.");
      return;
    }

    const payload = (await response.json()) as {
      album: { id: string; name: string };
    };
    setAlbumItems((current) =>
      [...current, payload.album].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setNewAlbumName("");
    setIsCreateOpen(false);
  }

  async function deleteAlbum(album: AlbumInfo) {
    setDeleteError(null);
    const response = await fetch(`/api/albums/${album.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setDeleteError(payload.error ?? "Unable to delete album.");
      return;
    }

    setAlbumItems((current) => current.filter((item) => item.id !== album.id));
    setImageItems((current) =>
      current.map((image) =>
        image.albumId === album.id || image.albumIds?.includes(album.id)
          ? {
              ...image,
              albumId: image.albumId === album.id ? undefined : image.albumId,
              albumIds: (image.albumIds ?? []).filter((id) => id !== album.id),
            }
          : image,
      ),
    );
    setAlbumToDelete(null);
  }

  async function renameAlbum() {
    if (!albumToRename) {
      return;
    }
    const name = renameAlbumName.trim();
    if (!name) {
      setRenameError("Album name is required.");
      return;
    }
    setRenameError(null);
    const response = await fetch(`/api/albums/${albumToRename.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setRenameError(payload.error ?? "Unable to rename album.");
      return;
    }
    const payload = (await response.json()) as { album: AlbumInfo };
    setAlbumItems((current) =>
      current
        .map((item) => (item.id === payload.album.id ? payload.album : item))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setAlbumToRename(null);
    setRenameAlbumName("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 flex w-full flex-wrap items-center gap-2 sm:order-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setTab("albums")}
            className={`flex-1 rounded px-3 py-1 sm:flex-none ${
              activeTab === "albums"
                ? "bg-black text-white"
                : "border border-neutral-200"
            }`}
          >
            albums
          </button>
          <button
            type="button"
            onClick={() => setTab("files")}
            className={`flex-1 rounded px-3 py-1 sm:flex-none ${
              activeTab === "files"
                ? "bg-black text-white"
                : "border border-neutral-200"
            }`}
          >
            files
          </button>
          {activeTab === "files" ? (
            <>
              <button
                type="button"
                onClick={() => setHideAlbumImages((current) => !current)}
                className="flex-1 flex rounded border border-neutral-200 px-3 py-1 sm:flex-none items-center justify-center gap-1"
              >
                {hideAlbumImages ? <LightFolderTimes className="h-4 w-4" fill="currentColor" /> : <LightFolderOpen className="h-4 w-4" fill="currentColor" />}
                <span className="hidden lg:inline">{hideAlbumImages ? "show album files" : "hide album files"}</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateNoteRequestId((current) => current + 1)}
                disabled={isCreatingNote}
                className="flex-1 flex rounded border border-neutral-200 px-3 py-1 disabled:opacity-50 sm:flex-none items-center justify-center gap-1"
              >
                <LightFilePlus className="h-4 w-4" fill="currentColor" />
                <span className="hidden md:inline">{isCreatingNote ? "Creating..." : "new note"}</span>
              </button>
            </>
          ) : null}
          {activeTab === "albums" ? (
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setIsCreateOpen(true);
              }}
              className="flex-1 flex rounded border border-neutral-200 px-3 py-1 sm:flex-none items-center justify-center gap-1"
            >
              <LightFilePlus className="h-4 w-4" fill="currentColor" />
              <span className="">new note</span>
            </button>
          ) : null}
        </div>
        {actions ? (
          <div className="order-1 flex w-full items-center gap-2 sm:order-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {activeTab === "files" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(
            ["all", "image", "video", "document", "other", "note"] as const
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFileTypeFilter(item)}
              className={`flex-1 rounded px-3 py-1 sm:flex-none ${
                fileTypeFilter === item
                  ? "bg-black text-white"
                  : "border border-neutral-200"
              }`}
            >
              {item === "image"
                ? "images"
                : item === "document"
                  ? "documents"
                  : item === "note"
                    ? "notes"
                    : item}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "albums" ? (
        <div className="space-y-4">
          {albumPreviews.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-neutral-500">
              no albums yet. make one to get started.
            </div>
          ) : (
            <div className="grid justify-center gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,320px))]">
              {albumPreviews.map((album) => (
                <div key={album.id} className="relative">
                  <Link
                    href={`/album/${album.id}`}
                    className="block rounded-md border border-neutral-200 p-3"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {album.previews.length > 0 ? (
                        album.previews.map((preview, index) =>
                          preview.type === "thumbnail" ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={preview.id}
                              src={`/media/${preview.kind}/${preview.id}/${preview.baseName}-sm.${preview.ext}`}
                              alt="album preview"
                              className={albumPreviewTileClass(index)}
                            />
                          ) : (
                            <div
                              key={preview.id}
                              className={`${albumPreviewTileClass(index)} flex items-center justify-center bg-neutral-50 text-neutral-500`}
                            >
                              {(() => {
                                const Icon = getFileIconForExtension(
                                  preview.ext,
                                );
                                return (
                                  <Icon
                                    className="h-8 w-8"
                                    fill="currentColor"
                                  />
                                );
                              })()}
                            </div>
                          ),
                        )
                      ) : (
                        <div className="col-span-3 flex h-20 items-center justify-center rounded border border-dashed text-xs text-neutral-400">
                          no files yet. add some to get started.
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-sm font-medium">{album.name}</div>
                    <div className="text-xs text-neutral-500">
                      {album.fileCount} file{album.fileCount === 1 ? "" : "s"}{" "}
                      in album
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setRenameError(null);
                      setAlbumToRename({ id: album.id, name: album.name });
                      setRenameAlbumName(album.name);
                    }}
                    className="tile-control absolute right-10 top-2 rounded p-1 text-[11px]"
                    aria-label="rename album"
                    title="rename album"
                  >
                    <LightPencil className="h-4 w-4" fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setAlbumToDelete({ id: album.id, name: album.name });
                    }}
                    className="tile-control absolute right-2 top-2 rounded p-1"
                    aria-label="delete album"
                    title="rm -rf this album"
                  >
                    <LightTrashAlt className="h-4 w-4" fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isCreateOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-md bg-white p-6 text-sm">
                <h3 className="text-lg font-semibold">new album</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  give the album a nice name. like geoff
                </p>
                <input
                  className="mt-4 w-full rounded border px-3 py-2"
                  placeholder="album name"
                  value={newAlbumName}
                  onChange={(event) => setNewAlbumName(event.target.value)}
                />
                {createError ? (
                  <p className="mt-2 text-xs text-red-600">{createError}</p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded border border-neutral-200 px-3 py-1 text-xs"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void createAlbum()}
                    className="rounded bg-black px-3 py-1 text-xs text-white"
                  >
                    mk new album
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {albumToDelete ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-md bg-white p-6 text-sm">
                <h3 className="text-lg font-semibold">delete album?</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  this deletes the album only. imgs will stay in ur library.
                  0.5% chance of nuclear winter.
                </p>
                {deleteError ? (
                  <p className="mt-2 text-xs text-red-600">{deleteError}</p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAlbumToDelete(null)}
                    className="rounded border border-neutral-200 px-3 py-1 text-xs"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAlbum(albumToDelete)}
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white"
                    onMouseEnter={() => setDelBtnLabel("del entire acct (jk)")}
                    onMouseLeave={() => setDelBtnLabel("del album")}
                  >
                    {delBtnLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {albumToRename ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-md rounded-md bg-white p-6 text-sm">
                <h3 className="text-lg font-semibold">rename album</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  give this album a fresh new label.
                </p>
                <input
                  className="mt-4 w-full rounded border px-3 py-2"
                  placeholder="album name"
                  value={renameAlbumName}
                  onChange={(event) => setRenameAlbumName(event.target.value)}
                />
                {renameError ? (
                  <p className="mt-2 text-xs text-red-600">{renameError}</p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAlbumToRename(null)}
                    className="rounded border border-neutral-200 px-3 py-1 text-xs"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void renameAlbum()}
                    className="rounded bg-black px-3 py-1 text-xs text-white"
                  >
                    save
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <GalleryClient
          media={imageItems}
          onImagesChange={setImageItems}
          createNoteRequestId={createNoteRequestId}
          onCreateNoteStateChange={setIsCreatingNote}
          showAlbumImageToggle={false}
          showCreateNoteButton={false}
          hideImagesInAlbums={hideAlbumImages}
          kindFilter={fileTypeFilter}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
