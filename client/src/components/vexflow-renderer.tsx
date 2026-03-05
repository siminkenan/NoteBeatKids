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
}

export function VexFlowRenderer({
  notes,
  width = 400,
  height = 140,
  showClef = true,
  showTimeSignature = true,
  highlightIndex = -1,
}: VexFlowRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    containerRef.current.innerHTML = "";

    try {
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont("Arial", 10);

      const staveX = 10;
      const staveY = 20;
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
        if (i === highlightIndex) {
          staveNote.setStyle({ fillStyle: "#f97316", strokeStyle: "#f97316" });
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
  }, [notes, width, height, showClef, showTimeSignature, highlightIndex]);

  return (
    <div
      ref={containerRef}
      className="vexflow-container"
      style={{ width, minHeight: height, overflow: "visible" }}
    />
  );
}

// Note reading renderer - shows single note on treble staff
interface SingleNoteRendererProps {
  noteKey: string;
  width?: number;
  height?: number;
}

export function SingleNoteRenderer({ noteKey, width = 280, height = 160 }: SingleNoteRendererProps) {
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

  return <div ref={containerRef} style={{ width, minHeight: height }} />;
}
