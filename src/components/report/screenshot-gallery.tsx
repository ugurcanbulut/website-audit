"use client";

import { useRef, useEffect } from "react";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

interface ScreenshotGalleryProps {
  galleryId: string;
  children: React.ReactNode;
}

export function ScreenshotGallery({ galleryId, children }: ScreenshotGalleryProps) {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      gallery: `#${galleryId}`,
      children: "a[data-pswp-src]",
      pswpModule: () => import("photoswipe"),
      wheelToZoom: true,
      initialZoomLevel: "fit",
      secondaryZoomLevel: 1.5,
      maxZoomLevel: 4,
      padding: { top: 20, bottom: 20, left: 20, right: 20 },
      bgOpacity: 0.92,
    });

    // Resolve actual image dimensions before opening
    lightbox.addFilter("numItems", (numItems) => numItems);
    lightbox.addFilter("itemData", (itemData, index) => {
      const el = itemData.element as HTMLAnchorElement | undefined;
      if (el) {
        const img = el.querySelector("img");
        if (img) {
          // Use naturalWidth/Height if already loaded
          if (img.naturalWidth > 1 && img.naturalHeight > 1) {
            itemData.width = img.naturalWidth;
            itemData.height = img.naturalHeight;
          } else {
            // Fallback: use a reasonable default that PhotoSwipe will update
            // once the full image loads in the lightbox
            itemData.width = parseInt(el.dataset.pswpWidth || "1920", 10);
            itemData.height = parseInt(el.dataset.pswpHeight || "4000", 10);
          }
        }
        itemData.src = el.dataset.pswpSrc || el.href;
      }
      return itemData;
    });

    // When lightbox image loads, update dimensions to actual size
    lightbox.on("contentLoad", (e) => {
      const content = e.content;
      if (content.type === "image" && content.element) {
        const img = content.element as HTMLImageElement;
        img.onload = () => {
          if (img.naturalWidth > 1 && img.naturalHeight > 1) {
            content.width = img.naturalWidth;
            content.height = img.naturalHeight;
            content.slide?.updateContentSize?.(true);
          }
        };
      }
    });

    lightbox.init();
    lightboxRef.current = lightbox;

    return () => {
      lightbox.destroy();
      lightboxRef.current = null;
    };
  }, [galleryId]);

  return (
    <div id={galleryId}>
      {children}
    </div>
  );
}

interface ScreenshotThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  /** Estimated width for PhotoSwipe (actual dimensions resolved on load) */
  estimatedWidth?: number;
  /** Estimated height for PhotoSwipe */
  estimatedHeight?: number;
}

export function ScreenshotThumbnail({
  src,
  alt,
  className,
  estimatedWidth = 1920,
  estimatedHeight = 4000,
}: ScreenshotThumbnailProps) {
  return (
    <a
      href={src}
      data-pswp-src={src}
      data-pswp-width={estimatedWidth}
      data-pswp-height={estimatedHeight}
      target="_blank"
      rel="noreferrer"
      className="block cursor-zoom-in"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
      />
    </a>
  );
}
