import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, type StemmableNote } from "vexflow";

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
 * RHYTHM LINE RENDERER
 *
 * Renders 100% authentic VexFlow musical notation (quarter notes, eighth notes,
 * rests, beams, stems, flags — all unchanged).
 *
 * Visual changes applied via post-render SVG manipulation:
 *   1. The 4 non-middle staff lines are hidden (display:none).
 *   2. The middle staff line (where B4 sits) is kept and styled purple+bold.
 *   3. A subtle glow circle is overlaid behind the active (highlighted) note,
 *      positioned using VexFlow's own getAbsoluteX() after formatting.
 *   4. Notes are enlarged via spacingBetweenLinesPx option (authentic scale-up).
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
    containerRef.current.innerHTML = "";

    try {
      /* ── VexFlow renderer ── */
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont("Arial", 11);

      /*
       * spacingBetweenLinesPx: 14 (default ~10) → notes appear ~40% larger.
       * The middle staff line (B4) is at staveY + 2 * spacing = staveY + 28.
       */
      const SPACING      = 14;
      const staveX       = 10;
      /*
       * Visual centering: treble clef extends ~40px above stave top; stave height = 4*14 = 56px.
       * Total visual block ≈ 96px → top margin = (height - 96) / 2, so staveY ≈ (height-16)/2.
       */
      const staveY       = Math.round((height - 16) / 2);
      const staveWidth   = width - 20;
      const middleLineY  = staveY + 2 * SPACING;         // 3rd line = B4

      const stave = new Stave(staveX, staveY, staveWidth, {
        spacingBetweenLinesPx: SPACING,
      } as Parameters<typeof Stave>[3]);
      if (showClef)          stave.addClef("treble");
      if (showTimeSignature) stave.addTimeSignature("4/4");
      stave.setContext(context).draw();

      /* ── Build VexFlow notes ── */
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

      /* ── Beams for eighth notes ── */
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

      /* ── Format & draw ── */
      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(vexNotes);
      new Formatter().joinVoices([voice]).format([voice], staveWidth - (showClef ? 90 : 20));
      voice.draw(context, stave);
      beamGroups.forEach(group => new Beam(group).setContext(context).draw());

      /* ── POST-RENDER SVG MANIPULATION ── */
      const svg = containerRef.current.querySelector("svg");
      if (!svg) return;

      /* 1. Inject keyframe animation for glow */
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

      /* 2. Identify and process staff lines.
            VexFlow draws 5 horizontal <line> elements spanning the stave width. */
      const allLines = Array.from(svg.querySelectorAll("line"));
      const staffLines = allLines.filter(el => {
        const y1 = parseFloat(el.getAttribute("y1") ?? "0");
        const y2 = parseFloat(el.getAttribute("y2") ?? "0");
        const x1 = parseFloat(el.getAttribute("x1") ?? "0");
        const x2 = parseFloat(el.getAttribute("x2") ?? "0");
        return Math.abs(y1 - y2) < 1 && (x2 - x1) > staveWidth * 0.4;
      });

      /* Find the line closest to middleLineY — keep it, hide the rest */
      if (staffLines.length > 0) {
        const middleLine = staffLines.reduce((best, el) => {
          const yBest = parseFloat(best.getAttribute("y1") ?? "0");
          const yCurr = parseFloat(el.getAttribute("y1") ?? "0");
          return Math.abs(yCurr - middleLineY) < Math.abs(yBest - middleLineY) ? el : best;
        });

        staffLines.forEach(el => {
          if (el === middleLine) {
            /* Bold purple rhythm line */
            el.setAttribute("stroke", "#7c3aed");
            el.setAttribute("stroke-width", "3");
            el.removeAttribute("stroke-dasharray");
          } else {
            el.style.display = "none";
          }
        });
      }

      /* 3. Glow ring behind the active note */
      const oldGlow = svg.querySelector(".rhythm-glow-ring");
      if (oldGlow) oldGlow.remove();

      if (highlightIndex >= 0 && highlightIndex < vexNotes.length) {
        try {
          const noteX = (vexNotes[highlightIndex] as StaveNote).getAbsoluteX();
          const glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          glowCircle.setAttribute("cx", String(noteX));
          glowCircle.setAttribute("cy", String(middleLineY));
          glowCircle.setAttribute("r", "22");
          glowCircle.setAttribute("fill", "#f97316");
          glowCircle.setAttribute("opacity", "0.3");
          glowCircle.classList.add("rhythm-glow-ring");
          /* Insert behind all other elements */
          svg.insertBefore(glowCircle, svg.querySelector("style#rhythm-anim")?.nextSibling ?? svg.firstChild);
        } catch (_) { /* getAbsoluteX may throw before layout — silently skip */ }
      }

    } catch (e) {
      console.error("VexFlow rendering error:", e);
    }
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
