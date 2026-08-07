import type { Critter, Garden, Species, Vec } from "../sim/types.js";
import type { World } from "../sim/sim.js";
import { eventFocus, type EventPhase } from "../sim/objectives.js";

const PALETTE = {
  grassA: "#7fa653",
  grassB: "#6f9749",
  pond: "#4a86a8",
  pondRim: "#3d7291",
  trunk: "#6b4b32",
  canopy: "#4f7d3a",
  canopyHi: "#5d8f44",
  shadow: "rgba(28, 40, 20, 0.22)",
} as const;

const BODY: Record<Species, string> = {
  ground: "#d8c07a",
  tree: "#d08a4e",
  water: "#8fd3d8",
};

/** Deterministic per-index jitter, so tufts don't shimmer between frames. */
function jitter(i: number, salt: number): number {
  const t = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return t - Math.floor(t);
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  showLabels = false;
  /**
   * Critter to ring-mark as "you" in play mode. Dev harness only — the hunt
   * interface must never set this, or there is nothing to hunt.
   */
  highlightId: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
  }

  resize(garden: Garden): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wrap = this.canvas.parentElement;
    const availW = (wrap?.clientWidth ?? garden.width) - 0;
    const availH = (wrap?.clientHeight ?? garden.height) - 52;
    const scale = Math.min(availW / garden.width, availH / garden.height, 1.4);
    const cssW = Math.floor(garden.width * scale);
    const cssH = Math.floor(garden.height * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
  }

  draw(world: World): void {
    const { ctx } = this;
    const { garden } = world;
    const scale = this.canvas.width / garden.width;

    ctx.save();
    ctx.scale(scale, scale);
    this.drawGround(garden);
    this.drawPond(garden);
    this.drawFoci(world);

    // Painter's order: anything not up a tree, then trees, then anything in them,
    // so a perched critter reads as being *in* the canopy rather than behind it.
    const low = world.critters.filter((c) => !(c.species === "tree" && c.elevation > 0.35));
    const high = world.critters.filter((c) => c.species === "tree" && c.elevation > 0.35);

    for (const c of low) this.drawCritter(c);
    this.drawTrees(garden);
    for (const c of high) this.drawCritter(c);

    if (this.highlightId !== null) {
      const me = world.critters.find((c) => c.id === this.highlightId);
      if (me) this.drawHighlight(me);
    }

    ctx.restore();
  }

  /**
   * The schedule's focus features, always faintly present so the garden's
   * geography is learnable, with a pulse during the warning and a steady ring
   * while the window is open — the 2D stand-in for conch, bells and volcano.
   */
  private drawFoci(world: World): void {
    const { ctx } = this;
    const g = world.garden;

    // Flower patch: a small scatter of blossoms.
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.7;
      const r = 6 + jitter(i, 11) * 22;
      const x = g.flowerPatch.x + Math.cos(a) * r;
      const y = g.flowerPatch.y + Math.sin(a) * r;
      ctx.fillStyle = i % 2 ? "#e5b8d0" : "#f0e6b0";
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Fruiting tree: fruit dots on its canopy (drawn again above the canopy in
    // drawTrees order — these sit under it, so repeat there would be better,
    // but the canopy is translucent enough that a halo reads; keep the halo.)
    // Shoal: faint ellipse of ripples.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(g.shoalSpot.x, g.shoalSpot.y, 16, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (const ev of Object.values(world.events)) {
      if (!ev || ev.phase === "quiet") continue;
      this.drawEventRing(world, ev);
    }
  }

  private drawEventRing(world: World, ev: EventPhase): void {
    const { ctx } = this;
    const focus: Vec = eventFocus(world.garden, ev.def);
    const open = ev.phase === "open";
    // Warn pulses on the sim tick (deterministic across replays); open is steady.
    const pulse = open ? 1 : 0.55 + 0.45 * Math.sin(world.tick * 0.35);
    const radius =
      ev.def.id === "harvest"
        ? (world.garden.trees[world.garden.fruitTreeIndex]?.radius ?? 30) + 10
        : ev.def.id === "bloom"
          ? 44
          : 34;
    ctx.save();
    ctx.strokeStyle = open ? "rgba(255, 244, 190, 0.85)" : "rgba(255, 244, 190, 0.5)";
    ctx.lineWidth = open ? 2.4 : 1.6;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(focus.x, focus.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Dashed "you" ring plus, mid-journey, a small target marker. */
  private drawHighlight(c: Critter): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    if (c.target && (c.verb === "walk" || c.verb === "swim")) {
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(c.target.x, c.target.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGround(garden: Garden): void {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, garden.width * 0.4, garden.height);
    g.addColorStop(0, PALETTE.grassA);
    g.addColorStop(1, PALETTE.grassB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, garden.width, garden.height);

    // Static tufts give the eye fixed reference points; without them, motion is
    // hard to judge against a flat field.
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 190; i++) {
      const x = jitter(i, 1) * garden.width;
      const y = jitter(i, 2) * garden.height;
      const h = 4 + jitter(i, 3) * 5;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (jitter(i, 4) - 0.5) * 3, y - h);
    }
    ctx.stroke();
  }

  private drawPond(garden: Garden): void {
    const { ctx } = this;
    const { pond } = garden;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pond.pos.x, pond.pos.y, pond.rx, pond.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.pond;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.pondRim;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const y = pond.pos.y - pond.ry + ((i + 0.6) * pond.ry * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(pond.pos.x - pond.rx, y);
      ctx.bezierCurveTo(
        pond.pos.x - pond.rx * 0.3, y - 4,
        pond.pos.x + pond.rx * 0.3, y + 4,
        pond.pos.x + pond.rx, y
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTrees(garden: Garden): void {
    const { ctx } = this;
    garden.trees.forEach((tree, i) => {
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(tree.pos.x + 6, tree.pos.y + 8, tree.radius * 0.95, tree.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = PALETTE.trunk;
      ctx.fillRect(tree.pos.x - 4, tree.pos.y - 4, 8, 14);

      ctx.fillStyle = PALETTE.canopy;
      ctx.beginPath();
      ctx.arc(tree.pos.x, tree.pos.y, tree.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.canopyHi;
      ctx.beginPath();
      ctx.arc(
        tree.pos.x - tree.radius * 0.26,
        tree.pos.y - tree.radius * 0.3,
        tree.radius * (0.5 + jitter(i, 7) * 0.12),
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }

  private drawCritter(c: Critter): void {
    const { ctx } = this;
    const submerged = c.species === "water" ? c.elevation : 0;
    // Up a tree reads as "closer to camera": larger, with the shadow pulled away.
    const lift = c.species === "tree" ? c.elevation : 0;
    const scale = 1 + lift * 0.35;
    const alpha = 1 - submerged * 0.78;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (submerged < 0.9) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(c.pos.x + 2 + lift * 9, c.pos.y + 6 + lift * 11, 8 * scale, 4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(c.pos.x, c.pos.y - lift * 3);
    ctx.rotate(c.heading);
    ctx.scale(scale, scale);

    // Posture carries the verb. This is what a Hunter actually reads, so each
    // state must be distinguishable at a glance and at small size.
    const grazing = c.verb === "graze";
    const fleeing = c.verb === "flee";
    const reaching = c.verb === "pickFruit";
    const bodyLen = fleeing ? 13 : reaching ? 9 : 10.5;
    const bodyWide = grazing ? 8.5 : 7.5;

    ctx.fillStyle = BODY[c.species];
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyWide, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head: dipped while grazing, raised while reaching for fruit.
    const headX = bodyLen * (grazing ? 0.95 : 0.8);
    const headY = grazing ? 3.2 : reaching ? -3.4 : 0;
    ctx.beginPath();
    ctx.arc(headX, headY, grazing ? 4.6 : 5.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(30,26,20,0.75)";
    ctx.beginPath();
    ctx.arc(headX + 2.2, headY - 1.4, 1.15, 0, Math.PI * 2);
    ctx.fill();

    if (c.species === "water" && submerged < 0.35) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-bodyLen * 0.9, 0, 6 + submerged * 8, -0.9, 0.9);
      ctx.stroke();
    }

    ctx.restore();

    if (this.showLabels) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(18,22,14,0.72)";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText(c.verb, c.pos.x, c.pos.y - 15 - lift * 6);
      ctx.restore();
    }
  }
}
