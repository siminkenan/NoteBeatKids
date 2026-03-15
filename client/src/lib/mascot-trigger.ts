export type MascotReaction = "idle" | "bounce" | "tilt" | "note" | "pulse" | "point";

export let _setMascotReaction: ((r: MascotReaction) => void) | null = null;

export function triggerMascotReaction(reaction: MascotReaction) {
  window.dispatchEvent(new CustomEvent("mascot-react", { detail: reaction }));
}
