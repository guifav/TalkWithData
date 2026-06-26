"use client";

import { useCallback, useRef } from "react";

/**
 * Thumbnail image with one automatic retry.
 *
 * The thumbnail API route requires the twd_auth cookie, which is set
 * asynchronously after Firebase auth initializes. On cold loads the first
 * request may race the cookie and get a 401. This component retries once
 * after 2 seconds to cover that window.
 */
export function ThumbnailImage({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const retriedRef = useRef(false);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.target as HTMLImageElement;

      if (!retriedRef.current) {
        // First failure: retry after 2s (cookie may not be set yet)
        retriedRef.current = true;
        setTimeout(() => {
          img.style.display = "";
          img.src = `${src}&_retry=1`;
        }, 2000);
      }
      // Hide while waiting or after final failure
      img.style.display = "none";
    },
    [src]
  );

  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={handleError}
    />
  );
}
