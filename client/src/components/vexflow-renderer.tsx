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
  hitIndices?: Set<number>; // green = correctly tapped
}

export function VexFlowRenderer({
  notes,
  width = 400,
  height = 140,
  showClef = true,
  showTimeSignature = true,
  highlightIndex = -1,
  hitIndices,
}: VexFlowRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Stable string key so Set changes trigger re-render
  const hitKey = hitIndices ? [...hitIndices].sort((a, b) => a - b).join(",") : "";

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    containerRef.current.innerHTML = "";

    try {
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont("Arial", 10);

      const staveX = 10;
      const staveY = 28;          // extra top margin so notes/stems don't clip
      const staveWidth = width - 20;

      const stave = new Stave(staveX, staveY, staveWidth);
      if (showClef) stave.addClef("treble");
      if (showTimeSignature) stave.addTimeSignature("4/4");
      stave.setContext(context).draw();

      const vexNotes: StemmableNote[] = notes.map((n, i) => {
        const staveNote = new StaveNote({
          keys: n.keys,
          duration: n.duration,
          clef: "treble",
        });
        if (hitIndices?.has(i)) {
          staveNote.setStyle({ fillStyle: "#16a34a", strokeStyle: "#16a34a" }); // green hit
        } else if (i === highlightIndex) {
          staveNote.setStyle({ fillStyle: "#f97316", strokeStyle: "#f97316" }); // orange listen
        }
        return staveNote;
      });

      // Create beams for eighth notes
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

      new Formatter().joinVoices([voice]).format([voice], staveWidth - (showClef ? 80 : 20));
      voice.draw(context, stave);

      beamGroups.forEach(group => {
        const beam = new Beam(group);
        beam.setContext(context).draw();
      });

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
