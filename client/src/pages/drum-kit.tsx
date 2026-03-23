import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Play, Square, Trash2, Volume2, VolumeX, Download, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import drumImg from "@assets/drum-Photoroom_1773262756209.png";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { StudentProgress } from "@shared/schema";

/* ═══════════════════════════════════════════════════════
   WEB AUDIO CONTEXT
═══════════════════════════════════════════════════════ */
let _ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/* ── helpers ── */
function noiseBuf(c: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; return src;
}
function mkOsc(c: AudioContext, type: OscillatorType, freq: number, t: number, stop: number): OscillatorNode {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  o.start(t); o.stop(t + stop); return o;
}
function mkDecay(c: AudioContext, peak: number, dur: number, t: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

/* ═══════════════════════════════════════════════════════
   ACOUSTIC SYNTHESIS — each fn accepts optional `when`
   so the sequencer can schedule notes precisely.
═══════════════════════════════════════════════════════ */
function playKick(when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  const body = mkOsc(c, "sine", 160, t, 0.6);
  const bg = mkDecay(c, 1.6, 0.55, t);
  body.frequency.setValueAtTime(160, t);
  body.frequency.exponentialRampToValueAtTime(45, t + 0.07);
  body.connect(bg); bg.connect(c.destination);
  const click = mkOsc(c, "sine", 1800, t, 0.015);
  const cg = mkDecay(c, 0.5, 0.012, t);
  click.connect(cg); cg.connect(c.destination);
  const punch = mkOsc(c, "triangle", 80, t, 0.18);
  const pg = mkDecay(c, 0.6, 0.15, t);
  punch.connect(pg); pg.connect(c.destination);
}

function playSnare(when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  const head = mkOsc(c, "sine", 200, t, 0.18);
  const hg = mkDecay(c, 0.7, 0.14, t);
  head.connect(hg); hg.connect(c.destination);
  const mode2 = mkOsc(c, "sine", 330, t, 0.12);
  const m2g = mkDecay(c, 0.35, 0.09, t);
  mode2.connect(m2g); m2g.connect(c.destination);
  const wires = noiseBuf(c, 0.25);
  const bf = c.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 6000; bf.Q.value = 0.4;
  const wg = mkDecay(c, 1.0, 0.22, t);
  wires.connect(bf); bf.connect(wg); wg.connect(c.destination);
  wires.start(t); wires.stop(t + 0.25);
  const crack = noiseBuf(c, 0.025);
  const crg = mkDecay(c, 1.2, 0.02, t);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 3000;
  crack.connect(hpf); hpf.connect(crg); crg.connect(c.destination);
  crack.start(t); crack.stop(t + 0.025);
}

function playHihat(when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  [240, 363, 484, 618, 729, 854].forEach(f => {
    const o = mkOsc(c, "square", f * 35, t, 0.08);
    const g = mkDecay(c, 0.08, 0.06, t);
    const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 7000;
    o.connect(hpf); hpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 0.08);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 9000; bpf.Q.value = 0.6;
  const ng = mkDecay(c, 0.7, 0.06, t);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.08);
}

function playOpenHat(when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  [240, 363, 484, 618, 729, 854].forEach(f => {
    const o = mkOsc(c, "square", f * 35, t, 0.45);
    const g = mkDecay(c, 0.06, 0.42, t);
    const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
    o.connect(hpf); hpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 0.45);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 8000; bpf.Q.value = 0.5;
  const ng = mkDecay(c, 0.6, 0.42, t);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.45);
}

function playCrash(when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  [220, 311, 435, 521, 650].forEach((f, i) => {
    const o = mkOsc(c, "sawtooth", f * 22, t, 1.8);
    const g = mkDecay(c, 0.25 - i * 0.03, 1.6 - i * 0.15, t);
    const bpf = c.createBiquadFilter(); bpf.type = "bandpass";
    bpf.frequency.value = 4000 + i * 1000; bpf.Q.value = 0.3;
    o.connect(bpf); bpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 2.0);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 5500; bpf.Q.value = 0.3;
  const ng = mkDecay(c, 1.0, 1.8, t);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 2.0);
}

function playRide(when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  const bell = mkOsc(c, "triangle", 880, t, 0.9);
  const bg = mkDecay(c, 0.5, 0.85, t);
  bell.connect(bg); bg.connect(c.destination);
  [440, 660, 990, 1320].forEach((f, i) => {
    const o = mkOsc(c, "triangle", f, t, 0.9);
    const g = mkDecay(c, 0.15 - i * 0.02, 0.7 - i * 0.1, t);
    const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 3000 + i * 500; bpf.Q.value = 0.8;
    o.connect(bpf); bpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 0.6);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
  const ng = mkDecay(c, 0.35, 0.55, t);
  n.connect(hpf); hpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.6);
}

function playTom(freq: number, dur = 0.38, when?: number, ctx?: AudioContext | OfflineAudioContext) {
  const c = ctx ?? ac(); const t = when ?? c.currentTime;
  const head = mkOsc(c, "sine", freq, t, dur);
  const hg = mkDecay(c, 1.0, dur * 0.9, t);
  head.frequency.setValueAtTime(freq, t);
  head.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur * 0.6);
  head.connect(hg); hg.connect(c.destination);
  const h2 = mkOsc(c, "sine", freq * 1.5, t, dur * 0.6);
  const h2g = mkDecay(c, 0.4, dur * 0.5, t);
  h2.connect(h2g); h2g.connect(c.destination);
  const click = noiseBuf(c, 0.018);
  const lpf = c.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 3000;
  const cg = mkDecay(c, 0.5, 0.015, t);
  click.connect(lpf); lpf.connect(cg); cg.connect(c.destination);
  click.start(t); click.stop(t + 0.018);
}

/* ── Metronome click ── */
function playMetro(accent: boolean, vol: number, when: number) {
  const c = ac();
  const freq = accent ? 1800 : 900;
  const peak = (accent ? 0.9 : 0.55) * vol;
  // short sine click
  const o = c.createOscillator(); o.type = "sine"; o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
  o.connect(g); g.connect(c.destination);
  o.start(when); o.stop(when + 0.04);
  // subtle noise transient
  const len = Math.ceil(c.sampleRate * 0.012);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0); for (let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const ns = c.createBufferSource(); ns.buffer = buf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(peak * 0.5, when);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.012);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 4000;
  ns.connect(hpf); hpf.connect(ng); ng.connect(c.destination);
  ns.start(when); ns.stop(when + 0.012);
}

/* ═══════════════════════════════════════════════════════
   OFFLINE DRUM DISPATCHER (for WAV export)
═══════════════════════════════════════════════════════ */
function playDrumOffline(id: string, when: number, ctx: OfflineAudioContext) {
  switch (id) {
    case "kick":     playKick(when, ctx);              break;
    case "snare":    playSnare(when, ctx);             break;
    case "hihat":    playHihat(when, ctx);             break;
    case "openhat":  playOpenHat(when, ctx);           break;
    case "crash":    playCrash(when, ctx);             break;
    case "ride":     playRide(when, ctx);              break;
    case "tom1":     playTom(290, 0.38, when, ctx);   break;
    case "tom2":     playTom(220, 0.42, when, ctx);   break;
    case "floortom": playTom(130, 0.5,  when, ctx);   break;
  }
}

/* ═══════════════════════════════════════════════════════
   WAV EXPORT (OfflineAudioContext render)
═══════════════════════════════════════════════════════ */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const nCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const bps = 2; // 16-bit PCM
  const dataLen = n * nCh * bps;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataLen, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nCh * bps, true); v.setUint16(32, nCh * bps, true);
  v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

async function exportWav(pattern: Record<string, boolean[]>, bpm: number, loops = 2): Promise<Blob> {
  const stepDur = 60 / bpm / 4;
  const totalDur = stepDur * STEPS * loops + 2.5;
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * totalDur), sr);
  for (let loop = 0; loop < loops; loop++) {
    for (let step = 0; step < STEPS; step++) {
      const when = (loop * STEPS + step) * stepDur;
      Object.keys(pattern).forEach(id => {
        if (pattern[id]?.[step]) playDrumOffline(id, when, ctx);
      });
    }
  }
  const buf = await ctx.startRendering();
  return audioBufferToWav(buf);
}

/* ═══════════════════════════════════════════════════════
   MIDI EXPORT
═══════════════════════════════════════════════════════ */
const DRUM_MIDI: Record<string, number> = {
  kick: 36, snare: 38, hihat: 42, openhat: 46,
  crash: 49, ride: 51, tom1: 50, tom2: 48, floortom: 43,
};
function vlq(val: number): number[] {
  const b: number[] = [val & 0x7F];
  val >>= 7;
  while (val > 0) { b.unshift((val & 0x7F) | 0x80); val >>= 7; }
  return b;
}
function exportMidi(pattern: Record<string, boolean[]>, bpm: number): Uint8Array {
  const PPQ = 480; const step = PPQ / 4;
  const tempo = Math.round(60000000 / bpm);
  const evts: Array<[number, number, number]> = []; // [tick, note, vel]
  for (let s = 0; s < STEPS; s++) {
    Object.keys(pattern).forEach(id => {
      if (pattern[id]?.[s] && DRUM_MIDI[id]) {
        evts.push([s * step, DRUM_MIDI[id], 100]);
        evts.push([s * step + step - 1, DRUM_MIDI[id], 0]);
      }
    });
  }
  evts.sort((a, b) => a[0] - b[0]);
  const td: number[] = [0x00, 0xFF, 0x51, 0x03, (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF];
  let last = 0;
  for (const [tick, note, vel] of evts) {
    td.push(...vlq(tick - last)); last = tick;
    td.push(vel > 0 ? 0x99 : 0x89, note, vel);
  }
  td.push(0x00, 0xFF, 0x2F, 0x00);
  const hdr = [0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, PPQ>>8, PPQ&0xFF];
  const tl = td.length;
  const trk = [0x4D,0x54,0x72,0x6B, (tl>>24)&0xFF,(tl>>16)&0xFF,(tl>>8)&0xFF,tl&0xFF, ...td];
  return new Uint8Array([...hdr, ...trk]);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
}

/* ═══════════════════════════════════════════════════════
   DRUM ZONES (interactive hit areas on image)
═══════════════════════════════════════════════════════ */
type DrumId = "kick" | "snare" | "hihat" | "openhat" | "crash" | "ride" | "tom1" | "tom2" | "floortom";

interface Zone {
  id: DrumId; label: string; key: string;
  play: (when?: number) => void; color: string;
  left: number; top: number; width: number; height: number;
}

const ZONES: Zone[] = [
  { id: "crash",    label: "Crash",     key: "A", play: playCrash,                     color: "#fbbf24", left: 6,  top: 5,  width: 25, height: 13 },
  { id: "hihat",    label: "Hi-Hat",    key: "S", play: playHihat,                     color: "#fbbf24", left: 7,  top: 27, width: 14, height: 8  },
  { id: "openhat",  label: "Open Hat",  key: "E", play: playOpenHat,                   color: "#fde68a", left: 3,  top: 31, width: 8,  height: 6  },
  { id: "tom1",     label: "Tom 1",     key: "H", play: (w) => playTom(290, 0.38, w),  color: "#60a5fa", left: 23, top: 21, width: 17, height: 14 },
  { id: "snare",    label: "Snare",     key: "D", play: playSnare,                     color: "#f87171", left: 9,  top: 42, width: 17, height: 12 },
  { id: "tom2",     label: "Tom 2",     key: "J", play: (w) => playTom(220, 0.42, w),  color: "#fb923c", left: 54, top: 20, width: 16, height: 14 },
  { id: "ride",     label: "Ride",      key: "G", play: playRide,                      color: "#fbbf24", left: 68, top: 5,  width: 25, height: 13 },
  { id: "floortom", label: "Floor Tom", key: "K", play: (w) => playTom(130, 0.5, w),   color: "#d4af37", left: 68, top: 41, width: 19, height: 15 },
  { id: "kick",     label: "Kick",      key: "F", play: playKick,                      color: "#f97316", left: 26, top: 44, width: 44, height: 33 },
];
const KEY_MAP: Record<string, DrumId> = Object.fromEntries(ZONES.map(z => [z.key, z.id]));

/* ═══════════════════════════════════════════════════════
   SEQUENCER DRUM ROWS (7 rows, top = high → bottom = low)
═══════════════════════════════════════════════════════ */
const SEQ_DRUMS: Array<{ id: DrumId; label: string; color: string; play: (when?: number) => void }> = [
  { id: "crash",    label: "Crash",     color: "#fbbf24", play: playCrash },
  { id: "ride",     label: "Ride",      color: "#e5c05a", play: playRide },
  { id: "hihat",    label: "Hi-Hat",    color: "#fde68a", play: playHihat },
  { id: "tom1",     label: "Tom 1",     color: "#60a5fa", play: (w) => playTom(290, 0.38, w) },
  { id: "tom2",     label: "Tom 2",     color: "#fb923c", play: (w) => playTom(220, 0.42, w) },
  { id: "snare",    label: "Snare",     color: "#f87171", play: playSnare },
  { id: "floortom", label: "Floor Tom", color: "#d4af37", play: (w) => playTom(130, 0.5, w) },
  { id: "kick",     label: "Kick",      color: "#f97316", play: playKick },
];

const STEPS = 16; // 4 measures × 4 beats
type Pattern = Record<DrumId, boolean[]>;
function emptyPattern(): Pattern {
  const p = {} as Pattern;
  SEQ_DRUMS.forEach(d => { p[d.id] = new Array(STEPS).fill(false); });
  return p;
}

/* ═══════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════ */
const SECS_PER_STAR = 420; // 7 minutes per star

export default function DrumKit() {
  const [, navigate] = useLocation();
  const { student } = useAuth();

  /* ── fetch existing drum_kit progress ── */
  const { data: drumProgress } = useQuery<StudentProgress | null>({
    queryKey: ["/api/student", student?.student?.id, "progress", "drum_kit"],
    queryFn: async () => {
      const res = await fetch(
        `${(import.meta.env.VITE_API_URL || "")}/api/student/${student!.student.id}/progress`,
        { credentials: "include" }
      );
      const all: StudentProgress[] = await res.json();
      return all.find(p => p.appType === "drum_kit") ?? null;
    },
    enabled: !!student,
  });

  /* ── session playing time — populated after isPlaying is declared below ── */
  const [sessionSecs, setSessionSecs] = useState(0);
  const sessionSecsRef = useRef(0); // mirror for cleanup callback

  /* ── export state ── */
  const [exporting, setExporting] = useState<"wav" | "midi" | null>(null);

  const handleExportWav = async () => {
    setExporting("wav");
    try {
      const blob = await exportWav(pattern, bpm, 2);
      downloadBlob(blob, `notebeat-ritim-${Date.now()}.wav`);
    } finally { setExporting(null); }
  };

  const handleExportMidi = () => {
    const data = exportMidi(pattern, bpm);
    downloadBlob(new Blob([data], { type: "audio/midi" }), `notebeat-ritim-${Date.now()}.mid`);
  };

  /* ── pad hits (live play) ── */
  const [hits, setHits] = useState<Set<DrumId>>(new Set());
  const [lastHit, setLastHit] = useState<{ id: DrumId; ts: number } | null>(null);
  const hitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* ── orientation + ekran boyutu (her ikisi birlikte takip edilir) ── */
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const [viewSize, setViewSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const measure = () => {
      // visualViewport, mobil adres çubuğunu hesaba katan gerçek viewport boyutunu verir
      const vv = window.visualViewport;
      const w = vv ? Math.round(vv.width) : window.innerWidth;
      const h = vv ? Math.round(vv.height) : window.innerHeight;
      setIsPortrait(h > w);
      setViewSize({ w, h });
    };
    // mount anında, RAF + gecikme ile stabil değeri al
    const rafId = requestAnimationFrame(() => setTimeout(measure, 100));
    const onOrient = () => setTimeout(measure, 180);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", onOrient);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", onOrient);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, []);

  /* ── sequencer ── */
  const [pattern, setPattern] = useState<Pattern>(emptyPattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(90);

  /* ── metronome ── */
  const [metroVolume, setMetroVolume] = useState(0.65);
  const [metroMuted, setMetroMuted] = useState(false);
  const metroVolumeRef = useRef(metroVolume);
  const metroMutedRef = useRef(metroMuted);

  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(isPlaying);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteRef = useRef(0);
  const stepRef = useRef(0);
  const liveStepRef = useRef(-1); // tracks which step is currently sounding

  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { metroVolumeRef.current = metroVolume; }, [metroVolume]);
  useEffect(() => { metroMutedRef.current = metroMuted; }, [metroMuted]);

  /* ── play-aware session timer: only ticks while sequencer is running ── */
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setSessionSecs(s => {
        const next = s + 1;
        sessionSecsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying]);

  /* ── save playing time to backend on unmount ── */
  useEffect(() => {
    return () => {
      const sid = student?.student?.id;
      const secs = sessionSecsRef.current;
      if (!sid || secs < 2) return;
      fetch(`${(import.meta.env.VITE_API_URL || "")}/api/student/${sid}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appType: "drum_kit", timeSpentSeconds: secs }),
        credentials: "include",
        keepalive: true,
      });
    };
  }, [student?.student?.id]);

  /* ── star calculation (prev saved + current session playing time) ── */
  const prevTotalSecs = drumProgress?.timeSpentSeconds ?? 0;
  const liveTotalSecs = prevTotalSecs + sessionSecs;
  const earnedStars = Math.floor(liveTotalSecs / SECS_PER_STAR);
  const secsToNextStar = SECS_PER_STAR - (liveTotalSecs % SECS_PER_STAR);
  const minsLeft = Math.ceil(secsToNextStar / 60);

  /* ── live hit (+ live record when playing) ── */
  const hit = useCallback((id: DrumId) => {
    ZONES.find(z => z.id === id)!.play();
    setHits(prev => new Set(prev).add(id));
    setLastHit({ id, ts: Date.now() });
    clearTimeout(hitTimers.current[id]);
    hitTimers.current[id] = setTimeout(() => {
      setHits(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 180);
    // Live-record into sequencer while playing
    if (isPlayingRef.current && liveStepRef.current >= 0) {
      const step = liveStepRef.current;
      setPattern(prev => {
        const next = { ...prev, [id]: [...prev[id]] };
        next[id][step] = true;
        return next;
      });
    }
  }, []);

  /* ── keyboard ── */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); return; }
      const id = KEY_MAP[e.key.toUpperCase()];
      if (id) hit(id);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [hit]);

  /* ── sequencer scheduler ── */
  useEffect(() => {
    if (!isPlaying) {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      setCurrentStep(-1);
      liveStepRef.current = -1;
      return;
    }
    const c = ac();
    nextNoteRef.current = c.currentTime + 0.05;
    stepRef.current = 0;

    schedulerRef.current = setInterval(() => {
      const ctx2 = ac();
      const stepDur = 60 / bpmRef.current / 4; // 16th note
      while (nextNoteRef.current < ctx2.currentTime + 0.12) {
        const step = stepRef.current % STEPS;
        const when = nextNoteRef.current;
        // metronome click on every quarter note (steps 0,4,8,12)
        if (step % 4 === 0 && !metroMutedRef.current) {
          playMetro(step === 0, metroVolumeRef.current, when);
        }
        // fire all active drums at this step
        SEQ_DRUMS.forEach(drum => {
          if (patternRef.current[drum.id]?.[step]) drum.play(when);
        });
        // sync visual playhead + live-record ref
        const delayMs = Math.max(0, (when - ctx2.currentTime) * 1000);
        const capturedStep = step;
        setTimeout(() => {
          setCurrentStep(capturedStep);
          liveStepRef.current = capturedStep;
        }, delayMs);
        nextNoteRef.current += stepDur;
        stepRef.current++;
      }
    }, 25);

    return () => { if (schedulerRef.current) clearInterval(schedulerRef.current); };
  }, [isPlaying]);

  /* ── toggle sequencer cell ── */
  const toggleStep = (id: DrumId, step: number) => {
    setPattern(prev => {
      const next = { ...prev, [id]: [...prev[id]] };
      next[id][step] = !next[id][step];
      return next;
    });
  };

  const lastZone = lastHit ? ZONES.find(z => z.id === lastHit.id) : null;

  /* ── Responsive size calculations ── */
  const HEADER_H = 50;

  // Portrait: drum image fills most of top half, leaving room for controls + scrollable grid
  const portraitDrumSize = (() => {
    const CONTROLS = 80, GRID_MIN = 120;
    const byWidth = Math.round(viewSize.w * 0.82);
    const byHeight = Math.round((viewSize.h - HEADER_H - CONTROLS - GRID_MIN) * 0.95);
    return Math.min(byWidth, byHeight, 340);
  })();

  // Landscape: drum sits in left column; constrained by height and max 42% of width
  const landscapeDrumSize = Math.max(
    120,
    Math.min(viewSize.h - HEADER_H - 4, Math.round(viewSize.w * 0.42), 340)
  );

  /* ── Render helpers (plain functions, not React components, to avoid remount issues) ── */
  const renderDrumPad = (size: number) => (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <img src={drumImg} alt="Davul Seti"
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false} />
      {ZONES.map(zone => {
        const active = hits.has(zone.id);
        return (
          <div key={zone.id}
            data-testid={`drum-zone-${zone.id}`}
            onPointerDown={e => { e.preventDefault(); hit(zone.id); }}
            style={{
              position: "absolute",
              left: `${zone.left}%`, top: `${zone.top}%`,
              width: `${zone.width}%`, height: `${zone.height}%`,
              borderRadius: "50%", cursor: "pointer",
              touchAction: "none", userSelect: "none",
              willChange: "background, box-shadow",
              background: active
                ? `radial-gradient(ellipse, ${zone.color}55 0%, transparent 80%)`
                : "transparent",
              boxShadow: active ? `0 0 18px 6px ${zone.color}60` : "none",
              border: active
                ? `2px solid ${zone.color}bb`
                : "1.5px solid rgba(255,255,255,0.05)",
              zIndex: 10,
              transition: "background 0.04s, box-shadow 0.04s, border 0.04s",
            }}>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <div style={{
                background: active ? zone.color : "rgba(0,0,0,0.62)",
                color: active ? "#000" : "rgba(255,255,255,0.9)",
                border: `1.5px solid ${active ? zone.color : "rgba(255,255,255,0.2)"}`,
                borderRadius: "7px",
                padding: size < 180 ? "1px 3px" : "1px 5px",
                fontSize: size < 180 ? "8px" : "10px",
                fontWeight: 900, lineHeight: 1.3,
                whiteSpace: "nowrap", textAlign: "center",
                boxShadow: active ? `0 0 10px ${zone.color}` : "none",
                transition: "all 0.06s",
              }}>
                {zone.label}
                {/* only show key hint on larger screens where keyboard is useful */}
                {size >= 200 && (
                  <div style={{ fontSize: "7px", opacity: 0.6 }}>[{zone.key}]</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Reusable: sequencer controls ── */
  const renderControls = (compact?: boolean) => (
    <div className={`flex-shrink-0 border-t border-white/8 ${compact ? "px-2" : "px-3"}`}
      style={{ background: "rgba(0,0,0,0.38)" }}>

      {/* Row 1: Play/Stop · REC · BPM · Clear */}
      <div className={`flex items-center gap-1.5 ${compact ? "py-1" : "py-1.5"}`}>
        <button
          data-testid="btn-seq-play"
          onClick={() => setIsPlaying(p => !p)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-extrabold text-xs text-black transition-all flex-shrink-0"
          style={{
            background: isPlaying ? "#f87171" : "#4ade80",
            boxShadow: `0 0 10px ${isPlaying ? "#f87171" : "#4ade80"}55`,
            touchAction: "manipulation",
          }}>
          {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {isPlaying ? "Dur" : "Çal"}
        </button>

        {isPlaying && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.2)", border: "1.5px solid #ef4444" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-red-400 text-[9px] font-extrabold">REC</span>
          </motion.div>
        )}

        <span className="text-white/55 text-[11px] font-bold flex-shrink-0">BPM</span>
        <input type="range" min={50} max={160} value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          className="flex-1 h-2 rounded accent-yellow-400"
          style={{ minWidth: 0, touchAction: "none" }} />
        <span className="text-yellow-400 font-extrabold text-xs w-6 text-right flex-shrink-0">{bpm}</span>

        <div className="w-px h-4 bg-white/15 flex-shrink-0" />

        <button
          data-testid="btn-seq-clear"
          onClick={() => setPattern(emptyPattern())}
          className="flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-[11px] font-bold transition-all flex-shrink-0"
          style={{ touchAction: "manipulation" }}>
          <Trash2 className="w-3 h-3" />
          {!compact && "Temizle"}
        </button>

        {/* Export buttons – only show in compact mode as icons only */}
        {compact && (
          <>
            <button data-testid="btn-export-wav" onClick={handleExportWav}
              disabled={exporting === "wav"}
              title="WAV indir"
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-extrabold flex-shrink-0"
              style={{
                background: "rgba(74,222,128,0.15)", border: "1.5px solid rgba(74,222,128,0.4)",
                color: exporting === "wav" ? "#6b7280" : "#4ade80",
                touchAction: "manipulation",
              }}>
              <Download className="w-3 h-3" />
            </button>
            <button data-testid="btn-export-midi-compact" onClick={handleExportMidi}
              title="MIDI indir"
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-extrabold flex-shrink-0"
              style={{
                background: "rgba(168,85,247,0.15)", border: "1.5px solid rgba(168,85,247,0.4)",
                color: "#a855f7",
                touchAction: "manipulation",
              }}>
              <Music className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* Row 2: Metronome (only in non-compact / portrait) */}
      {!compact && (
        <div className="flex items-center gap-2 pb-1.5">
          <button
            data-testid="btn-metro-mute"
            onClick={() => setMetroMuted(m => !m)}
            title={metroMuted ? "Metronome açık" : "Metronome kapat"}
            className="flex-shrink-0 rounded-md p-1 transition-all"
            style={{
              background: metroMuted ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.08)",
              border: `1.5px solid ${metroMuted ? "#ef4444" : "rgba(255,255,255,0.18)"}`,
              color: metroMuted ? "#f87171" : "rgba(255,255,255,0.7)",
              touchAction: "manipulation",
            }}>
            {metroMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <span className="text-white/50 text-xs font-bold flex-shrink-0">Metronom</span>
          <input type="range" min={0} max={100} value={Math.round(metroVolume * 100)}
            onChange={e => setMetroVolume(Number(e.target.value) / 100)}
            disabled={metroMuted}
            className="flex-1 h-2 rounded accent-cyan-400"
            style={{ opacity: metroMuted ? 0.35 : 1, minWidth: 0 }} />
          <span className="text-cyan-400 font-extrabold text-xs w-8 text-right flex-shrink-0"
            style={{ opacity: metroMuted ? 0.35 : 1 }}>
            %{Math.round(metroVolume * 100)}
          </span>
        </div>
      )}
      {/* Compact metronome: icon only mute + slider */}
      {compact && (
        <div className="flex items-center gap-1.5 pb-1">
          <button
            data-testid="btn-metro-mute"
            onClick={() => setMetroMuted(m => !m)}
            className="flex-shrink-0 rounded-md p-1 transition-all"
            style={{
              background: metroMuted ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.08)",
              border: `1.5px solid ${metroMuted ? "#ef4444" : "rgba(255,255,255,0.18)"}`,
              color: metroMuted ? "#f87171" : "rgba(255,255,255,0.7)",
              touchAction: "manipulation",
            }}>
            {metroMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <input type="range" min={0} max={100} value={Math.round(metroVolume * 100)}
            onChange={e => setMetroVolume(Number(e.target.value) / 100)}
            disabled={metroMuted}
            className="flex-1 h-1.5 rounded accent-cyan-400"
            style={{ opacity: metroMuted ? 0.35 : 1, minWidth: 0 }} />
          <span className="text-cyan-400 font-extrabold text-[10px] w-7 text-right flex-shrink-0"
            style={{ opacity: metroMuted ? 0.35 : 1 }}>
            %{Math.round(metroVolume * 100)}
          </span>
        </div>
      )}
    </div>
  );

  /* ── Reusable: sequencer grid ── */
  const renderGrid = (labelW = 58) => (
    <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto px-1"
      style={{ minHeight: 0, paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))" }}>

      {/* Beat header */}
      <div className="flex items-center mb-0.5 flex-shrink-0">
        <div style={{ width: labelW }} />
        {[1, 2, 3, 4].map(m => (
          <div key={m} className="flex-1 text-center text-[8px] font-extrabold text-white/30">
            {m}.
          </div>
        ))}
      </div>

      {/* Drum rows */}
      {SEQ_DRUMS.map(drum => (
        <div key={drum.id} className="flex items-center gap-0" style={{ flex: "1 1 0", minHeight: 18 }}>
          <div className="flex-shrink-0 flex items-center justify-end pr-1.5"
            style={{ width: labelW }}>
            <div className="px-1 py-0.5 rounded text-[9px] font-extrabold leading-tight"
              style={{
                background: `${drum.color}22`,
                color: drum.color,
                border: `1px solid ${drum.color}44`,
                whiteSpace: "nowrap",
              }}>
              {drum.label}
            </div>
          </div>

          <div className="flex flex-1 gap-0.5 min-w-0">
            {[0, 1, 2, 3].map(measure => (
              <div key={measure}
                className="flex gap-0.5 flex-1"
                style={{
                  borderLeft: measure > 0 ? "1.5px solid rgba(255,255,255,0.10)" : "none",
                  paddingLeft: measure > 0 ? 3 : 0,
                }}>
                {[0, 1, 2, 3].map(beat => {
                  const step = measure * 4 + beat;
                  const on = pattern[drum.id]?.[step] ?? false;
                  const isCurrent = currentStep === step && isPlaying;
                  return (
                    <button key={beat}
                      data-testid={`seq-cell-${drum.id}-${step}`}
                      onClick={() => toggleStep(drum.id, step)}
                      className="flex-1 rounded transition-all"
                      style={{
                        minWidth: 0,
                        aspectRatio: "1 / 1",
                        touchAction: "manipulation",
                        background: on
                          ? (isCurrent ? drum.color : `${drum.color}cc`)
                          : isCurrent
                            ? "rgba(255,255,255,0.25)"
                            : beat === 0
                              ? "rgba(255,255,255,0.11)"
                              : "rgba(255,255,255,0.06)",
                        boxShadow: on && isCurrent ? `0 0 8px 2px ${drum.color}88` : "none",
                        border: on
                          ? `1.5px solid ${drum.color}88`
                          : `1px solid rgba(255,255,255,${isCurrent ? "0.3" : "0.08"})`,
                        transform: on && isCurrent ? "scale(1.05)" : "scale(1)",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Shared header ── */
  const renderHeader = () => (
    <header className="flex items-center justify-between px-3 border-b border-white/10 flex-shrink-0"
      style={{
        height: HEADER_H,
        background: "rgba(0,0,0,0.58)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
      {/* Back */}
      <Button variant="ghost" size="sm"
        onClick={() => navigate("/student/home")}
        className="gap-1 text-white/80 hover:text-white hover:bg-white/10 rounded-xl flex-shrink-0"
        data-testid="btn-back-drum"
        style={{ touchAction: "manipulation" }}>
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">Geri</span>
      </Button>

      {/* Title + star */}
      <div className="flex flex-col items-center flex-1 mx-2 min-w-0">
        <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight whitespace-nowrap">
          🥁 Davul Seti
        </h1>
        {student && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap justify-center">
            <span className="text-yellow-400 text-[11px] font-extrabold">⭐ {earnedStars}</span>
            <span className="text-white/40 text-[10px]">·</span>
            <span className="text-white/50 text-[10px] font-semibold whitespace-nowrap">
              {isPlaying ? `${minsLeft} dk → +1⭐` : "Çalmaya başla → ⭐ kazan"}
            </span>
          </div>
        )}
      </div>

      {/* Right: last-hit label + export buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <AnimatePresence mode="wait">
          {lastZone && (
            <motion.span key={lastHit?.ts}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-black"
              style={{ background: lastZone.color }}>
              {lastZone.label}
            </motion.span>
          )}
        </AnimatePresence>

        <button data-testid="btn-export-wav"
          onClick={handleExportWav} disabled={exporting === "wav"}
          title="Ses dosyası indir (.wav)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold"
          style={{
            background: "rgba(74,222,128,0.15)", border: "1.5px solid rgba(74,222,128,0.4)",
            color: exporting === "wav" ? "#6b7280" : "#4ade80",
            opacity: exporting === "wav" ? 0.6 : 1,
            touchAction: "manipulation",
          }}>
          <Download className="w-3 h-3" />
          <span className="hidden xs:inline">{exporting === "wav" ? "..." : "WAV"}</span>
        </button>

        <button data-testid="btn-export-midi"
          onClick={handleExportMidi}
          title="MIDI dosyası indir (.mid)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold"
          style={{
            background: "rgba(168,85,247,0.15)", border: "1.5px solid rgba(168,85,247,0.4)",
            color: "#a855f7",
            touchAction: "manipulation",
          }}>
          <Music className="w-3 h-3" />
          <span className="hidden xs:inline">MIDI</span>
        </button>
      </div>
    </header>
  );

  return (
    <div className="flex flex-col select-none"
      style={{
        height: `${viewSize.h}px`,
        background: "linear-gradient(160deg, #0e0920 0%, #0d1a3a 60%, #080d1a 100%)",
        touchAction: "none",
        overflow: "hidden",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}>

      {renderHeader()}

      {isPortrait ? (
        /* ═══ PORTRAIT: vertical stack ═══ */
        <>
          {/* Drum pad – centered, proportional */}
          <div className="flex-shrink-0 flex justify-center items-center pt-1 px-2"
            style={{ height: portraitDrumSize }}>
            {renderDrumPad(portraitDrumSize)}
          </div>

          {/* Controls – 2 rows */}
          {renderControls()}

          {/* Sequencer grid – fills remaining space, scrollable */}
          {renderGrid()}
        </>
      ) : (
        /* ═══ LANDSCAPE: drum left | controls+grid right ═══ */
        <div className="flex flex-1 overflow-hidden">

          {/* Left column: drum pad */}
          <div className="flex-shrink-0 flex items-center justify-center py-1 pl-1"
            style={{ width: landscapeDrumSize }}>
            {renderDrumPad(landscapeDrumSize - 8)}
          </div>

          {/* Right column: controls (compact) + grid */}
          <div className="flex flex-col flex-1 overflow-hidden border-l border-white/10">
            {renderControls(true)}
            {renderGrid(52)}
          </div>
        </div>
      )}
    </div>
  );
}
