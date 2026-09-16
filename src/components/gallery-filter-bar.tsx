"use client";

import { useEffect, useRef } from "react";
import { TermButton } from "@/components/ui/term-button";
import { TermSelect } from "@/components/ui/term-select";
import {
  GALLERY_FILE_TYPE_OPTIONS,
  GALLERY_SHARE_FILTERS,
  GALLERY_SORT_OPTIONS,
  type GalleryFileTypeFilter,
  type GalleryShareFilter,
  type GallerySortKey,
} from "@/lib/gallery-file-filters";

type GalleryFilterBarProps = {
  typeFilter: GalleryFileTypeFilter;
  shareFilter: GalleryShareFilter;
  sort: GallerySortKey;
  filteredCount: number;
  showHideAlbumFiles?: boolean;
  hideAlbumFiles?: boolean;
  showSort?: boolean;
  onTypeFilter: (value: GalleryFileTypeFilter) => void;
  onShareFilter: (value: GalleryShareFilter) => void;
  onSort: (value: GallerySortKey) => void;
  onToggleHideAlbumFiles?: () => void;
};

export const GalleryFilterBar = ({
  typeFilter,
  shareFilter,
  sort,
  filteredCount,
  showHideAlbumFiles = false,
  hideAlbumFiles = false,
  showSort = true,
  onTypeFilter,
  onShareFilter,
  onSort,
  onToggleHideAlbumFiles,
}: GalleryFilterBarProps) => {
  const typeLabel =
    GALLERY_FILE_TYPE_OPTIONS.find((option) => option.value === typeFilter)
      ?.label ?? typeFilter;
  const sortLabel =
    GALLERY_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) {
      return;
    }
    const media = window.matchMedia("(min-width: 721px)");
    const revealOnDesktop = () => {
      if (media.matches) {
        details.open = true;
      }
    };
    revealOnDesktop();
    media.addEventListener("change", revealOnDesktop);
    return () => media.removeEventListener("change", revealOnDesktop);
  }, []);

  return (
    <details
      ref={detailsRef}
      className="gallery-filter-bar"
    >
      <summary className="gallery-filter-summary">
        <span className="gallery-filter-label">FILTER</span>
        <span className="gallery-filter-summary-values">
          {typeLabel}
          <span aria-hidden="true"> · </span>
          {shareFilter}
          {showSort ? (
            <>
              <span aria-hidden="true"> · </span>
              {sortLabel}
            </>
          ) : null}
        </span>
        <span className="gallery-filter-count">
          {filteredCount} file{filteredCount === 1 ? "" : "s"}
        </span>
        <span className="gallery-filter-chevron" aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className="gallery-filter-body">
        <div className="gallery-filter-group">
          <span className="gallery-filter-label">FILTER</span>
          <div className="gallery-filter-chips">
            {GALLERY_FILE_TYPE_OPTIONS.map((option) => (
              <TermButton
                key={option.value}
                active={typeFilter === option.value}
                onClick={() => onTypeFilter(option.value)}
              >
                {option.label}
              </TermButton>
            ))}
          </div>
        </div>

        <div className="gallery-filter-group">
          <span className="gallery-filter-label">SHARED</span>
          <div className="gallery-filter-chips">
            {GALLERY_SHARE_FILTERS.map((option) => (
              <TermButton
                key={option}
                active={shareFilter === option}
                onClick={() => onShareFilter(option)}
              >
                {option}
              </TermButton>
            ))}
          </div>
        </div>

        <div className="gallery-filter-meta">
          {showSort ? (
            <div className="gallery-filter-group gallery-filter-sort-group">
              <span className="gallery-filter-label">SORT</span>
              <TermSelect
                className="gallery-filter-sort"
                value={sort}
                onChange={(event) =>
                  onSort(event.target.value as GallerySortKey)
                }
                aria-label="sort files"
              >
                {GALLERY_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TermSelect>
            </div>
          ) : null}

          <span className="gallery-filter-count">
            {filteredCount} file{filteredCount === 1 ? "" : "s"}
          </span>

          {showHideAlbumFiles ? (
            <TermButton
              active={hideAlbumFiles}
              onClick={onToggleHideAlbumFiles}
            >
              {hideAlbumFiles ? "show album files" : "hide album files"}
            </TermButton>
          ) : null}
        </div>
      </div>
    </details>
  );
};
