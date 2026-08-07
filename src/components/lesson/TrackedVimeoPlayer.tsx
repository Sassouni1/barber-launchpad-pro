import Player from "@vimeo/player";
import React, { useEffect, useMemo, useRef } from "react";

export type VimeoWatchProgress = {
  position: number;
  duration: number;
  watchedSeconds: number[];
  watchedPercent: number;
  completed: boolean;
  flush?: boolean;
};

export type VimeoWatchResumeState = {
  position: number;
  duration: number;
  watchedSeconds: number[];
  completed: boolean;
  savedAt?: number | string | null;
};

type VimeoWatchState = VimeoWatchResumeState;

type TrackedVimeoPlayerProps = {
  src: string;
  title: string;
  storageKey: string;
  onComplete?: () => void;
  onProgress?: (progress: VimeoWatchProgress) => void;
  loadProgress?: () => Promise<VimeoWatchResumeState | null>;
  className?: string;
};

const EMPTY_STATE: VimeoWatchState = {
  position: 0,
  duration: 0,
  watchedSeconds: [],
  completed: false,
  savedAt: 0,
};

const readState = (storageKey: string): VimeoWatchResumeState => {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<VimeoWatchState>;
    return {
      position: Number(parsed.position) || 0,
      duration: Number(parsed.duration) || 0,
      watchedSeconds: Array.isArray(parsed.watchedSeconds)
        ? parsed.watchedSeconds.filter(
            (value): value is number => Number.isInteger(value) && value >= 0,
          )
        : [],
      completed: parsed.completed === true,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return EMPTY_STATE;
  }
};

/**
 * Vimeo playback tracker used for internal watch analytics and resume.
 * It only credits contiguous playback updates; a seek, paused tab, or hidden
 * page never becomes watched time. Resume always uses the latest saved position.
 */
export const TrackedVimeoPlayer = React.memo(
  ({
    src,
    title,
    storageKey,
    onComplete,
    onProgress,
    loadProgress,
    className = "absolute inset-0 h-full w-full",
  }: TrackedVimeoPlayerProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    // Re-read when the lesson key changes so a reused route component never
    // carries the previous lesson's checkpoint into the next video.
    const savedState = useMemo(() => readState(storageKey), [storageKey]);
    const watchedSecondsRef = useRef(new Set(savedState.watchedSeconds));
    const positionRef = useRef(savedState.position);
    const durationRef = useRef(savedState.duration);
    const lastTimeRef = useRef<number | null>(null);
    const playingRef = useRef(false);
    // Resume target applied on first play only. Seeking while the video is
    // still idle forces Vimeo to load a frame and destroys the poster image,
    // which is why previously-watched lessons rendered as a black box.
    const pendingSeekRef = useRef<number | null>(null);
    const completedRef = useRef(savedState.completed);
    const onCompleteRef = useRef(onComplete);
    const onProgressRef = useRef(onProgress);

    useEffect(() => {
      onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
      onProgressRef.current = onProgress;
    }, [onProgress]);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const emitProgress = (flush = false) => {
        const duration = durationRef.current;
        const watchedSeconds = Array.from(watchedSecondsRef.current);
        onProgressRef.current?.({
          position: positionRef.current,
          duration,
          watchedSeconds,
          watchedPercent:
            duration > 0
              ? Math.min(100, Math.round((watchedSeconds.length / duration) * 100))
              : 0,
          completed: completedRef.current,
          flush,
        });
      };

      const persist = (flush = false) => {
        const savedAt = Date.now();
        try {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              position: positionRef.current,
              duration: durationRef.current,
              watchedSeconds: Array.from(watchedSecondsRef.current),
              completed: completedRef.current,
              savedAt,
            } satisfies VimeoWatchState),
          );
        } catch {
          // The current session still tracks in memory if storage is unavailable.
        }
        emitProgress(flush);
      };

      const player = new Player(iframe);
      const handlePlay = () => {
        if (!completedRef.current) playingRef.current = true;
        const pending = pendingSeekRef.current;
        pendingSeekRef.current = null;
        if (pending !== null && pending > 2) {
          void player
            .setCurrentTime(pending)
            .then(() => {
              positionRef.current = pending;
              lastTimeRef.current = pending;
            })
            .catch(() => undefined);
        }
      };
      const handlePause = () => {
        playingRef.current = false;
        persist(true);
      };
      const handleSeeked = () => {
        void player
          .getCurrentTime()
          .then((seconds) => {
            if (Number.isFinite(seconds)) {
              positionRef.current = seconds;
              lastTimeRef.current = seconds;
              persist(true);
            }
          })
          .catch(() => undefined);
      };
      const handleTimeUpdate = ({
        seconds,
        duration,
      }: {
        seconds: number;
        duration: number;
      }) => {
        if (!Number.isFinite(seconds)) return;
        if (Number.isFinite(duration) && duration > 0) {
          durationRef.current = duration;
        }

        const previous = lastTimeRef.current;
        if (playingRef.current && previous !== null) {
          const delta = seconds - previous;
          // Normal playback advances about one second per update. A larger
          // delta is a seek or stalled tab and is intentionally not credited.
          if (delta >= 0 && delta <= 2.5) {
            for (
              let second = Math.floor(previous);
              second <= Math.floor(seconds);
              second += 1
            ) {
              watchedSecondsRef.current.add(second);
            }
          }
        }

        positionRef.current = seconds;
        lastTimeRef.current = seconds;
        persist();

        const requiredSeconds = Math.ceil(durationRef.current * 0.9);
        if (
          !completedRef.current &&
          requiredSeconds > 0 &&
          watchedSecondsRef.current.size >= requiredSeconds
        ) {
          completedRef.current = true;
          persist(true);
          onCompleteRef.current?.();
        }
      };
      const handleEnded = () => {
        playingRef.current = false;
        persist(true);
      };

      player.on("play", handlePlay);
      player.on("pause", handlePause);
      player.on("seeked", handleSeeked);
      player.on("timeupdate", handleTimeUpdate);
      player.on("ended", handleEnded);

      player
        .ready()
        .then(async () => {
          let initialState = savedState;
          if (loadProgress) {
            const remoteState = await loadProgress().catch(() => null);
            if (remoteState) {
              const localSavedAt = Number(savedState.savedAt) || 0;
              const remoteSavedAt =
                typeof remoteState.savedAt === "string"
                  ? Date.parse(remoteState.savedAt) || 0
                  : Number(remoteState.savedAt) || 0;
              const latestPosition =
                remoteSavedAt > localSavedAt ? remoteState : savedState;
              initialState = {
                position: Number(latestPosition.position) || 0,
                duration: Math.max(
                  Number(savedState.duration) || 0,
                  Number(remoteState.duration) || 0,
                ),
                watchedSeconds: Array.from(
                  new Set([
                    ...savedState.watchedSeconds,
                    ...(remoteState.watchedSeconds || []),
                  ]),
                ),
                completed: savedState.completed || remoteState.completed,
                savedAt: Math.max(localSavedAt, remoteSavedAt),
              };
              watchedSecondsRef.current = new Set(initialState.watchedSeconds);
              positionRef.current = initialState.position;
              durationRef.current = initialState.duration;
              completedRef.current = initialState.completed;
            }
          }
          const duration = await player.getDuration();
          if (Number.isFinite(duration) && duration > 0) {
            durationRef.current = duration;
          }
          if (initialState.position > 2 && !initialState.completed) {
            await player.setCurrentTime(initialState.position);
            lastTimeRef.current = initialState.position;
          } else {
            lastTimeRef.current = 0;
          }
          persist();
        })
        .catch(() => undefined);

      const handlePageHide = () => {
        playingRef.current = false;
        persist(true);
      };
      window.addEventListener("pagehide", handlePageHide);

      return () => {
        handlePageHide();
        window.removeEventListener("pagehide", handlePageHide);
        player.off("play", handlePlay);
        player.off("pause", handlePause);
        player.off("seeked", handleSeeked);
        player.off("timeupdate", handleTimeUpdate);
        player.off("ended", handleEnded);
        player.destroy().catch(() => undefined);
      };
    }, [loadProgress, savedState.completed, savedState.position, src, storageKey]);

    return (
      <iframe
        ref={iframeRef}
        src={src}
        className={className}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title}
      />
    );
  },
);

TrackedVimeoPlayer.displayName = "TrackedVimeoPlayer";
