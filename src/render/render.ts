import type { Critter, Garden, Species, Vec, Verb } from "../sim/types.js";
import { eventFocus, type ActiveEvents, type EventPhase } from "../sim/objectives.js";

/**
 * What the renderer needs from a world — satisfied by `World` and by the
 * hunt's ghost-composited world alike. The renderer must not care which it is
 * drawing: a hunt garden that rendered differently would be a leak.
 */
export interface Scene {
  garden: Garden;
  critters: readonly Critter[];
  tick: number;
  events: ActiveEvents;
}

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

interface Coat {
  body: string;
  /** Limbs, ears, tail — anything that should sit visually behind the body. */
  dark: string;
  /** Belly and tail-tip catchlights. */
  light: string;
}

const COAT: Record<Species, Coat> = {
  ground: { body: "#d8c07a", dark: "#ac9152", light: "#f0e2b4" },
  tree: { body: "#d08a4e", dark: "#a26433", light: "#f0c493" },
  water: { body: "#8fd3d8", dark: "#5ba3ac", light: "#cdeff1" },
};

/**
 * Verbs that carry a critter across the ground. Limb cycles run only during
 * these, so a still critter is visibly still — the garden's motion baseline is
 * what a Hunter reads against, and false movement would blur it.
 */
const TRAVELLING: ReadonlySet<Verb> = new Set<Verb>(["walk", "flee", "swim", "climb"]);

/** Deterministic per-index jitter, so tufts don't shimmer between frames. */
function jitter(i: number, salt: number): number {
  const t = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return t - Math.floor(t);
}

/**
 * Depth order: further up the garden is further away, so it is drawn first and
 * overlapped by whatever stands in front of it.
 *
 * This is also a confound fix, which is why it is a tested function rather
 * than an inline sort. `HuntWorld.critters` concatenates ghosts after NPCs, so
 * recorded humans hold the highest ids and arrive last in the array — drawing
 * in array order silently painted every human on top of any NPC it overlapped.
 * A Hunter could have learned that without ever knowing they had.
 *
 * The rule this encodes: **nothing the renderer draws may depend on
 * `critter.id`.** Position and species are shared honestly by humans and NPCs;
 * id is not.
 */
export function drawOrder(critters: readonly Critter[]): Critter[] {
  return [...critters].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);
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
  /** Critters the Hunter has accused — marked so they aren't accused twice. */
  marks: ReadonlySet<number> | null = null;

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

  draw(world: Scene): void {
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
    // Each band is depth-sorted — see drawOrder.
    const ordered = drawOrder(world.critters);
    const low = ordered.filter((c) => !(c.species === "tree" && c.elevation > 0.35));
    const high = ordered.filter((c) => c.species === "tree" && c.elevation > 0.35);

    for (const c of low) this.drawCritter(c);
    this.drawTrees(garden);
    for (const c of high) this.drawCritter(c);

    if (this.highlightId !== null) {
      const me = world.critters.find((c) => c.id === this.highlightId);
      if (me) this.drawHighlight(me);
    }

    if (this.marks) {
      for (const c of world.critters) {
        if (!this.marks.has(c.id)) continue;
        ctx.save();
        ctx.strokeStyle = "rgba(214, 88, 70, 0.9)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(c.pos.x, c.pos.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * The schedule's focus features, always faintly present so the garden's
   * geography is learnable, with a pulse during the warning and a steady ring
   * while the window is open — the 2D stand-in for conch, bells and volcano.
   */
  private drawFoci(world: Scene): void {
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

  private drawEventRing(world: Scene, ev: EventPhase): void {
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

    // Lily pads, still inside the pond clip so none can drift onto the grass.
    for (let i = 0; i < 5; i++) {
      const a = jitter(i, 21) * Math.PI * 2;
      const r = 0.35 + jitter(i, 22) * 0.5;
      const x = pond.pos.x + Math.cos(a) * pond.rx * r;
      const y = pond.pos.y + Math.sin(a) * pond.ry * r;
      const rad = 3.4 + jitter(i, 23) * 2;
      ctx.fillStyle = "rgba(96, 148, 92, 0.85)";
      ctx.beginPath();
      ctx.arc(x, y, rad, jitter(i, 24) * 6, jitter(i, 24) * 6 + Math.PI * 1.82);
      ctx.fill();
    }
    ctx.restore();

    // Reeds break the rim so the pond sits in the garden rather than on it.
    ctx.save();
    ctx.strokeStyle = "rgba(74, 108, 58, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const x = pond.pos.x + Math.cos(a) * (pond.rx + 1 + jitter(i, 31) * 3);
      const y = pond.pos.y + Math.sin(a) * (pond.ry + 1 + jitter(i, 32) * 3);
      const h = 5 + jitter(i, 33) * 6;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (jitter(i, 34) - 0.5) * 3, y - h * 0.6, x + (jitter(i, 35) - 0.5) * 6, y - h);
    }
    ctx.stroke();
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

    /**
     * Limb phase, taken from distance covered rather than from the clock — so
     * legs cycle exactly as fast as a critter actually moves, and freeze when
     * it stops. Deriving it from `tick` would make even a motionless critter
     * paddle; deriving it from `id` would leak (see drawOrder).
     */
    const gait = TRAVELLING.has(c.verb) ? Math.sin((c.pos.x + c.pos.y) * 0.5) : 0;
    const coat = COAT[c.species];

    // Posture carries the verb. This is what a Hunter actually reads, so each
    // state must stay distinguishable at a glance and at small size — the
    // silhouettes below add species character *around* those postures without
    // softening any of them.
    if (c.species === "ground") this.drawGrazer(c, coat, gait);
    else if (c.species === "tree") this.drawClimber(c, coat, gait, lift);
    else this.drawSwimmer(c, coat, gait, submerged);

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

  /** Head with a pair of eyes — the detail that turns a blob into an animal. */
  private drawHead(x: number, y: number, r: number, coat: Coat): void {
    const { ctx } = this;
    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(30,26,20,0.78)";
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.arc(x + r * 0.45, y + side * r * 0.42, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Ground species: a stocky grazer. Four legs trotting on the diagonal, long
   * ears that lie flat when it bolts — the flee posture has to be the loudest
   * thing in the garden, because it is the one every Hunter learns first.
   */
  private drawGrazer(c: Critter, coat: Coat, gait: number): void {
    const { ctx } = this;
    const grazing = c.verb === "graze";
    const fleeing = c.verb === "flee";
    const bodyLen = fleeing ? 12.5 : 10.5;
    const bodyWide = grazing ? 8.5 : 7.5;

    ctx.strokeStyle = coat.dark;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const reach = gait * 2.8;
    ctx.beginPath();
    for (const [lx, side, swing] of [
      [bodyLen * 0.42, -1, reach],
      [bodyLen * 0.42, 1, -reach],
      [-bodyLen * 0.48, -1, -reach],
      [-bodyLen * 0.48, 1, reach],
    ] as const) {
      ctx.moveTo(lx, side * bodyWide * 0.4);
      ctx.lineTo(lx + swing, side * (bodyWide + 1.6));
    }
    ctx.stroke();

    // Haunch first: weight over the back legs, and it reads under the body.
    ctx.fillStyle = coat.dark;
    ctx.beginPath();
    ctx.ellipse(-bodyLen * 0.45, 0, bodyWide * 0.8, bodyWide * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyWide, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = coat.light;
    ctx.beginPath();
    ctx.arc(-bodyLen - 0.8, 0, 2.7, 0, Math.PI * 2);
    ctx.fill();

    const headX = bodyLen * (grazing ? 0.95 : 0.82);
    const headY = grazing ? 3.2 : 0;

    ctx.fillStyle = coat.dark;
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.translate(headX, headY + side * 2.1);
      ctx.rotate(side * (fleeing ? 2.5 : 0.5));
      ctx.beginPath();
      ctx.ellipse(2.2, 0, 4, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawHead(headX, headY, grazing ? 4.4 : 5, coat);
  }

  /**
   * Tree species: a slender climber whose tail does the talking — sweeping out
   * behind while it travels, folded up over the back once it settles in a
   * canopy. Reaching for fruit stretches the whole body forward.
   */
  private drawClimber(c: Critter, coat: Coat, gait: number, lift: number): void {
    const { ctx } = this;
    const reaching = c.verb === "pickFruit";
    const settled = c.verb === "perch" || lift > 0.5;
    const bodyLen = reaching ? 10.5 : 9.4;
    const bodyWide = 6.3;

    // Drawn twice along one path: a thick dark sweep, then a thinner pale one
    // inside it, which is enough to read as fur at this size.
    const curl = settled ? -1 : 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.75, 0);
    ctx.quadraticCurveTo(-bodyLen - 6.5, curl * 4.5 + gait * 1.6, -bodyLen - 3.2, curl * 10.5 + gait * 2.4);
    ctx.strokeStyle = coat.dark;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = coat.light;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = coat.dark;
    ctx.lineWidth = 2;
    const reachSwing = gait * 2.2;
    ctx.beginPath();
    for (const [lx, side, swing] of [
      [bodyLen * 0.4, -1, reachSwing],
      [bodyLen * 0.4, 1, -reachSwing],
      [-bodyLen * 0.35, -1, -reachSwing],
      [-bodyLen * 0.35, 1, reachSwing],
    ] as const) {
      ctx.moveTo(lx, side * bodyWide * 0.4);
      ctx.lineTo(lx + swing, side * (bodyWide + 1.2));
    }
    ctx.stroke();

    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyWide, 0, 0, Math.PI * 2);
    ctx.fill();

    const headX = bodyLen * 0.84;
    const headY = reaching ? -3.2 : 0;

    // Pointed tufted ears, the climber's silhouette tell against the grazer's.
    ctx.fillStyle = coat.dark;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(headX - 1, headY + side * 1.4);
      ctx.lineTo(headX + 1.4, headY + side * 6.2);
      ctx.lineTo(headX + 3.4, headY + side * 1.8);
      ctx.closePath();
      ctx.fill();
    }

    this.drawHead(headX, headY, 4.6, coat);
  }

  /**
   * Water species: a teardrop swimmer, tail fin sculling and flippers angling
   * with the stroke. The dive is a vanish, so the wake is the only thing left
   * to read once it goes under — keep it while any part still breaks surface.
   */
  private drawSwimmer(c: Critter, coat: Coat, gait: number, submerged: number): void {
    const { ctx } = this;
    const bodyLen = 11;
    const bodyWide = 6.2;

    ctx.fillStyle = coat.dark;
    ctx.save();
    ctx.translate(-bodyLen * 0.8, 0);
    ctx.rotate(gait * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-5.8, -4.4);
    ctx.lineTo(-4.4, 0);
    ctx.lineTo(-5.8, 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.translate(bodyLen * 0.12, side * bodyWide * 0.75);
      ctx.rotate(side * (0.55 + gait * 0.3));
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.moveTo(bodyLen, 0);
    ctx.quadraticCurveTo(bodyLen * 0.1, -bodyWide, -bodyLen * 0.8, 0);
    ctx.quadraticCurveTo(bodyLen * 0.1, bodyWide, bodyLen, 0);
    ctx.fill();

    ctx.fillStyle = coat.light;
    ctx.beginPath();
    ctx.ellipse(bodyLen * 0.1, 0, bodyLen * 0.45, bodyWide * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawHead(bodyLen * 0.78, 0, 4.5, coat);

    if (submerged < 0.35) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-bodyLen * 0.9, 0, 6 + submerged * 8, -0.9, 0.9);
      ctx.stroke();
    }
  }
}
