import { useEffect, useRef } from "react";
import type { StemmableNote } from "vexflow";

export interface NoteData {
  keys: string[];
  duration: string;
  clef?: string;
}

interface VexFlowRendererProps {
  notes: NoteData[];
  width?: number;
  height?: number;
  showClef?: boolean;
  showTimeSignature?: boolean;
  highlightIndex?: number;
  hitIndices?: Set<number>;
}

/*
 * Module-level VexFlow cache — imported once, reused forever.
 * Eliminates the async-import race condition where a prop change
 * (highlightIndex, noteKey, etc.) fires cleanup (cancelled=true)
 * before the first import resolves, leaving the canvas blank.
 */
let _vfPromise: Promise<typeof import("vexflow")> | null = null;
function loadVexFlow() {
  if (!_vfPromise) _vfPromise = import("vexflow");
  return _vfPromise;
}

/*
 * RHYTHM LINE RENDERER
 *
 * Visual changes applied via post-render SVG manipulation:
 *   1. The 4 non-middle staff lines are hidden (display:none).
 *   2. The middle staff line (where B4 sits) is kept and styled purple+bold.
 *   3. A subtle glow circle is overlaid behind the active (highlighted) note.
 *   4. staveY is computed so the B4 middle line sits at height/2 (vertical centre).
 */
export function VexFlowRenderer({
  notes,
  width = 400,
  height = 150,
  showClef = true,
  showTimeSignature = true,
  highlightIndex = -1,
  hitIndices,
}: VexFlowRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hitKey = hitIndices ? [...hitIndices].sort((a, b) => a - b).join(",") : "";

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;
    let cancelled = false;

    (async () => {
      const { Renderer, Stave, StaveNote, Voice, Formatter, Beam } = await loadVexFlow();
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = "";

      try {
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();
        context.setFont("Arial", 10);

        const staveX      = 5;
        const staveY      = Math.round(height / 2 - 40);
        const staveWidth  = width - 10;
        const middleLineY = staveY + 20;

        const stave = new Stave(staveX, staveY, staveWidth);
        if (showClef)          stave.addClef("treble");
        if (showTimeSignature) stave.addTimeSignature("4/4");
        stave.setContext(context).draw();

        const vexNotes: StemmableNote[] = notes.map((n, i) => {
          const staveNote = new StaveNote({
            keys: n.keys,
            duration: n.duration,
            clef: "treble",
          });
          if (hitIndices?.has(i)) {
            staveNote.setStyle({ fillStyle: "#16a34a", strokeStyle: "#16a34a" });
          } else if (i === highlightIndex) {
            staveNote.setStyle({ fillStyle: "#f97316", strokeStyle: "#f97316" });
          }
          return staveNote;
        });

        const beamGroups: StemmableNote[][] = [];
        let currentBeam: StemmableNote[] = [];
        for (let i = 0; i < vexNotes.length; i++) {
          if (notes[i].duration === "8" || notes[i].duration === "8r") {
            currentBeam.push(vexNotes[i]);
          } else {
            if (currentBeam.length >= 2) beamGroups.push([...currentBeam]);
            currentBeam = [];
          }
        }
        if (currentBeam.length >= 2) beamGroups.push(currentBeam);

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setStrict(false);
        voice.addTickables(vexNotes);
        new Formatter().joinVoices([voice]).format([voice], staveWidth - (showClef ? 100 : 20));
        voice.draw(context, stave);
        beamGroups.forEach(group => new Beam(group).setContext(context).draw());

        if (cancelled || !containerRef.current) return;

        const svg = containerRef.current.querySelector("svg");
        if (!svg) return;

        if (!svg.querySelector("style#rhythm-anim")) {
          const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
          style.id = "rhythm-anim";
          style.textContent = `
            @keyframes rhythmGlowPulse {
              0%   { opacity: 0.30; transform: scale(1.0); }
              50%  { opacity: 0.08; transform: scale(1.6); }
              100% { opacity: 0.30; transform: scale(1.0); }
            }
            .rhythm-glow-ring {
              animation: rhythmGlowPulse 0.6s ease-in-out infinite;
              transform-box: fill-box;
              transform-origin: center;
            }
          `;
          svg.prepend(style);
        }

        const allLines = Array.from(svg.querySelectorAll("line"));
        const staffLines = allLines.filter(el => {
          const y1 = parseFloat(el.getAttribute("y1") ?? "0");
          const y2 = parseFloat(el.getAttribute("y2") ?? "0");
          const x1 = parseFloat(el.getAttribute("x1") ?? "0");
          const x2 = parseFloat(el.getAttribute("x2") ?? "0");
          return Math.abs(y1 - y2) < 1 && (x2 - x1) > staveWidth * 0.4;
        });

        if (staffLines.length > 0) {
          const middleLine = staffLines.reduce((best, el) => {
            const yBest = parseFloat(best.getAttribute("y1") ?? "0");
            const yCurr = parseFloat(el.getAttribute("y1") ?? "0");
            return Math.abs(yCurr - middleLineY) < Math.abs(yBest - middleLineY) ? el : best;
          });

          staffLines.forEach(el => {
            if (el === middleLine) {
              el.setAttribute("stroke", "#7c3aed");
              el.setAttribute("stroke-width", "4");
              el.removeAttribute("stroke-dasharray");
            } else {
              el.style.display = "none";
            }
          });
        }

        const oldGlow = svg.querySelector(".rhythm-glow-ring");
        if (oldGlow) oldGlow.remove();

        if (highlightIndex >= 0 && highlightIndex < vexNotes.length) {
          try {
            const noteX = (vexNotes[highlightIndex] as any).getAbsoluteX();
            const glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            glowCircle.setAttribute("cx", String(noteX));
            glowCircle.setAttribute("cy", String(middleLineY));
            glowCircle.setAttribute("r", "14");
            glowCircle.setAttribute("fill", "#f97316");
            glowCircle.setAttribute("opacity", "0.3");
            glowCircle.classList.add("rhythm-glow-ring");
            svg.insertBefore(glowCircle, svg.querySelector("style#rhythm-anim")?.nextSibling ?? svg.firstChild);
          } catch (_) {}
        }
      } catch (e) {
        console.error("VexFlow rendering error:", e);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, width, height, showClef, showTimeSignature, highlightIndex, hitKey]);

  return (
    <div
      ref={containerRef}
      className="vexflow-container"
      style={{ width, height, overflow: "visible", flexShrink: 0 }}
    />
  );
}

// Note reading renderer — shows single note on treble staff
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
    let cancelled = false;

    (async () => {
      const { Renderer, Stave, StaveNote, Voice, Formatter } = await loadVexFlow();
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = "";

      try {
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const context = renderer.getContext();
        context.setFont("Arial", 10);

        // Centre the staff vertically: middle B4 line at height/2
        const staveY = Math.round(height / 2 - 20);
        const stave = new Stave(10, staveY, width - 20);
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
    })();

    return () => { cancelled = true; };
  }, [noteKey, width, height]);

  if (scale === 1) {
    return <div ref={containerRef} style={{ width, minHeight: height }} />;
  }

  return (
    <div style={{
      width: width * scale,
      height: height * scale,
      overflow: "visible",
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
