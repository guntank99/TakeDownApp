"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import type { EmbedAspect } from "@/lib/embed/parse";

interface EmbedPlayerProps {
  /** Official embed URL, built server-side by lib/embed/parse.ts. */
  embedUrl: string;
  aspect: EmbedAspect;
  title: string;
  platformLabel: string;
  canonicalUrl: string;
  thumbnailUrl?: string | null;
  isVideo: boolean;
}

const FRAME: Record<EmbedAspect, string> = {
  "16:9": "aspect-video w-full",
  "9:16": "mx-auto aspect-[9/16] max-h-[620px] w-full max-w-[340px]",
  tall: "mx-auto h-[560px] w-full max-w-[540px]",
};

/**
 * Click-to-load viewer for a post/video using the platform's OFFICIAL embed.
 *
 * Nothing from the platform is loaded until the user clicks: no trackers or
 * cookies just from opening a page full of videos (a privacy and performance
 * choice). The iframe is sandboxed and only gets the permissions a player needs.
 */
export function EmbedPlayer({ embedUrl, aspect, title, platformLabel, canonicalUrl, thumbnailUrl, isVideo }: EmbedPlayerProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="space-y-2">
      <div className={`${FRAME[aspect]} overflow-hidden rounded-lg border border-slate-800 bg-slate-950`}>
        {loaded ? (
          <iframe
            src={embedUrl}
            title={`${platformLabel}: ${title}`}
            className="size-full border-0"
            loading="lazy"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            aria-label={`${isVideo ? "Putar" : "Tampilkan"} dari ${platformLabel}: ${title}`}
            className="group relative flex size-full items-center justify-center overflow-hidden text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- third-party thumbnail; next/image would proxy it through our server
              <img src={thumbnailUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 size-full object-cover opacity-60 transition-opacity group-hover:opacity-80" />
            ) : null}
            <span className="relative flex flex-col items-center gap-2 px-4 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-sky-500 text-slate-950 shadow-lg transition-transform group-hover:scale-105">
                <Play className="size-6 translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">{isVideo ? "Putar video" : "Tampilkan postingan"}</span>
              <span className="text-xs text-slate-300">Memuat pemutar resmi {platformLabel}</span>
            </span>
          </button>
        )}
      </div>
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
      >
        <ExternalLink className="size-3" aria-hidden="true" /> Buka di {platformLabel}
      </a>
    </div>
  );
}
