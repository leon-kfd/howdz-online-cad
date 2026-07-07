import { BaseTool, ToolContext } from './Tool';
import { Entity, LineEntity } from '../Entity';
import { EntityManager } from '../EntityManager';
import { Point, MouseButton } from '../types';

/**
 * 计算两条无限直线的交点
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
 * 计算直线-直线倒角
 * 返回倒角线段的两端点（两条线上各一个切点）
 * @returns 两个切点或 null（平行线/退化情况）
 */
export function computeLineLineChamfer(
  line1: LineEntity,
  line2: LineEntity,
  dist1: number,
  dist2: number,
): { p1: Point; p2: Point } | null {
  const EPS = 1e-10;

  // 方向向量
  const d1: Point = {
    x: line1.endX - line1.startX,
    y: line1.endY - line1.startY,
  };
  const d2: Point = {
    x: line2.endX - line2.startX,
    y: line2.endY - line2.startY,
  };

  const len1 = Math.hypot(d1.x, d1.y);
  const len2 = Math.hypot(d2.x, d2.y);
  if (len1 < EPS || len2 < EPS) return null;

  // 单位方向向量
  const u1: Point = { x: d1.x / len1, y: d1.y / len1 };
  const u2: Point = { x: d2.x / len2, y: d2.y / len2 };

  // 交点
  const I = lineLineIntersection(
    { x: line1.startX, y: line1.startY }, u1,
    { x: line2.startX, y: line2.startY }, u2,
  );
  if (!I) return null; // 平行线

  // 两线夹角（检查是否平行或反向平行）
  const cosAngle = Math.abs(u1.x * u2.x + u1.y * u2.y);
  const theta = Math.acos(Math.min(1, cosAngle));
  if (theta < EPS || Math.abs(theta - Math.PI) < EPS) return null;

  // 确定各线从交点出发朝向"被裁剪端"的方向
  const distStart1 = Math.hypot(line1.startX - I.x, line1.startY - I.y);
  const distEnd1 = Math.hypot(line1.endX - I.x, line1.endY - I.y);
  const dir1: Point = distStart1 <= distEnd1
    ? { x: u1.x, y: u1.y }
    : { x: -u1.x, y: -u1.y };

  const distStart2 = Math.hypot(line2.startX - I.x, line2.startY - I.y);
  const distEnd2 = Math.hypot(line2.endX - I.x, line2.endY - I.y);
  const dir2: Point = distStart2 <= distEnd2
    ? { x: u2.x, y: u2.y }
    : { x: -u2.x, y: -u2.y };

  // 切点：从交点沿裁剪方向偏移距离 dist1 / dist2
  const C1: Point = { x: I.x + dist1 * dir1.x, y: I.y + dist1 * dir1.y };
  const C2: Point = { x: I.x + dist2 * dir2.x, y: I.y + dist2 * dir2.y };

  return { p1: C1, p2: C2 };
}

/**
 * 用切点裁剪/延伸直线
 * 将离交点更近的端点替换为切点
 */
function trimLineToChamfer(line: LineEntity, chamferPt: Point, intersection: Point): void {
  const distStart = Math.hypot(line.startX - intersection.x, line.startY - intersection.y);
  const distEnd = Math.hypot(line.endX - intersection.x, line.endY - intersection.y);

  if (distStart <= distEnd) {
    line.startX = chamferPt.x;
    line.startY = chamferPt.y;
  } else {
    line.endX = chamferPt.x;
    line.endY = chamferPt.y;
  }
}

/**
 * 倒角工具
 * 支持对两条线段进行倒角处理，自动生成直线连接
 * 支持等距倒角和不等距倒角（两个独立距离）
 */
export class ChamferTool extends BaseTool {
  public readonly name = 'chamfer';

  private entityManager: EntityManager;
  private onEntityCreated: ((entity: Entity) => void) | null = null;

  /** 倒角距离1（靠近第一条线的距离），默认 10 */
  private chamferDist1: number = 10;
  /** 倒角距离2（靠近第二条线的距离），默认 10 */
  private chamferDist2: number = 10;

  /** 当前选中的第一条边 */
  private edge1: Entity | null = null;
  /** 当前选中的第二条边 */
  private edge2: Entity | null = null;

  constructor(entityManager: EntityManager, onEntityCreated?: (entity: Entity) => void) {
    super();
    this.entityManager = entityManager;
    if (onEntityCreated) {
      this.onEntityCreated = onEntityCreated;
    }
  }

  public setEntityCreatedCallback(cb: (entity: Entity) => void): void {
    this.onEntityCreated = cb;
  }

  public onActivate(): void {
    this.edge1 = null;
    this.edge2 = null;
  }

  public onDeactivate(): void {
    this.edge1 = null;
    this.edge2 = null;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    const tolerance = 5 / ctx.scale;
    const hits = this.entityManager.hitTest(ctx.mouseWorld.x, ctx.mouseWorld.y, tolerance);
    if (hits.length === 0) return;

    const entity = hits[0];
    if (entity.type !== 'line') return;

    if (!this.edge1) {
      this.edge1 = entity;
    } else if (!this.edge2 && entity !== this.edge1) {
      this.edge2 = entity;
      this.executeChamfer();
    }
  }

  public onMouseMove(_ctx: ToolContext, _e: MouseEvent): void {
    // 预览暂不实现
  }

  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {}

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.edge1 = null;
      this.edge2 = null;
    }
  }

  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (!this.edge1) return;

    // 高亮第一条选中的边
    const grips = this.edge1.getGripPoints();
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
   * 执行倒角操作
   */
  private executeChamfer(): void {
    if (!this.edge1 || !this.edge2) return;

    const result = this.chamferTwoEdges(this.edge1, this.edge2);
    if (!result) {
      this.edge1 = null;
      this.edge2 = null;
      return;
    }

    // 添加新倒角线
    this.onEntityCreated?.(result.line);

    // 重置选择，允许继续倒角
    this.edge1 = null;
    this.edge2 = null;
  }

  /**
   * 对两条边执行倒角
   */
  private chamferTwoEdges(e1: Entity, e2: Entity): { line: LineEntity } | null {
    if (e1.type === 'line' && e2.type === 'line') {
      return this.chamferLineLine(e1 as LineEntity, e2 as LineEntity);
    }
    return null;
  }

  /**
   * 直线-直线倒角
   */
  private chamferLineLine(line1: LineEntity, line2: LineEntity): { line: LineEntity } | null {
    const d1 = this.chamferDist1;
    const d2 = this.chamferDist2;
    if (d1 <= 0 || d2 <= 0) return null;

    const chamfer = computeLineLineChamfer(line1, line2, d1, d2);
    if (!chamfer) return null;

    // 计算两线交点用于裁剪
    const dir1: Point = {
      x: line1.endX - line1.startX,
      y: line1.endY - line1.startY,
    };
    const dir2: Point = {
      x: line2.endX - line2.startX,
      y: line2.endY - line2.startY,
    };
    const I = lineLineIntersection(
      { x: line1.startX, y: line1.startY }, dir1,
      { x: line2.startX, y: line2.startY }, dir2,
    );

    if (I) {
      trimLineToChamfer(line1, chamfer.p1, I);
      trimLineToChamfer(line2, chamfer.p2, I);
    }

    return { line: new LineEntity(chamfer.p1.x, chamfer.p1.y, chamfer.p2.x, chamfer.p2.y) };
  }

  /**
   * 设置倒角距离（两个距离设为相同值）
   */
  public setDistance(dist: number): void {
    this.chamferDist1 = Math.max(0.01, dist);
    this.chamferDist2 = Math.max(0.01, dist);
  }

  /**
   * 设置第一个倒角距离
   */
  public setDistance1(dist: number): void {
    this.chamferDist1 = Math.max(0.01, dist);
  }

  /**
   * 设置第二个倒角距离
   */
  public setDistance2(dist: number): void {
    this.chamferDist2 = Math.max(0.01, dist);
  }

  /**
   * 获取当前倒角距离
   */
  public getDistances(): { dist1: number; dist2: number } {
    return { dist1: this.chamferDist1, dist2: this.chamferDist2 };
  }

  /**
   * 解析 CHAMFER 命令行参数
   * 格式:
   *   D <dist>           — 等距倒角
   *   D1 <dist>          — 设置第一个距离
   *   D2 <dist>          — 设置第二个距离
   *   D1 <d1> D2 <d2>    — 设置两个不同距离
   */
  public static parseCommandLine(input: string): { dist1?: number; dist2?: number; dist?: number } | null {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return null;

    // D <dist> — 等距倒角
    const dMatch = trimmed.match(/^D\s+([0-9]*\.?[0-9]+)$/);
    if (dMatch) {
      const d = parseFloat(dMatch[1]);
      if (d > 0 && isFinite(d)) return { dist: d };
    }

    // D1 <d1> D2 <d2>
    const d1d2Match = trimmed.match(/^D1\s+([0-9]*\.?[0-9]+)\s+D2\s+([0-9]*\.?[0-9]+)$/);
    if (d1d2Match) {
      const d1 = parseFloat(d1d2Match[1]);
      const d2 = parseFloat(d1d2Match[2]);
      if (d1 > 0 && isFinite(d1) && d2 > 0 && isFinite(d2)) return { dist1: d1, dist2: d2 };
    }

    // D2 <d2> D1 <d1>
    const d2d1Match = trimmed.match(/^D2\s+([0-9]*\.?[0-9]+)\s+D1\s+([0-9]*\.?[0-9]+)$/);
    if (d2d1Match) {
      const d2 = parseFloat(d2d1Match[1]);
      const d1 = parseFloat(d2d1Match[2]);
      if (d1 > 0 && isFinite(d1) && d2 > 0 && isFinite(d2)) return { dist1: d1, dist2: d2 };
    }

    // D1 <dist>
    const d1Match = trimmed.match(/^D1\s+([0-9]*\.?[0-9]+)$/);
    if (d1Match) {
      const d = parseFloat(d1Match[1]);
      if (d > 0 && isFinite(d)) return { dist1: d };
    }

    // D2 <dist>
    const d2Match = trimmed.match(/^D2\s+([0-9]*\.?[0-9]+)$/);
    if (d2Match) {
      const d = parseFloat(d2Match[1]);
      if (d > 0 && isFinite(d)) return { dist2: d };
    }

    return null;
  }
}
