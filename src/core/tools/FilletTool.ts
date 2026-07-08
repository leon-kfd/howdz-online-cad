import { BaseTool, ToolContext } from './Tool';
import { Entity, LineEntity, ArcEntity } from '../Entity';
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
 * 计算直线-直线倒圆角
 * @returns 圆弧实体和两个切点，或 null（平行线）
 */
export function computeLineLineFillet(
  line1: LineEntity,
  line2: LineEntity,
  radius: number,
): { arc: ArcEntity; t1: Point; t2: Point } | null {
  const EPS = 1e-10;

  // 原始方向向量
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
  const u1raw: Point = { x: d1.x / len1, y: d1.y / len1 };
  const u2raw: Point = { x: d2.x / len2, y: d2.y / len2 };

  // 交点
  const I = lineLineIntersection(
    { x: line1.startX, y: line1.startY }, u1raw,
    { x: line2.startX, y: line2.startY }, u2raw,
  );
  if (!I) return null; // 平行线

  // 调整方向：使方向向量都指向远离交点的方向（即沿射线方向）
  // 判断依据：选择离交点更远的端点作为"远端点"，方向向量应指向远端点
  const farDist1S = Math.hypot(line1.startX - I.x, line1.startY - I.y);
  const farDist1E = Math.hypot(line1.endX - I.x, line1.endY - I.y);
  const far1: Point = farDist1E >= farDist1S
    ? { x: line1.endX - I.x, y: line1.endY - I.y }
    : { x: line1.startX - I.x, y: line1.startY - I.y };

  const farDist2S = Math.hypot(line2.startX - I.x, line2.startY - I.y);
  const farDist2E = Math.hypot(line2.endX - I.x, line2.endY - I.y);
  const far2: Point = farDist2E >= farDist2S
    ? { x: line2.endX - I.x, y: line2.endY - I.y }
    : { x: line2.startX - I.x, y: line2.startY - I.y };

  const dot1 = u1raw.x * far1.x + u1raw.y * far1.y;
  const dot2 = u2raw.x * far2.x + u2raw.y * far2.y;

  const u1: Point = dot1 < 0 ? { x: -u1raw.x, y: -u1raw.y } : u1raw;
  const u2: Point = dot2 < 0 ? { x: -u2raw.x, y: -u2raw.y } : u2raw;

  // 两线夹角（锐角）
  const cosAngle = Math.abs(u1.x * u2.x + u1.y * u2.y);
  const theta = Math.acos(Math.min(1, cosAngle));

  if (theta < EPS || Math.abs(theta - Math.PI) < EPS) return null; // 平行或反向平行

  // 切点到交点的距离
  const d = radius / Math.tan(theta / 2);

  // 切点（沿各线从交点出发）
  const T1: Point = { x: I.x + d * u1.x, y: I.y + d * u1.y };
  const T2: Point = { x: I.x + d * u2.x, y: I.y + d * u2.y };

  // 倒圆角圆心：沿角平分线，距离 = R / sin(θ/2)
  const bisectorX = u1.x + u2.x;
  const bisectorY = u1.y + u2.y;
  const bisectorLen = Math.hypot(bisectorX, bisectorY);
  if (bisectorLen < EPS) return null;

  const b: Point = {
    x: bisectorX / bisectorLen,
    y: bisectorY / bisectorLen,
  };
  const centerDist = radius / Math.sin(theta / 2);
  const C: Point = { x: I.x + centerDist * b.x, y: I.y + centerDist * b.y };

  // 计算圆弧角度
  const angle1 = Math.atan2(T1.y - C.y, T1.x - C.x);
  const angle2 = Math.atan2(T2.y - C.y, T2.x - C.x);

  // 叉积判断方向
  const v1x = T1.x - C.x;
  const v1y = T1.y - C.y;
  const v2x = T2.x - C.x;
  const v2y = T2.y - C.y;
  const cross = v1x * v2y - v1y * v2x;

  // 根据叉积方向确定圆弧方向
  // Canvas Y轴翻转：canvas逆时针(anticlockwise=true)对应数学坐标系的顺时针
  // 我们需要绘制较小的弧（minor arc，角度<π）
  // 根据叉积确定canvas绘制方向：
  // cross > 0: T2在T1的数学逆时针方向 → canvas顺时针绘制(anticlockwise=false)得到minor arc
  // cross < 0: T2在T1的数学顺时针方向 → canvas逆时针绘制(anticlockwise=true)得到minor arc
  const startAngle = angle1;
  const endAngle = angle2;
  const counterclockwise = cross < 0;

  return {
    arc: new ArcEntity(C.x, C.y, radius, startAngle, endAngle, counterclockwise),
    t1: T1,
    t2: T2,
  };
}

/**
 * 用切点裁剪/延伸直线
 * 将离交点更近的端点替换为切点
 */
function trimLineToTangent(line: LineEntity, tangent: Point, intersection: Point): void {
  const distStart = Math.hypot(line.startX - intersection.x, line.startY - intersection.y);
  const distEnd = Math.hypot(line.endX - intersection.x, line.endY - intersection.y);

  if (distStart <= distEnd) {
    line.startX = tangent.x;
    line.startY = tangent.y;
  } else {
    line.endX = tangent.x;
    line.endY = tangent.y;
  }
}

/**
 * 倒圆角工具
 * 支持对两条线段进行倒圆角处理，自动生成圆弧连接
 */
export class FilletTool extends BaseTool {
  public readonly name = 'fillet';

  private entityManager: EntityManager;
  private onEntityCreated: ((entity: Entity) => void) | null = null;

  /** 倒圆角半径，默认 10 */
  private filletRadius: number = 10;

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
    if (entity.type !== 'line') return; // MVP: 仅支持直线

    if (!this.edge1) {
      this.edge1 = entity;
    } else if (!this.edge2 && entity !== this.edge1) {
      this.edge2 = entity;
      this.executeFillet();
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
   * 执行倒圆角操作
   */
  private executeFillet(): void {
    if (!this.edge1 || !this.edge2) return;

    const result = this.filletTwoEdges(this.edge1, this.edge2);
    if (!result) {
      // 倒圆角失败（平行线等）
      this.edge1 = null;
      this.edge2 = null;
      return;
    }

    // 添加新圆弧
    this.onEntityCreated?.(result.arc);

    // 重置选择，允许继续倒圆角
    this.edge1 = null;
    this.edge2 = null;
  }

  /**
   * 对两条边执行倒圆角
   */
  private filletTwoEdges(e1: Entity, e2: Entity): { arc: ArcEntity } | null {
    if (e1.type === 'line' && e2.type === 'line') {
      return this.filletLineLine(e1 as LineEntity, e2 as LineEntity);
    }
    // 未来可扩展 line-arc, arc-arc
    return null;
  }

  /**
   * 直线-直线倒圆角
   */
  private filletLineLine(line1: LineEntity, line2: LineEntity): { arc: ArcEntity } | null {
    const R = this.filletRadius;
    if (R <= 0) return null;

    const fillet = computeLineLineFillet(line1, line2, R);
    if (!fillet) return null;

    // 计算两线交点用于裁剪
    const d1: Point = {
      x: line1.endX - line1.startX,
      y: line1.endY - line1.startY,
    };
    const d2: Point = {
      x: line2.endX - line2.startX,
      y: line2.endY - line2.startY,
    };
    const I = lineLineIntersection(
      { x: line1.startX, y: line1.startY }, d1,
      { x: line2.startX, y: line2.startY }, d2,
    );

    if (I) {
      trimLineToTangent(line1, fillet.t1, I);
      trimLineToTangent(line2, fillet.t2, I);
    }

    return { arc: fillet.arc };
  }

  /**
   * 设置倒圆角半径
   */
  public setRadius(radius: number): void {
    this.filletRadius = Math.max(0.01, radius);
  }

  /**
   * 获取当前倒圆角半径
   */
  public getRadius(): number {
    return this.filletRadius;
  }

  /**
   * 解析 FILLET 命令行参数
   * 格式: R <radius> （设置半径）
   */
  public static parseCommandLine(input: string): { radius: number } | null {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return null;

    // FILLET R <radius>
    const rMatch = trimmed.match(/^R\s+([0-9]*\.?[0-9]+)$/);
    if (rMatch) {
      const r = parseFloat(rMatch[1]);
      if (r > 0 && isFinite(r)) return { radius: r };
    }

    return null;
  }
}
