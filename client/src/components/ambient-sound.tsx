import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";

// ── Module-level singleton ────────────────────────────────────────────────────
let _audio: HTMLAudioElement | null = null;
let _interactionHooked = false;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio("/sounds/ambient.mp3");
    _audio.loop   = true;
    _audio.volume = 1.0; // Full software volume — device hardware buttons control level
    _audio.muted  = localStorage.getItem("ambientMuted") === "true";
  }
  return _audio;
}

function tryPlay() {
  const a = getAudio();
  if (!a.paused) return;
  a.play().catch(() => {/* autoplay blocked — retried on first interaction */});
}

// Register with device media session so hardware volume buttons control this audio
function registerMediaSession() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: "NoteBeat Kids",
    artist: "Ortam Müziği",
    album: "NoteBeat Kids",
  });
}

// Hook first user gesture globally — called immediately at module load
function hookFirstInteraction() {
  if (_interactionHooked) return;
  _interactionHooked = true;

  const resume = () => {
    tryPlay();
    registerMediaSession();
  };

  // Listen for ANY gesture anywhere on the page
  document.addEventListener("pointerdown", resume, { once: true });
  document.addEventListener("click",       resume, { once: true });
  document.addEventListener("keydown",     resume, { once: true });
  document.addEventListener("touchstart",  resume, { once: true, passive: true });
}

// Start hooking immediately when this module is first imported
hookFirstInteraction();

// ── Component ────────────────────────────────────────────────────────────────
interface Props { active: boolean; }

export default function AmbientSound({ active }: Props) {
  const audio = getAudio();
  const [muted, setMuted] = useState(audio.muted);

  // Play or pause based on which page we're on
  useEffect(() => {
    if (active) {
      tryPlay();
      registerMediaSession();
    } else {
      audio.pause();
    }
  }, [active]);

  function toggleMute() {
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
    localStorage.setItem("ambientMuted", String(next));
    if (!next) tryPlay();
  }

  if (!active) return null;

  return (
    <button
      onClick={toggleMute}
      title={muted ? "Sesi aç" : "Sesi kapat"}
      data-testid="button-ambient-toggle"
      className="fixed bottom-5 right-5 z-[9999] w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer select-none"
      style={{
        background: "rgba(15, 15, 30, 0.78)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: muted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)",
      }}
    >
      {muted ? (
        <VolumeX size={16} />
      ) : (
        <span className="flex items-end gap-[2.5px] h-4">
          {[1, 1.6, 1, 1.4, 0.8].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full"
              style={{
                height: `${h * 10}px`,
                background: "rgba(255,255,255,0.8)",
                animation: `ambientBar ${0.8 + i * 0.12}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </span>
      )}
      <style>{`
        @keyframes ambientBar {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to   { transform: scaleY(1);   opacity: 1;   }
        }
      `}</style>
    </button>
  );
}
