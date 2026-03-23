import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter } from "vexflow";

export interface NoteData {
  keys: string[];
  duration: string;
  clef?: string;
}

/* ─────────────────────────────────────────────────────────────
   BEAT VALUES & REST FLAGS (same definitions used in rhythm-game)
───────────────────────────────────────────────────────────── */
const BEAT_VALS: Record<string, number> = {
  w: 4, h: 2, q: 1, "8": 0.5,
  wr: 4, hr: 2, qr: 1, "8r": 0.5,
};
const IS_REST_DUR: Record<string, boolean> = {
  wr: true, hr: true, qr: true, "8r": true,
};
const IS_HOLLOW: Record<string, boolean> = { h: true, w: true };

/* radius of the note circle per duration */
function noteRadius(duration: string): number {
  switch (duration) {
    case "8":  case "8r": return 11;
    case "q":  case "qr": return 14;
    case "h":  case "hr": return 16;
    case "w":  case "wr": return 19;
    default: return 14;
  }
}

interface VexFlowRendererProps {
  notes: NoteData[];
  width?: number;
  height?: number;
  showClef?: boolean;        // kept for API compat — clef not shown on rhythm line
  showTimeSignature?: boolean;
  highlightIndex?: number;
  hitIndices?: Set<number>;  // green = correctly tapped
}

/* ─────────────────────────────────────────────────────────────
   RHYTHM LINE RENDERER
   Replaces the 5-line musical staff with a single bold timeline.
   All note timing / logic is unchanged — only visual layer.
───────────────────────────────────────────────────────────── */
export function VexFlowRenderer({
  notes,
  width = 400,
  height = 140,
  showTimeSignature = true,
  highlightIndex = -1,
  hitIndices,
}: VexFlowRendererProps) {
  if (notes.length === 0) return <div style={{ width, height }} />;

  const totalBeats = notes.reduce((s, n) => s + (BEAT_VALS[n.duration] ?? 1), 0);

  /* horizontal layout */
  const SIG_W   = showTimeSignature ? 54 : 18;  // space for "4/4" label
  const PAD_R   = 20;
  const lineX1  = SIG_W - 6;
  const lineX2  = width - PAD_R;
  const usable  = lineX2 - lineX1;
  const lineY   = height / 2;
  const stemLen = Math.min(34, height * 0.28);   // stem length scales with height

  /* compute each note's centre-x */
  let beat = 0;
  const entries = notes.map((note, i) => {
    const beats = BEAT_VALS[note.duration] ?? 1;
    const cx = lineX1 + (beat / totalBeats) * usable;
    beat += beats;
    return { note, i, cx, beats };
  });

  return (
    <div style={{ width, height: Math.max(height, 80), position: "relative", userSelect: "none" }}>

      {/* ── CSS keyframes injected once ── */}
      <style>{`
        @keyframes rhythmPulse {
          0%   { opacity: 0.85; r: 6px; }
          50%  { opacity: 0.25; r: 14px; }
          100% { opacity: 0.85; r: 6px; }
        }
        .rhythm-glow { animation: rhythmPulse 0.55s ease-in-out infinite; }
      `}</style>

      <svg
        width={width}
        height={Math.max(height, 80)}
        style={{ display: "block", overflow: "visible" }}
        aria-label="Ritim kalıbı"
      >
        {/* ── Single bold rhythm line ── */}
        <line
          x1={lineX1} y1={lineY}
          x2={lineX2} y2={lineY}
          stroke="#7c3aed" strokeWidth={3.5} strokeLinecap="round"
        />

        {/* ── 4/4 time signature ── */}
        {showTimeSignature && (
          <g fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fill="#4f46e5">
            <text x={SIG_W - 20} y={lineY - 4}  fontSize={20} textAnchor="middle">4</text>
            <text x={SIG_W - 20} y={lineY + 20} fontSize={20} textAnchor="middle">4</text>
          </g>
        )}

        {/* ── Notes ── */}
        {entries.map(({ note, i, cx }) => {
          const r        = noteRadius(note.duration);
          const isActive = i === highlightIndex;
          const isHit    = hitIndices?.has(i) ?? false;
          const isRest   = IS_REST_DUR[note.duration];
          const hollow   = IS_HOLLOW[note.duration];

          const color = isHit    ? "#16a34a"
                      : isActive ? "#f97316"
                      : isRest   ? "#9ca3af"
                      : "#4f46e5";

          /* ── Rest: short vertical dash on the line ── */
          if (isRest) {
            return (
              <g key={i}>
                <line
                  x1={cx} y1={lineY - r * 0.9}
                  x2={cx} y2={lineY + r * 0.9}
                  stroke={color} strokeWidth={3} strokeLinecap="round"
                  strokeDasharray="3,3"
                />
              </g>
            );
          }

          /* ── Note ── */
          return (
            <g key={i}>
              {/* Glow ring — only when active */}
              {isActive && (
                <circle
                  cx={cx} cy={lineY} r={r + 10}
                  fill={color} opacity={0.22}
                  className="rhythm-glow"
                />
              )}

              {/* Note head */}
              <circle
                cx={cx} cy={lineY} r={r}
                fill={hollow ? "white" : color}
                stroke={color} strokeWidth={hollow ? 3.5 : 0}
              />

              {/* Stem (quarter & eighth notes) */}
              {(note.duration === "q" || note.duration === "8") && (
                <line
                  x1={cx + r - 1.5} y1={lineY - 1}
                  x2={cx + r - 1.5} y2={lineY - stemLen}
                  stroke={color} strokeWidth={2.5} strokeLinecap="round"
                />
              )}

              {/* Flag on eighth note stem */}
              {note.duration === "8" && (
                <path
                  d={`M${cx + r - 1.5},${lineY - stemLen}
                      C${cx + r + 14},${lineY - stemLen + 10}
                       ${cx + r + 14},${lineY - stemLen + 18}
                       ${cx + r - 1.5},${lineY - stemLen + 24}`}
                  stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round"
                />
              )}

              {/* Half-note inner dot (distinguishes from quarter) */}
              {hollow && (
                <circle cx={cx} cy={lineY} r={r * 0.36} fill={color} />
              )}
            </g>
          );
        })}

        {/* ── Beat tick marks (4 major beats on the line) ── */}
        {Array.from({ length: 4 }, (_, b) => {
          const tx = lineX1 + (b / totalBeats) * usable;
          return (
            <line key={b}
              x1={tx} y1={lineY - 6} x2={tx} y2={lineY + 6}
              stroke="#c4b5fd" strokeWidth={1.5} strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

// Note reading renderer - shows single note on treble staff
interface SingleNoteRendererProps {
  noteKey: string;
  width?: number;
  height?: number;
  scale?: number;
}

export function SingleNoteRenderer({ noteKey, width = 280, height = 160, scale = 1 }: SingleNoteRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    try {
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont("Arial", 10);

      const stave = new Stave(10, 20, width - 20);
      stave.addClef("treble");
      stave.setContext(context).draw();

      const note = new StaveNote({
        keys: [noteKey],
        duration: "q",
        clef: "treble",
      });

      const voice = new Voice({ numBeats: 1, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables([note]);

      new Formatter().joinVoices([voice]).format([voice], width - 80);
      voice.draw(context, stave);
    } catch (e) {
      console.error("VexFlow single note error:", e);
    }
  }, [noteKey, width, height]);

  if (scale === 1) {
    return <div ref={containerRef} style={{ width, minHeight: height }} />;
  }

  return (
    <div style={{
      width: width * scale,
      height: height * scale,
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
    }}>
      <div
        ref={containerRef}
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
}
