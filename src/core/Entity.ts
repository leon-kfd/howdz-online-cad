import { Point, BoundingBox } from './types';
import { Viewport } from './Viewport';

/** 实体类型 */
export type EntityType = 'line' | 'circle' | 'arc';

/** 实体基类接口 */
export interface EntityData {
  id: string;
  type: EntityType;
  layer: string;
  color: string | null;  // null表示随图层颜色
  visible: boolean;
  locked: boolean;
}

/** 夹点 */
export interface GripPoint {
  point: Point;
  type: 'endpoint' | 'midpoint' | 'center' | 'quadrant';
  entity: Entity;
}

/**
 * 实体基类
 */
export abstract class Entity implements EntityData {
  public id: string;
  public type: EntityType;
  public layer: string;
  public color: string | null;
  public visible: boolean;
  public locked: boolean;

  constructor(type: EntityType, id?: string) {
    this.id = id || this.generateId();
    this.type = type;
    this.layer = '0';
    this.color = null;
    this.visible = true;
    this.locked = false;
  }

  private generateId(): string {
    return 'ent_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** 获取实体的包围盒 */
  public abstract getBoundingBox(): BoundingBox;

  /** 获取夹点列表 */
  public abstract getGripPoints(): Point[];

  /** 在Canvas上绘制实体 */
  public abstract draw(ctx: CanvasRenderingContext2D, viewport: Viewport, selected: boolean): void;

  /** 判断点是否在实体上（用于选择） */
  public abstract hitTest(worldX: number, worldY: number, tolerance: number): boolean;

  /** 移动实体 */
  public abstract move(dx: number, dy: number): void;

  /** 通过夹点修改实体 */
  public abstract moveGripPoint(gripIndex: number, newX: number, newY: number): void;

  /** 克隆实体 */
  public abstract clone(): Entity;
}

/**
 * 直线实体
 */
export class LineEntity extends Entity {
  public startX: number;
  public startY: number;
  public endX: number;
  public endY: number;

  constructor(startX: number, startY: number, endX: number, endY: number, id?: string) {
    super('line', id);
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
  }

  public getBoundingBox(): BoundingBox {
    return {
      minX: Math.min(this.startX, this.endX),
      minY: Math.min(this.startY, this.endY),
      maxX: Math.max(this.startX, this.endX),
      maxY: Math.max(this.startY, this.endY),
    };
  }

  public getGripPoints(): Point[] {
    return [
      { x: this.startX, y: this.startY },                         // 起点
      { x: this.endX, y: this.endY },                             // 终点
      { x: (this.startX + this.endX) / 2, y: (this.startY + this.endY) / 2 }, // 中点
    ];
  }

  public draw(ctx: CanvasRenderingContext2D, viewport: Viewport, selected: boolean): void {
    const p1 = viewport.worldToScreen(this.startX, this.startY);
    const p2 = viewport.worldToScreen(this.endX, this.endY);

    ctx.strokeStyle = this.color || '#e0e0e0';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // 选中时绘制夹点
    if (selected) {
      this.drawGripPoints(ctx, viewport);
    }
  }

  private drawGripPoints(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const grips = this.getGripPoints();
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    for (const grip of grips) {
      const sp = viewport.worldToScreen(grip.x, grip.y);
      ctx.beginPath();
      ctx.rect(sp.x - 4, sp.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  public hitTest(worldX: number, worldY: number, tolerance: number): boolean {
    // 点到线段的距离
    const dx = this.endX - this.startX;
    const dy = this.endY - this.startY;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      // 起点终点相同，退化为点
      const d = Math.hypot(worldX - this.startX, worldY - this.startY);
      return d <= tolerance;
    }

    // 计算投影参数 t
    let t = ((worldX - this.startX) * dx + (worldY - this.startY) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    // 投影点
    const projX = this.startX + t * dx;
    const projY = this.startY + t * dy;

    const dist = Math.hypot(worldX - projX, worldY - projY);
    return dist <= tolerance;
  }

  public move(dx: number, dy: number): void {
    this.startX += dx;
    this.startY += dy;
    this.endX += dx;
    this.endY += dy;
  }

  public moveGripPoint(gripIndex: number, newX: number, newY: number): void {
    switch (gripIndex) {
      case 0: // 起点
        this.startX = newX;
        this.startY = newY;
        break;
      case 1: // 终点
        this.endX = newX;
        this.endY = newY;
        break;
      case 2: // 中点 - 整体移动
        {
          const midX = (this.startX + this.endX) / 2;
          const midY = (this.startY + this.endY) / 2;
          const dx = newX - midX;
          const dy = newY - midY;
          this.move(dx, dy);
        }
        break;
    }
  }

  public clone(): LineEntity {
    const copy = new LineEntity(this.startX, this.startY, this.endX, this.endY);
    copy.layer = this.layer;
    copy.color = this.color;
    copy.visible = this.visible;
    copy.locked = this.locked;
    return copy;
  }

  /** 获取直线长度 */
  public getLength(): number {
    return Math.hypot(this.endX - this.startX, this.endY - this.startY);
  }

  /** 获取直线角度（弧度） */
  public getAngle(): number {
    return Math.atan2(this.endY - this.startY, this.endX - this.startX);
  }
}

/**
 * 圆形实体
 */
export class CircleEntity extends Entity {
  public centerX: number;
  public centerY: number;
  public radius: number;

  constructor(centerX: number, centerY: number, radius: number, id?: string) {
    super('circle', id);
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
  }

  public getBoundingBox(): BoundingBox {
    return {
      minX: this.centerX - this.radius,
      minY: this.centerY - this.radius,
      maxX: this.centerX + this.radius,
      maxY: this.centerY + this.radius,
    };
  }

  public getGripPoints(): Point[] {
    return [
      { x: this.centerX, y: this.centerY },                           // 圆心
      { x: this.centerX + this.radius, y: this.centerY },             // 右象限点
      { x: this.centerX, y: this.centerY - this.radius },             // 上象限点
      { x: this.centerX - this.radius, y: this.centerY },             // 左象限点
      { x: this.centerX, y: this.centerY + this.radius },             // 下象限点
    ];
  }

  public draw(ctx: CanvasRenderingContext2D, viewport: Viewport, selected: boolean): void {
    const center = viewport.worldToScreen(this.centerX, this.centerY);
    const screenRadius = this.radius * viewport.scale;

    ctx.strokeStyle = this.color || '#e0e0e0';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.abs(screenRadius), 0, Math.PI * 2);
    ctx.stroke();

    // 选中时绘制夹点
    if (selected) {
      this.drawGripPoints(ctx, viewport);
    }
  }

  private drawGripPoints(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const grips = this.getGripPoints();
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    for (const grip of grips) {
      const sp = viewport.worldToScreen(grip.x, grip.y);
      ctx.beginPath();
      ctx.rect(sp.x - 4, sp.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  public hitTest(worldX: number, worldY: number, tolerance: number): boolean {
    const dist = Math.hypot(worldX - this.centerX, worldY - this.centerY);
    return Math.abs(dist - this.radius) <= tolerance;
  }

  public move(dx: number, dy: number): void {
    this.centerX += dx;
    this.centerY += dy;
  }

  public moveGripPoint(gripIndex: number, newX: number, newY: number): void {
    switch (gripIndex) {
      case 0: // 圆心 - 整体移动
        {
          const dx = newX - this.centerX;
          const dy = newY - this.centerY;
          this.move(dx, dy);
        }
        break;
      case 1: // 右象限点 - 调整半径
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        break;
      case 2: // 上象限点
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        break;
      case 3: // 左象限点
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        break;
      case 4: // 下象限点
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        break;
    }
  }

  public clone(): CircleEntity {
    const copy = new CircleEntity(this.centerX, this.centerY, this.radius);
    copy.layer = this.layer;
    copy.color = this.color;
    copy.visible = this.visible;
    copy.locked = this.locked;
    return copy;
  }

  /** 获取圆的周长 */
  public getCircumference(): number {
    return 2 * Math.PI * this.radius;
  }

  /** 获取圆的面积 */
  public getArea(): number {
    return Math.PI * this.radius * this.radius;
  }
}

/**
 * 圆弧实体
 * 使用圆心、半径、起始角度和终止角度表示
 * 角度采用数学坐标系（逆时针为正），单位为弧度
 * 圆弧从 startAngle 逆时针绘制到 endAngle
 */
export class ArcEntity extends Entity {
  public centerX: number;
  public centerY: number;
  public radius: number;
  /** 起始角度（弧度，数学坐标系） */
  public startAngle: number;
  /** 终止角度（弧度，数学坐标系），圆弧从startAngle逆时针到endAngle */
  public endAngle: number;

  constructor(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    id?: string,
  ) {
    super('arc', id);
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
  }

  public getBoundingBox(): BoundingBox {
    // 收集弧上可能的极值角度（0, π/2, π, 3π/2）
    const candidates = [this.startAngle, this.endAngle];
    const step = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const a = step * i;
      if (this.isAngleInArc(a)) {
        candidates.push(a);
      }
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const a of candidates) {
      const x = this.centerX + this.radius * Math.cos(a);
      const y = this.centerY + this.radius * Math.sin(a);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return { minX, minY, maxX, maxY };
  }

  public getGripPoints(): Point[] {
    return [
      this.getStartPoint(),           // 起点
      this.getEndPoint(),             // 终点
      this.getMidPoint(),             // 中点
      { x: this.centerX, y: this.centerY }, // 圆心
    ];
  }

  public draw(ctx: CanvasRenderingContext2D, viewport: Viewport, selected: boolean): void {
    const center = viewport.worldToScreen(this.centerX, this.centerY);
    const screenRadius = this.radius * viewport.scale;

    ctx.strokeStyle = this.color || '#e0e0e0';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    // Canvas Y轴翻转，传入数学角度并使用 counterclockwise=true
    // 屏幕上视觉效果与数学坐标系一致（逆时针）
    ctx.arc(
      center.x,
      center.y,
      Math.abs(screenRadius),
      this.startAngle,
      this.endAngle,
      true, // counterclockwise
    );
    ctx.stroke();

    if (selected) {
      this.drawGripPoints(ctx, viewport);
    }
  }

  private drawGripPoints(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const grips = this.getGripPoints();
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    for (const grip of grips) {
      const sp = viewport.worldToScreen(grip.x, grip.y);
      ctx.beginPath();
      ctx.rect(sp.x - 4, sp.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  public hitTest(worldX: number, worldY: number, tolerance: number): boolean {
    const dist = Math.hypot(worldX - this.centerX, worldY - this.centerY);
    if (Math.abs(dist - this.radius) > tolerance) return false;

    const angle = Math.atan2(worldY - this.centerY, worldX - this.centerX);
    return this.isAngleInArc(angle);
  }

  public move(dx: number, dy: number): void {
    this.centerX += dx;
    this.centerY += dy;
  }

  public moveGripPoint(gripIndex: number, newX: number, newY: number): void {
    switch (gripIndex) {
      case 0: // 起点 - 调整半径和起始角度
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        this.startAngle = Math.atan2(newY - this.centerY, newX - this.centerX);
        break;
      case 1: // 终点 - 调整半径和终止角度
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        this.endAngle = Math.atan2(newY - this.centerY, newX - this.centerX);
        break;
      case 2: // 中点 - 调整半径
        this.radius = Math.hypot(newX - this.centerX, newY - this.centerY);
        break;
      case 3: // 圆心 - 整体移动
        {
          const dx = newX - this.centerX;
          const dy = newY - this.centerY;
          this.move(dx, dy);
        }
        break;
    }
  }

  public clone(): ArcEntity {
    const copy = new ArcEntity(
      this.centerX,
      this.centerY,
      this.radius,
      this.startAngle,
      this.endAngle,
    );
    copy.layer = this.layer;
    copy.color = this.color;
    copy.visible = this.visible;
    copy.locked = this.locked;
    return copy;
  }

  /** 获取圆弧的中点 */
  public getMidPoint(): Point {
    const midAngle = this.startAngle + this.getArcAngle() / 2;
    return {
      x: this.centerX + this.radius * Math.cos(midAngle),
      y: this.centerY + this.radius * Math.sin(midAngle),
    };
  }

  /** 获取圆弧的起点 */
  public getStartPoint(): Point {
    return {
      x: this.centerX + this.radius * Math.cos(this.startAngle),
      y: this.centerY + this.radius * Math.sin(this.startAngle),
    };
  }

  /** 获取圆弧的终点 */
  public getEndPoint(): Point {
    return {
      x: this.centerX + this.radius * Math.cos(this.endAngle),
      y: this.centerY + this.radius * Math.sin(this.endAngle),
    };
  }

  /**
   * 获取圆弧的弧度（总是正值，范围 [0, 2π)）
   */
  public getArcAngle(): number {
    let sweep = this.endAngle - this.startAngle;
    if (sweep < 0) sweep += 2 * Math.PI;
    return sweep;
  }

  /**
   * 判断一个角度是否在圆弧范围内
   * 角度应为 atan2 返回的值（范围 [-π, π]）
   */
  private isAngleInArc(angle: number): boolean {
    // 将所有角度转换到 [0, 2π) 范围
    const normalize = (a: number): number => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const a = normalize(angle);
    const start = normalize(this.startAngle);
    const end = normalize(this.endAngle);

    if (start <= end) {
      return a >= start && a <= end;
    } else {
      // 跨越 0/2π 边界
      return a >= start || a <= end;
    }
  }

  /**
   * 从三个点计算圆弧（三点定弧）
   * 第一个点和第三个点是端点，第二个点是弧上的经过点
   * @returns ArcEntity 或 null（三点共线时）
   */
  public static computeArcFromThreePoints(
    p1: Point,
    p2: Point,
    p3: Point,
  ): ArcEntity | null {
    // 计算外接圆圆心（垂直平分线交点）
    const ax = p1.x;
    const ay = p1.y;
    const bx = p2.x;
    const by = p2.y;
    const cx = p3.x;
    const cy = p3.y;

    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-10) return null; // 三点共线

    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;

    const radius = Math.hypot(ax - ux, ay - uy);

    // 计算各点相对圆心的角度
    const angle1 = Math.atan2(ay - uy, ax - ux);
    const angle3 = Math.atan2(cy - uy, cx - ux);

    // 确定方向：使弧经过B点
    // 叉积 (P1-C) × (P3-C) > 0 表示逆时针
    const cross = (p1.x - ux) * (p3.y - uy) - (p1.y - uy) * (p3.x - ux);

    let startAngle: number;
    let endAngle: number;

    if (cross > 0) {
      // 逆时针：从P1到P3
      startAngle = angle1;
      endAngle = angle3;
    } else {
      // 顺时针：交换使弧仍然逆时针绘制，但覆盖另一侧
      startAngle = angle3;
      endAngle = angle1;
    }

    return new ArcEntity(ux, uy, radius, startAngle, endAngle);
  }
}
