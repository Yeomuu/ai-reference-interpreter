import type { Area, Point, Rect } from './types';

const EPS = 1e-9;
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function onSegment(a: Point, b: Point, p: Point): boolean {
  return Math.abs(cross(a, b, p)) < EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
}
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  return cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS;
}
export function outlineBounds(points: Point[]): Rect {
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}
export function validOutline(points: Point[]): boolean {
  if (points.length < 3 || points.length > 100 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < .001) return false;
    area += a.x * b.y - b.x * a.y;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || i === 0 && j === points.length - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      if (crosses(a, b, c, d) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return false;
    }
  }
  return Math.abs(area) > .0002;
}
export function areaContainsPoint(area: Area, p: Point): boolean {
  const r = area.bounds;
  if (p.x < r.x - EPS || p.y < r.y - EPS || p.x > r.x + r.width + EPS || p.y > r.y + r.height + EPS) return false;
  if (!area.outline) return true;
  let inside = false;
  const points = area.outline;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if (onSegment(a, b, p)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function areaContainsSegment(area: Area, a: Point, b: Point): boolean {
  if (!areaContainsPoint(area, a) || !areaContainsPoint(area, b)) return false;
  if (!area.outline) return true;
  // Split at every boundary intersection and check each interval, including collinear vertices.
  const ts = [0, 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  for (let i = 0; i < area.outline.length; i++) {
    const c = area.outline[i], d = area.outline[(i + 1) % area.outline.length];
    const ex = d.x - c.x, ey = d.y - c.y, den = dx * ey - dy * ex;
    if (Math.abs(den) > EPS) {
      const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / den;
      const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    } else if (onSegment(a, b, c)) ts.push(Math.abs(dx) > Math.abs(dy) ? (c.x - a.x) / dx : dy ? (c.y - a.y) / dy : 0);
  }
  ts.sort((x, y) => x - y);
  return ts.slice(1).every((t, i) => areaContainsPoint(area, { x: a.x + dx * (t + ts[i]) / 2, y: a.y + dy * (t + ts[i]) / 2 }));
}
export function areaContainsRect(area: Area, r: Rect): boolean {
  const corners = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];
  return corners.every((p, i) => areaContainsSegment(area, p, corners[(i + 1) % 4]));
}

/** Occupancy against the traced interior rather than its enclosing rectangle. */
export function areaIntersectsRect(area: Area, r: Rect): boolean {
  const box=area.bounds;
  if (box.x>=r.x+r.width || r.x>=box.x+box.width || box.y>=r.y+r.height || r.y>=box.y+box.height) return false;
  if (!area.outline) return true;
  const corners=[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
  return corners.some(p=>areaContainsPoint(area,p)) || area.outline.some(p=>p.x>=r.x && p.x<=r.x+r.width && p.y>=r.y && p.y<=r.y+r.height) ||
    corners.some((p,i)=>area.outline!.some((q,j)=>crosses(p,corners[(i+1)%4],q,area.outline![(j+1)%area.outline!.length])));
}

export function areaIntersectsSegment(area: Area, a: Point, b: Point): boolean {
  const box=area.bounds;
  const interior=(p:Point)=>areaContainsPoint(area,p) && (area.outline
    ? !area.outline.some((q,i)=>onSegment(q,area.outline![(i+1)%area.outline!.length],p))
    : p.x>box.x+EPS && p.x<box.x+box.width-EPS && p.y>box.y+EPS && p.y<box.y+box.height-EPS);
  const edges=area.outline??[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}];
  const dx=b.x-a.x, dy=b.y-a.y, ts=[0,1];
  for(let i=0;i<edges.length;i++) {
    const c=edges[i],d=edges[(i+1)%edges.length],ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;
    if(Math.abs(den)>EPS) {
      const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;
      if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);
    } else if(onSegment(a,b,c)) ts.push(Math.abs(dx)>Math.abs(dy)?(c.x-a.x)/dx:dy?(c.y-a.y)/dy:0);
  }
  ts.sort((x,y)=>x-y);
  return ts.slice(1).some((t,i)=>interior({x:a.x+dx*(t+ts[i])/2,y:a.y+dy*(t+ts[i])/2}));
}

export function areaIntersectsCircle(area: Area, center: Point, radius: number, width: number, height: number): boolean {
  if(areaContainsPoint(area,center))return true;
  const box=area.bounds,edges=area.outline??[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}];
  const r=radius*Math.min(width,height);
  return edges.some((a,i)=>{
    const b=edges[(i+1)%edges.length],dx=(b.x-a.x)*width,dy=(b.y-a.y)*height;
    const fraction=Math.max(0,Math.min(1,((center.x-a.x)*width*dx+(center.y-a.y)*height*dy)/(dx*dx+dy*dy)));
    return Math.hypot((center.x-a.x)*width-dx*fraction,(center.y-a.y)*height-dy*fraction)<r;
  });
}
