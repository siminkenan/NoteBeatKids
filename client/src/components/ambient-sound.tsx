import { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";

// ── Module-level singleton ────────────────────────────────────────────────────
// Lives outside React — survives page navigation without restarting.
let _audio: HTMLAudioElement | null = null;
let _interactionHooked = false;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio("/sounds/ambient.mp3");
    _audio.loop   = true;
    _audio.volume = parseFloat(localStorage.getItem("ambientVolume") ?? "0.22");
    _audio.muted  = localStorage.getItem("ambientMuted") === "true";
  }
  return _audio;
}

function tryPlay() {
  const a = getAudio();
  if (!a.paused) return;
  a.play().catch(() => {/* autoplay blocked — retried on first interaction */});
}

// Starts playback on first user gesture (handles browser autoplay policy)
function hookFirstInteraction() {
  if (_interactionHooked) return;
  _interactionHooked = true;
  const resume = () => tryPlay();
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown",     resume, { once: true });
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props { active: boolean; }

export default function AmbientSound({ active }: Props) {
  const audio = getAudio();
  const [muted,  setMuted]  = useState(audio.muted);
  const [volume, setVolume] = useState(audio.volume);
  const [open,   setOpen]   = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Play or pause based on which page we're on
  useEffect(() => {
    if (active) {
      tryPlay();
      hookFirstInteraction();
    } else {
      // Pause when leaving active pages (admin, metronome, etc.)
      audio.pause();
    }
  }, [active]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggleMute() {
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
    localStorage.setItem("ambientMuted", String(next));
    if (!next) tryPlay();
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    audio.volume = v;
    setVolume(v);
    localStorage.setItem("ambientVolume", String(v));
    if (v > 0 && audio.muted) {
      audio.muted = false;
      setMuted(false);
      localStorage.setItem("ambientMuted", "false");
    }
  }

  // Hide the floating panel on non-ambient pages (admin, metronome, etc.)
  if (!active) return null;

  return (
    <div
      ref={panelRef}
      className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2 select-none"
    >
      {/* Expanded volume panel */}
      {open && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{
            background: "rgba(15, 15, 30, 0.88)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
            minWidth: 180,
          }}
        >
          {/* Mute / unmute icon */}
          <button
            onClick={toggleMute}
            className="text-white/70 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            title={muted ? "Sesi aç" : "Sesi kapat"}
            data-testid="button-ambient-mute"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            data-testid="slider-ambient-volume"
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              accentColor: "#a78bfa",
              background: `linear-gradient(to right, #a78bfa ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.15) ${(muted ? 0 : volume) * 100}%)`,
            }}
          />

          {/* Percent label */}
          <span className="text-white/50 text-xs font-mono w-8 text-right flex-shrink-0">
            {muted ? "0" : Math.round(volume * 100)}%
          </span>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ortam sesi"
        data-testid="button-ambient-toggle"
        className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer"
        style={{
          background: open
            ? "rgba(167, 139, 250, 0.9)"
            : "rgba(15, 15, 30, 0.78)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: muted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)",
        }}
      >
        {muted ? (
          <VolumeX size={16} />
        ) : (
          /* Animated wave bars when sound is on */
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
      </button>

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes ambientBar {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to   { transform: scaleY(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
