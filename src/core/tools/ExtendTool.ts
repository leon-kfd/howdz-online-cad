import { BaseTool, ToolContext } from './Tool';
import { Entity, LineEntity, CircleEntity, ArcEntity } from '../Entity';
import { EntityManager } from '../EntityManager';
import { Point, MouseButton } from '../types';

/**
 * 计算直线-直线交点（无限直线）
 * @returns 交点或 null（平行）
 */
function lineLineIntersection(
  p1: Point, d1: Point,
  p2: Point, d2: Point,
): Point | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-10) return null;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / cross;
  return {
    x: p1.x + t * d1.x,
    y: p1.y + t * d1.y,
  };
}

/**
 * 计算直线与圆的交点
 * @param lineStart 直线起点
 * @param lineDir 直线方向向量（不需要归一化）
 * @param circleCenter 圆心
 * @param radius 半径
 * @returns 交点列表（0-2个）
 */
function lineCircleIntersections(
  lineStart: Point,
  lineDir: Point,
  circleCenter: Point,
  radius: number,
): Point[] {
  const EPS = 1e-10;
  const dx = lineDir.x;
  const dy = lineDir.y;
  const fx = lineStart.x - circleCenter.x;
  const fy = lineStart.y - circleCenter.y;

  const a = dx * dx + dy * dy;
  if (a < EPS) return [];

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;

  if (disc < -EPS) return [];
  if (disc < 0) return [];

  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  const results: Point[] = [];

  const t1 = (-b + sqrtDisc) / (2 * a);
  results.push({
    x: lineStart.x + t1 * dx,
    y: lineStart.y + t1 * dy,
  });

  if (sqrtDisc > EPS) {
    const t2 = (-b - sqrtDisc) / (2 * a);
    results.push({
      x: lineStart.x + t2 * dx,
      y: lineStart.y + t2 * dy,
    });
  }

  return results;
}

/**
 * 延伸工具
 * 支持将线段延伸到指定边界（直线或圆弧）
 */
export class ExtendTool extends BaseTool {
  public readonly name = 'extend';

  private entityManager: EntityManager;

  /** 边界实体 */
  private boundary: Entity | null = null;

  constructor(entityManager: EntityManager) {
    super();
    this.entityManager = entityManager;
  }

  public onActivate(): void {
    this.boundary = null;
  }

  public onDeactivate(): void {
    this.boundary = null;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    const tolerance = 5 / ctx.scale;
    const hits = this.entityManager.hitTest(ctx.mouseWorld.x, ctx.mouseWorld.y, tolerance);
    if (hits.length === 0) return;

    const entity = hits[0];

    if (!this.boundary) {
      // 第一次点击：选择边界
      this.boundary = entity;
    } else if (entity !== this.boundary) {
      // 第二次点击：选择要延伸的实体
      this.executeExtend(entity);
    }
  }

  public onMouseMove(_ctx: ToolContext, _e: MouseEvent): void {
    // 预览暂不实现
  }

  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {}

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.boundary = null;
    }
  }

  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (!this.boundary) return;

    // 高亮边界实体
    const grips = this.boundary.getGripPoints();
    if (grips.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sp = viewport.worldToScreen(grips[0].x, grips[0].y);
      ctx.moveTo(sp.x, sp.y);
      for (let i = 1; i < grips.length; i++) {
        const p = viewport.worldToScreen(grips[i].x, grips[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  /**
   * 执行延伸操作
   */
  private executeExtend(entity: Entity): void {
    if (!this.boundary) return;

    if (entity.type === 'line') {
      this.extendLine(entity as LineEntity, this.boundary);
    } else if (entity.type === 'arc') {
      this.extendArc(entity as ArcEntity, this.boundary);
    }

    // 重置，允许继续延伸
    this.boundary = null;
  }

  /**
   * 延伸直线到边界
   */
  private extendLine(line: LineEntity, boundary: Entity): void {
    const endpoints = [
      { x: line.startX, y: line.startY },
      { x: line.endX, y: line.endY },
    ];

    // 找到离边界更近的端点
    let nearIdx = 0;
    let nearDist = Infinity;
    for (let i = 0; i < 2; i++) {
      const dist = this.pointToEntityDistance(endpoints[i], boundary);
      if (dist < nearDist) {
        nearDist = dist;
        nearIdx = i;
      }
    }

    const ep = endpoints[nearIdx];

    if (boundary.type === 'line') {
      this.extendLineToLine(line, nearIdx, boundary as LineEntity);
    } else if (boundary.type === 'circle' || boundary.type === 'arc') {
      const center = boundary.type === 'circle'
        ? { x: (boundary as CircleEntity).centerX, y: (boundary as CircleEntity).centerY }
        : { x: (boundary as ArcEntity).centerX, y: (boundary as ArcEntity).centerY };
      const radius = boundary.type === 'circle'
        ? (boundary as CircleEntity).radius
        : (boundary as ArcEntity).radius;

      const dir: Point = {
        x: line.endX - line.startX,
        y: line.endY - line.startY,
      };

      const intersections = lineCircleIntersections(ep, dir, center, radius);
      if (intersections.length === 0) return;

      // 过滤圆弧：只保留弧上的点
      let validPoints = intersections;
      if (boundary.type === 'arc') {
        const arc = boundary as ArcEntity;
        validPoints = intersections.filter(p => this.isPointOnArc(p, arc));
      }

      if (validPoints.length === 0) return;

      // 选择最近的交点
      let best = validPoints[0];
      let bestDist = Math.hypot(best.x - ep.x, best.y - ep.y);
      for (let i = 1; i < validPoints.length; i++) {
        const d = Math.hypot(validPoints[i].x - ep.x, validPoints[i].y - ep.y);
        if (d < bestDist) {
          bestDist = d;
          best = validPoints[i];
        }
      }

      // 移动端点
      if (nearIdx === 0) {
        line.startX = best.x;
        line.startY = best.y;
      } else {
        line.endX = best.x;
        line.endY = best.y;
      }
    }
  }

  /**
   * 延伸直线到直线边界
   */
  private extendLineToLine(line: LineEntity, nearIdx: number, boundary: LineEntity): void {
    const d1: Point = {
      x: line.endX - line.startX,
      y: line.endY - line.startY,
    };
    const d2: Point = {
      x: boundary.endX - boundary.startX,
      y: boundary.endY - boundary.startY,
    };

    const I = lineLineIntersection(
      { x: line.startX, y: line.startY }, d1,
      { x: boundary.startX, y: boundary.startY }, d2,
    );

    if (!I) return; // 平行线

    // 移动离边界更近的端点到交点
    if (nearIdx === 0) {
      line.startX = I.x;
      line.startY = I.y;
    } else {
      line.endX = I.x;
      line.endY = I.y;
    }
  }

  /**
   * 延伸圆弧到边界
   */
  private extendArc(arc: ArcEntity, boundary: Entity): void {
    const startPt = arc.getStartPoint();
    const endPt = arc.getEndPoint();
    const startDist = this.pointToEntityDistance(startPt, boundary);
    const endDist = this.pointToEntityDistance(endPt, boundary);

    const nearStart = startDist <= endDist;

    if (boundary.type === 'line') {
      this.extendArcToLine(arc, nearStart, boundary as LineEntity);
    } else if (boundary.type === 'circle' || boundary.type === 'arc') {
      const center = boundary.type === 'circle'
        ? { x: (boundary as CircleEntity).centerX, y: (boundary as CircleEntity).centerY }
        : { x: (boundary as ArcEntity).centerX, y: (boundary as ArcEntity).centerY };
      const radius = boundary.type === 'circle'
        ? (boundary as CircleEntity).radius
        : (boundary as ArcEntity).radius;

      // 圆-圆交点
      const intersections = this.circleCircleIntersections(
        { x: arc.centerX, y: arc.centerY }, arc.radius,
        center, radius,
      );

      if (intersections.length === 0) return;

      // 过滤圆弧边界
      let validPoints = intersections;
      if (boundary.type === 'arc') {
        const bArc = boundary as ArcEntity;
        validPoints = intersections.filter(p => this.isPointOnArc(p, bArc));
      }

      if (validPoints.length === 0) return;

      // 选择最近的交点
      const refPt = nearStart ? startPt : endPt;
      let best = validPoints[0];
      let bestDist = Math.hypot(best.x - refPt.x, best.y - refPt.y);
      for (let i = 1; i < validPoints.length; i++) {
        const d = Math.hypot(validPoints[i].x - refPt.x, validPoints[i].y - refPt.y);
        if (d < bestDist) {
          bestDist = d;
          best = validPoints[i];
        }
      }

      // 延伸圆弧端点
      const newAngle = Math.atan2(best.y - arc.centerY, best.x - arc.centerX);
      if (nearStart) {
        arc.startAngle = newAngle;
      } else {
        arc.endAngle = newAngle;
      }
    }
  }

  /**
   * 延伸圆弧到直线边界
   */
  private extendArcToLine(arc: ArcEntity, nearStart: boolean, boundary: LineEntity): void {
    const d: Point = {
      x: boundary.endX - boundary.startX,
      y: boundary.endY - boundary.startY,
    };

    const intersections = lineCircleIntersections(
      { x: boundary.startX, y: boundary.startY },
      d,
      { x: arc.centerX, y: arc.centerY },
      arc.radius,
    );

    if (intersections.length === 0) return;

    const refPt = nearStart ? arc.getStartPoint() : arc.getEndPoint();

    // 选择最近的交点
    let best = intersections[0];
    let bestDist = Math.hypot(best.x - refPt.x, best.y - refPt.y);
    for (let i = 1; i < intersections.length; i++) {
      const dist = Math.hypot(intersections[i].x - refPt.x, intersections[i].y - refPt.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = intersections[i];
      }
    }

    const newAngle = Math.atan2(best.y - arc.centerY, best.x - arc.centerX);
    if (nearStart) {
      arc.startAngle = newAngle;
    } else {
      arc.endAngle = newAngle;
    }
  }

  /**
   * 计算两个圆的交点
   */
  private circleCircleIntersections(
    c1: Point, r1: number,
    c2: Point, r2: number,
  ): Point[] {
    const EPS = 1e-10;
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);

    if (d < EPS) return [];
    if (d > r1 + r2 + EPS) return [];
    if (d < Math.abs(r1 - r2) - EPS) return [];

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    if (h2 < -EPS) return [];
    const h = Math.sqrt(Math.max(0, h2));

    const mx = c1.x + a * (dx / d);
    const my = c1.y + a * (dy / d);

    const results: Point[] = [{
      x: mx + h * (dy / d),
      y: my - h * (dx / d),
    }];

    if (h > EPS) {
      results.push({
        x: mx - h * (dy / d),
        y: my + h * (dx / d),
      });
    }

    return results;
  }

  /**
   * 判断点是否在圆弧上
   */
  private isPointOnArc(point: Point, arc: ArcEntity): boolean {
    const angle = Math.atan2(point.y - arc.centerY, point.x - arc.centerX);
    const normalize = (a: number): number => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const a = normalize(angle);
    const start = normalize(arc.startAngle);
    const end = normalize(arc.endAngle);

    if (start <= end) {
      return a >= start && a <= end;
    } else {
      return a >= start || a <= end;
    }
  }

  /**
   * 计算点到实体的近似距离
   */
  private pointToEntityDistance(point: Point, entity: Entity): number {
    if (entity.type === 'line') {
      const line = entity as LineEntity;
      return this.pointToSegmentDistance(
        point,
        { x: line.startX, y: line.startY },
        { x: line.endX, y: line.endY },
      );
    } else if (entity.type === 'circle') {
      const circle = entity as CircleEntity;
      const d = Math.hypot(point.x - circle.centerX, point.y - circle.centerY);
      return Math.abs(d - circle.radius);
    } else if (entity.type === 'arc') {
      const arc = entity as ArcEntity;
      const d = Math.hypot(point.x - arc.centerX, point.y - arc.centerY);
      const circDist = Math.abs(d - arc.radius);
      if (this.isPointOnArc(point, arc)) {
        return circDist;
      }
      // 不在弧上，返回到端点的最小距离
      const sp = arc.getStartPoint();
      const ep = arc.getEndPoint();
      return Math.min(
        Math.hypot(point.x - sp.x, point.y - sp.y),
        Math.hypot(point.x - ep.x, point.y - ep.y),
      );
    }
    return Infinity;
  }

  /**
   * 计算点到线段的距离
   */
  private pointToSegmentDistance(point: Point, segStart: Point, segEnd: Point): number {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return Math.hypot(point.x - segStart.x, point.y - segStart.y);
    }

    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = segStart.x + t * dx;
    const projY = segStart.y + t * dy;

    return Math.hypot(point.x - projX, point.y - projY);
  }

  /**
   * 解析 EXTEND 命令行参数
   * EXTEND 没有参数，仅切换工具
   */
  public static parseCommandLine(input: string): boolean {
    return input.trim() === '';
  }
}
