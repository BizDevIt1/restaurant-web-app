"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";
import { DEMO_SLIDES } from "./demo-slides";

const STORY_DURATION = 5000; // 5 seconds display timer per video

export default function Demo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reelMediaRef = useRef<HTMLDivElement>(null);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

  // Track active video slot: true = video1 is active, false = video2 is active
  const activeSlotRef = useRef<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gsapCtxRef = useRef<gsap.Context | null>(null);

  // Sync current time and duration
  useEffect(() => {
    const updateTime = () => {
      const isV1Active = activeSlotRef.current;
      const activeVideo = isV1Active ? video1Ref.current : video2Ref.current;
      if (activeVideo) {
        setCurrentTime(activeVideo.currentTime || 0);
        if (activeVideo.duration && !isNaN(activeVideo.duration)) {
          setDuration(activeVideo.duration);
        }
      }
    };

    const interval = setInterval(updateTime, 250);
    return () => clearInterval(interval);
  }, []);

  // Track Fullscreen state changes (enter & exit)
  useEffect(() => {
    const handleFSChange = () => {
      const isFS =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement ||
        !!(document as any).mozFullScreenElement ||
        !!(document as any).msFullscreenElement;

      setIsFullscreen(isFS);

      if (!isFS) {
        if (video1Ref.current) video1Ref.current.muted = true;
        if (video2Ref.current) video2Ref.current.muted = true;
        setIsMuted(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFSChange);
    document.addEventListener("webkitfullscreenchange", handleFSChange);
    document.addEventListener("mozfullscreenchange", handleFSChange);
    document.addEventListener("MSFullscreenChange", handleFSChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFSChange);
      document.removeEventListener("webkitfullscreenchange", handleFSChange);
      document.removeEventListener("mozfullscreenchange", handleFSChange);
      document.removeEventListener("MSFullscreenChange", handleFSChange);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !video1Ref.current || !video2Ref.current) return;

    const ctx = gsap.context(() => {
      const v1 = video1Ref.current!;
      const v2 = video2Ref.current!;

      // Initial video setups
      v1.src = DEMO_SLIDES[0].videoSrc;
      if (DEMO_SLIDES[0].posterSrc) v1.poster = DEMO_SLIDES[0].posterSrc;
      v1.muted = true;
      v1.loop = true;
      v1.playsInline = true;
      v1.autoplay = true;

      gsap.set(v1, { opacity: 1 });
      gsap.set(v2, { opacity: 0 });

      v1.play().catch(() => {});

      // Start initial 5s slide timer
      startSlideTimer();
    }, containerRef);

    gsapCtxRef.current = ctx;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ctx.revert();
      if (video1Ref.current) {
        video1Ref.current.pause();
        video1Ref.current.src = "";
      }
      if (video2Ref.current) {
        video2Ref.current.pause();
        video2Ref.current.src = "";
      }
    };
  }, []);

  const startSlideTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const nextIdx = (currentIndexRef.current + 1) % DEMO_SLIDES.length;
      changeSlide(nextIdx);
    }, STORY_DURATION);
  };

  const changeSlide = (nextIndex: number) => {
    if (!gsapCtxRef.current || !video1Ref.current || !video2Ref.current) return;

    const isV1Active = activeSlotRef.current;
    const currentVideo = isV1Active ? video1Ref.current : video2Ref.current;
    const nextVideo = isV1Active ? video2Ref.current : video1Ref.current;
    const nextSlide = DEMO_SLIDES[nextIndex];

    nextVideo.src = nextSlide.videoSrc;
    if (nextSlide.posterSrc) nextVideo.poster = nextSlide.posterSrc;
    nextVideo.muted = isMuted;
    nextVideo.loop = true;
    nextVideo.playsInline = true;
    nextVideo.load();
    nextVideo.play().catch(() => {});
    setIsPlaying(true);

    const ctx = gsapCtxRef.current;
    ctx.add(() => {
      // 0.6s plain opacity crossfade simultaneously on both videos
      gsap.to(currentVideo, { opacity: 0, duration: 0.6, ease: "power1.inOut" });
      gsap.to(nextVideo, { opacity: 1, duration: 0.6, ease: "power1.inOut" });

      // Slide and fade caption smoothly at the same moment
      if (captionRef.current) {
        gsap.to(captionRef.current, {
          opacity: 0,
          y: -8,
          duration: 0.25,
          ease: "power1.in",
          onComplete: () => {
            setCurrentIndex(nextIndex);
            if (captionRef.current) {
              gsap.set(captionRef.current, { opacity: 0, y: 12 });
              gsap.to(captionRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.4,
                ease: "power2.out",
              });
            }
          },
        });
      } else {
        setCurrentIndex(nextIndex);
      }
    });

    // Swap active video slot role for next transition call
    activeSlotRef.current = !isV1Active;

    // Reset 5s display timer
    startSlideTimer();
  };

  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + DEMO_SLIDES.length) % DEMO_SLIDES.length;
    changeSlide(prevIdx);
  };

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % DEMO_SLIDES.length;
    changeSlide(nextIdx);
  };

  const handleIndexClick = (index: number) => {
    if (index === currentIndex) return;
    changeSlide(index);
  };

  const togglePlayPause = () => {
    const isV1Active = activeSlotRef.current;
    const activeVideo = isV1Active ? video1Ref.current : video2Ref.current;
    if (!activeVideo) return;

    if (activeVideo.paused) {
      activeVideo.play().catch(() => {});
      setIsPlaying(true);
    } else {
      activeVideo.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const isV1Active = activeSlotRef.current;
    const activeVideo = isV1Active ? video1Ref.current : video2Ref.current;
    if (!activeVideo) return;

    activeVideo.muted = !activeVideo.muted;
    setIsMuted(activeVideo.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const isV1Active = activeSlotRef.current;
    const activeVideo = isV1Active ? video1Ref.current : video2Ref.current;
    if (activeVideo) {
      activeVideo.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Fullscreen toggle on the entire video stage container so custom controls remain visible
  const toggleFullscreen = () => {
    const isFS =
      !!document.fullscreenElement ||
      !!(document as any).webkitFullscreenElement ||
      !!(document as any).mozFullScreenElement ||
      !!(document as any).msFullscreenElement;

    if (isFS) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } else {
      const isV1Active = activeSlotRef.current;
      const activeVideo = isV1Active ? video1Ref.current : video2Ref.current;
      if (activeVideo) {
        activeVideo.muted = false;
        setIsMuted(false);
        activeVideo.play().catch(() => {});
      }

      // Request fullscreen on the stage container so custom controls stay visible
      const targetEl = reelMediaRef.current || activeVideo;
      if (targetEl) {
        if (targetEl.requestFullscreen) {
          targetEl.requestFullscreen().catch(() => {});
        } else if ((targetEl as any).webkitRequestFullscreen) {
          (targetEl as any).webkitRequestFullscreen();
        } else if ((targetEl as any).mozRequestFullScreen) {
          (targetEl as any).mozRequestFullScreen();
        } else if ((targetEl as any).msRequestFullscreen) {
          (targetEl as any).msRequestFullscreen();
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const activeSlide = DEMO_SLIDES[currentIndex];

  return (
    <section id="demo" className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Heading (OUTSIDE the block container) */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            LIVE DEMO
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            See Omnibites in Action
          </h2>
          <p className="text-[var(--text-lo)] text-base leading-relaxed">
            Watch a short walkthrough of POS, kitchen display, inventory, and reporting — then explore real interface previews below.
          </p>
        </div>

        {/* Card Block Container */}
        <div
          ref={containerRef}
          className="demo-reel max-w-5xl mx-auto rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] relative overflow-hidden shadow-2xl"
        >
          {/* Ambient Warm Corner Glow */}
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[var(--gold-dim)] rounded-full blur-3xl opacity-20 pointer-events-none"></div>

          {/* Reel Media Video Stage (Container requests Fullscreen so custom controls remain visible) */}
          <div
            ref={reelMediaRef}
            className="reel-media relative w-full aspect-[2.1/1] min-h-[300px] sm:min-h-[420px] bg-[#0c0808] border-b border-[var(--border)] overflow-hidden select-none group"
          >
            {/* Top Right Fullscreen / Minimize Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="absolute right-4 top-4 z-30 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/85 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer hover:scale-105 focus:outline-none opacity-90 hover:opacity-100 shadow-lg"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Watch Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Watch Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>

            {/* Left Arrow Button */}
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer hover:scale-110 focus:outline-none"
              aria-label="Previous video"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Right Arrow Button */}
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer hover:scale-110 focus:outline-none"
              aria-label="Next video"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Pooled Stacked Video Elements (object-contain ensures 100% video fit) */}
            <video
              ref={video1Ref}
              muted
              loop
              playsInline
              autoPlay
              className="reel-video absolute inset-0 w-full h-full object-contain bg-black transform-gpu pointer-events-none z-10"
            ></video>
            <video
              ref={video2Ref}
              muted
              loop
              playsInline
              autoPlay
              className="reel-video absolute inset-0 w-full h-full object-contain bg-black transform-gpu pointer-events-none z-10"
            ></video>

            {/* Video Controls Bar Overlay (Visible both Inline and Fullscreen) */}
            <div className="absolute bottom-0 left-0 right-0 z-30 p-3.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 opacity-95 hover:opacity-100 transition-opacity">
              {/* Timeline Scrubber Bar */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-white/30 accent-[var(--gold)] rounded-lg cursor-pointer transition-all"
                aria-label="Seek video timeline"
              />

              <div className="flex items-center justify-between text-xs text-white/90">
                <div className="flex items-center gap-3">
                  {/* Play / Pause Button */}
                  <button
                    onClick={togglePlayPause}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white focus:outline-none cursor-pointer"
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 text-[var(--gold)]" />
                    ) : (
                      <Play className="w-4 h-4 text-[var(--gold)]" />
                    )}
                  </button>

                  {/* Mute / Unmute Button */}
                  <button
                    onClick={toggleMute}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white focus:outline-none cursor-pointer"
                    aria-label={isMuted ? "Unmute sound" : "Mute sound"}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-white/70" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[var(--gold)]" />
                    )}
                  </button>

                  {/* Time text */}
                  <span className="font-mono text-[11px] text-white/80">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Fullscreen / Minimize Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="px-2.5 py-1 rounded-lg hover:bg-white/20 text-white flex items-center gap-1.5 focus:outline-none cursor-pointer"
                  aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4 text-[var(--gold)]" />
                      <span className="text-[11px] font-semibold">Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-[var(--gold)]" />
                      <span className="text-[11px] font-semibold">Fullscreen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Styled Caption Bar at Bottom of Card */}
          <div className="reel-caption p-5 sm:p-7 bg-[var(--bg-deep)] relative z-10">
            {/* Accent Gold Divider Line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)]/40 to-transparent pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left Side: Module Counter, Label & Animated Caption */}
              <div ref={captionRef} className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-xs font-mono font-bold text-[var(--gold)] tracking-wider">
                    0{currentIndex + 1} / 0{DEMO_SLIDES.length}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse shadow-[0_0_8px_var(--gold)]"></span>
                  <p className="caption-label font-mono text-sm sm:text-base font-bold uppercase tracking-widest text-[var(--gold)]">
                    {activeSlide.label}
                  </p>
                </div>

                <p className="caption-text text-lg sm:text-[22px] leading-snug text-[var(--text-hi)] font-bold tracking-tight">
                  {activeSlide.caption}
                </p>
              </div>

              {/* Right Side: Sleek Module Switcher Pills */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0 pt-2 md:pt-0">
                {DEMO_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => handleIndexClick(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus:outline-none ${
                      idx === currentIndex
                        ? "bg-[var(--gold)] text-[#241a06] font-bold shadow-md shadow-[var(--gold-glow)] scale-105"
                        : "bg-white/5 hover:bg-white/10 text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-white/5"
                    }`}
                  >
                    {slide.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Demo CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:contact@omnibites.com"
            className="btn-gold px-6 py-3 text-sm flex items-center gap-2"
          >
            <span>Book a Call</span>
          </a>
          <a
            href="https://wa.me/923001234567"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost px-6 py-3 text-sm flex items-center gap-2"
          >
            <span>Chat with our team 💬</span>
          </a>
        </div>
      </div>
    </section>
  );
}
