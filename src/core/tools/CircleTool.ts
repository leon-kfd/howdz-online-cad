import { BaseTool, ToolContext } from './Tool';
import { CircleEntity } from '../Entity';
import { Point, MouseButton } from '../types';

/** 创建实体的回调 */
export type CircleEntityCreatedCallback = (entity: CircleEntity) => void;

/**
 * 绘制模式
 * - centerRadius: 圆心+半径（点击圆心，拖拽确定半径）
 * - twoPoint: 两点定圆（点击直径两端点）
 */
export type CircleDrawMode = 'centerRadius' | 'twoPoint';

/**
 * 圆形绘制工具
 * 支持圆心+半径模式和两点定圆模式
 */
export class CircleTool extends BaseTool {
  public readonly name = 'circle';

  /** 第一个点（世界坐标），null表示还未点击 */
  private firstPoint: Point | null = null;
  /** 预览点（鼠标当前位置） */
  private previewPoint: Point | null = null;
  /** 实体创建回调 */
  private onEntityCreated: CircleEntityCreatedCallback | null = null;

  /** 绘制模式 */
  private drawMode: CircleDrawMode = 'centerRadius';

  constructor(onEntityCreated?: CircleEntityCreatedCallback) {
    super();
    if (onEntityCreated) {
      this.onEntityCreated = onEntityCreated;
    }
  }

  /**
   * 设置实体创建回调
   */
  public setEntityCreatedCallback(cb: CircleEntityCreatedCallback): void {
    this.onEntityCreated = cb;
  }

  /**
   * 设置绘制模式
   */
  public setDrawMode(mode: CircleDrawMode): void {
    this.drawMode = mode;
    this.reset();
  }

  /**
   * 获取当前绘制模式
   */
  public getDrawMode(): CircleDrawMode {
    return this.drawMode;
  }

  public onActivate(): void {
    this.reset();
  }

  public onDeactivate(): void {
    this.reset();
  }

  /**
   * 重置工具状态
   */
  private reset(): void {
    this.firstPoint = null;
    this.previewPoint = null;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    const worldPoint = { ...ctx.mouseWorld };

    if (!this.firstPoint) {
      // 第一次点击
      this.firstPoint = worldPoint;
    } else {
      // 第二次点击：创建圆形
      const circle = this.createCircleFromPoints(this.firstPoint, worldPoint);
      if (circle) {
        this.onEntityCreated?.(circle);
      }
      this.reset();
    }
  }

  public onMouseMove(ctx: ToolContext, _e: MouseEvent): void {
    if (this.firstPoint) {
      this.previewPoint = { ...ctx.mouseWorld };
    }
  }

  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {
    // 圆形工具不处理鼠标释放
  }

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    // Escape 取消当前绘制
    if (e.key === 'Escape') {
      this.reset();
      return;
    }

    // Enter 完成当前绘制并退出
    if (e.key === 'Enter') {
      if (this.firstPoint && this.previewPoint) {
        const circle = this.createCircleFromPoints(this.firstPoint, this.previewPoint);
        if (circle) {
          this.onEntityCreated?.(circle);
        }
      }
      this.reset();
      return;
    }
  }

  /**
   * 根据两个点和当前模式创建圆形
   */
  private createCircleFromPoints(first: Point, second: Point): CircleEntity | null {
    if (this.drawMode === 'centerRadius') {
      // 圆心+半径模式：first是圆心，second确定半径
      const radius = Math.hypot(second.x - first.x, second.y - first.y);
      if (radius < 1e-6) return null; // 半径太小，忽略
      return new CircleEntity(first.x, first.y, radius);
    } else {
      // 两点定圆模式：first和second是直径两端点
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const radius = Math.hypot(second.x - first.x, second.y - first.y) / 2;
      if (radius < 1e-6) return null;
      return new CircleEntity(centerX, centerY, radius);
    }
  }

  /**
   * 绘制预览圆和夹点
   */
  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (!this.firstPoint) return;

    const firstScreen = viewport.worldToScreen(this.firstPoint.x, this.firstPoint.y);

    // 绘制第一个点标记（小方块）
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(firstScreen.x - 4, firstScreen.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();

    // 绘制预览圆
    if (this.previewPoint) {
      const previewScreen = viewport.worldToScreen(this.previewPoint.x, this.previewPoint.y);

      ctx.strokeStyle = '#0078d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      if (this.drawMode === 'centerRadius') {
        // 圆心+半径模式：预览圆和半径线
        const screenRadius = Math.hypot(previewScreen.x - firstScreen.x, previewScreen.y - firstScreen.y);

        ctx.beginPath();
        ctx.arc(firstScreen.x, firstScreen.y, screenRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 半径线
        ctx.beginPath();
        ctx.moveTo(firstScreen.x, firstScreen.y);
        ctx.lineTo(previewScreen.x, previewScreen.y);
        ctx.stroke();
      } else {
        // 两点定圆模式：预览圆（直径为两点距离）
        const centerX = (firstScreen.x + previewScreen.x) / 2;
        const centerY = (firstScreen.y + previewScreen.y) / 2;
        const radius = Math.hypot(previewScreen.x - firstScreen.x, previewScreen.y - firstScreen.y) / 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 直径线
        ctx.beginPath();
        ctx.moveTo(firstScreen.x, firstScreen.y);
        ctx.lineTo(previewScreen.x, previewScreen.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // 绘制终点预览标记
      ctx.fillStyle = '#0078d4';
      ctx.beginPath();
      ctx.arc(previewScreen.x, previewScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 从命令行参数创建圆形
   * 格式: "cx,cy radius" 或 "cx,cy,radius"
   */
  public static parseCommandLine(input: string): { center: Point; radius: number } | null {
    const parts = input.trim().split(/[\s,]+/);
    if (parts.length === 3) {
      const nums = parts.map(Number);
      if (nums.every(n => !isNaN(n)) && nums[2] > 0) {
        return {
          center: { x: nums[0], y: nums[1] },
          radius: nums[2],
        };
      }
    }
    if (parts.length === 2) {
      // "cx,cy radius"
      const coords = parts[0].split(',').map(Number);
      const radius = Number(parts[1]);
      if (coords.length === 2 && coords.every(n => !isNaN(n)) && !isNaN(radius) && radius > 0) {
        return {
          center: { x: coords[0], y: coords[1] },
          radius,
        };
      }
    }
    return null;
  }
}
