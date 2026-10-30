import { BOUNDS } from "./types.ts";
import type { Rect, Vec } from "./types.ts";
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function normal(x: number, y: number): Vec {
  const l = Math.hypot(x, y);
  return l ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}
export function overlaps(p: Vec, r: number, o: Rect) {
  return (
    Math.hypot(
      p.x - clamp(p.x, o.x, o.x + o.w),
      p.y - clamp(p.y, o.y, o.y + o.h),
    ) < r
  );
}
/**
 * Push a body out of anything it is overlapping, along the shortest exit.
 *
 * Axis-by-axis resolution alone deadlocks on corners: the x pass pushes the
 * body out sideways, the y pass pushes it straight back in, and a chaser
 * pressed into a pillar corner can sit there forever. Resolving along the
 * corner normal lets it slide off instead.
 */
function separate(p: Vec & { r: number }, obstacles: Rect[]) {
  for (const o of obstacles) {
    const nearX = clamp(p.x, o.x, o.x + o.w),
      nearY = clamp(p.y, o.y, o.y + o.h);
    const ox = p.x - nearX,
      oy = p.y - nearY;
    const gap = Math.hypot(ox, oy);
    if (gap >= p.r) continue;
    if (gap > 1e-4) {
      p.x = nearX + (ox / gap) * p.r;
      p.y = nearY + (oy / gap) * p.r;
    } else {
      // Dead centre on an edge: leave by the closest face.
      const left = p.x - o.x,
        right = o.x + o.w - p.x,
        top = p.y - o.y,
        bottom = o.y + o.h - p.y;
      const shortest = Math.min(left, right, top, bottom);
      if (shortest === left) p.x = o.x - p.r;
      else if (shortest === right) p.x = o.x + o.w + p.r;
      else if (shortest === top) p.y = o.y - p.r;
      else p.y = o.y + o.h + p.r;
    }
    p.x = clamp(p.x, BOUNDS.left + p.r, BOUNDS.right - p.r);
    p.y = clamp(p.y, BOUNDS.top + p.r, BOUNDS.bottom - p.r);
  }
}

export function move(
  p: Vec & { r: number },
  dx: number,
  dy: number,
  obstacles: Rect[],
) {
  // Substeps stay under the smallest body radius, so nothing tunnels through a
  // pillar even during a dash or a knockback.
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5),
  );
  for (let i = 0; i < steps; i++) {
    p.x = clamp(p.x + dx / steps, BOUNDS.left + p.r, BOUNDS.right - p.r);
    p.y = clamp(p.y + dy / steps, BOUNDS.top + p.r, BOUNDS.bottom - p.r);
    // Advance freely, then push out along the shortest exit. Against a flat
    // face that is a pure normal push, so movement along the face is unchanged
    // and sliding falls out for free; at a corner it is diagonal, so bodies
    // round the corner instead of jamming against it.
    separate(p, obstacles);
  }
}

export function lineClear(a:Vec,b:Vec,obstacles:Rect[],radius=2){
  const n=Math.max(1,Math.ceil(distance(a,b)/10));
  for(let i=1;i<=n;i++)if(obstacles.some(o=>overlaps({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},radius,o)))return false;
  return true;
}
