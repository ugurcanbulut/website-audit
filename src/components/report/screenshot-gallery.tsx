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
      secondaryZoomLevel: 1,
      maxZoomLevel: 4,
      padding: { top: 20, bottom: 20, left: 20, right: 20 },
      bgOpacity: 0.92,
    });

    // Dynamically resolve image dimensions for full-page screenshots
    lightbox.addFilter("itemData", (itemData) => {
      if (itemData.element) {
        const el = itemData.element as HTMLElement;
        const img = el.querySelector("img");
        if (img && img.naturalWidth && img.naturalHeight) {
          itemData.width = img.naturalWidth;
          itemData.height = img.naturalHeight;
        }
      }
      return itemData;
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
}

export function ScreenshotThumbnail({ src, alt, className }: ScreenshotThumbnailProps) {
  return (
    <a
      href={src}
      data-pswp-src={src}
      data-pswp-width="1"
      data-pswp-height="1"
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
