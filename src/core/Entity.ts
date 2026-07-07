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
