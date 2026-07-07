import { BaseTool, ToolContext } from './Tool';
import { LineEntity } from '../Entity';
import { Point, MouseButton } from '../types';

/** 创建实体的回调 */
export type EntityCreatedCallback = (entity: LineEntity) => void;

/**
 * 直线绘制工具
 * 支持鼠标点击两点绘制直线、连续绘制、正交模式
 */
export class LineTool extends BaseTool {
  public readonly name = 'line';

  /** 第一个点（世界坐标），null表示还未点击 */
  private startPoint: Point | null = null;
  /** 预览终点（鼠标当前位置） */
  private previewEnd: Point | null = null;
  /** 实体创建回调 */
  private onEntityCreated: EntityCreatedCallback | null = null;

  /** 连续绘制模式 */
  private continuousMode = true;

  constructor(onEntityCreated?: EntityCreatedCallback) {
    super();
    if (onEntityCreated) {
      this.onEntityCreated = onEntityCreated;
    }
  }

  /**
   * 设置实体创建回调
   */
  public setEntityCreatedCallback(cb: EntityCreatedCallback): void {
    this.onEntityCreated = cb;
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
    this.startPoint = null;
    this.previewEnd = null;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    const worldPoint = this.applyOrtho(ctx);

    if (!this.startPoint) {
      // 第一次点击：设置起点
      this.startPoint = worldPoint;
    } else {
      // 第二次点击：创建直线
      const line = new LineEntity(
        this.startPoint.x, this.startPoint.y,
        worldPoint.x, worldPoint.y
      );
      this.onEntityCreated?.(line);

      if (this.continuousMode) {
        // 连续绘制：终点变为下一条线的起点
        this.startPoint = worldPoint;
      } else {
        this.reset();
      }
    }
  }

  public onMouseMove(ctx: ToolContext, _e: MouseEvent): void {
    if (this.startPoint) {
      this.previewEnd = this.applyOrtho(ctx);
    }
  }

  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {
    // 直线工具不处理鼠标释放
  }

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    // Escape 取消当前绘制
    if (e.key === 'Escape') {
      this.reset();
      return;
    }

    // Enter 完成当前绘制并退出
    if (e.key === 'Enter') {
      if (this.startPoint && this.previewEnd) {
        const line = new LineEntity(
          this.startPoint.x, this.startPoint.y,
          this.previewEnd.x, this.previewEnd.y
        );
        this.onEntityCreated?.(line);
      }
      this.reset();
      return;
    }
  }

  /**
   * 应用正交模式约束
   * 正交模式下，限制为水平或垂直方向（取较近的方向）
   */
  private applyOrtho(ctx: ToolContext): Point {
    if (!ctx.orthoMode || !this.startPoint) {
      return { ...ctx.mouseWorld };
    }

    const dx = ctx.mouseWorld.x - this.startPoint.x;
    const dy = ctx.mouseWorld.y - this.startPoint.y;

    // 取绝对值较大的方向
    if (Math.abs(dx) >= Math.abs(dy)) {
      // 水平方向
      return { x: ctx.mouseWorld.x, y: this.startPoint.y };
    } else {
      // 垂直方向
      return { x: this.startPoint.x, y: ctx.mouseWorld.y };
    }
  }

  /**
   * 绘制预览线和夹点
   */
  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (!this.startPoint) return;

    const startScreen = viewport.worldToScreen(this.startPoint.x, this.startPoint.y);

    // 绘制起点标记（小方块）
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(startScreen.x - 4, startScreen.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();

    // 绘制预览线
    if (this.previewEnd) {
      const endScreen = viewport.worldToScreen(this.previewEnd.x, this.previewEnd.y);

      ctx.strokeStyle = '#0078d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 绘制终点预览标记
      ctx.fillStyle = '#0078d4';
      ctx.beginPath();
      ctx.arc(endScreen.x, endScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 从命令行参数创建直线
   * 格式: "x1,y1 x2,y2" 或 "x1,y1 @dx,dy"（相对坐标）
   */
  public static parseCommandLine(input: string): { start: Point; end: Point } | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 尝试解析两个坐标对（支持相对坐标）
    const twoPointResult = LineTool.tryParseTwoPoints(trimmed);
    if (twoPointResult) return twoPointResult;

    // 尝试解析四个数值 "x1 y1 x2 y2"
    const parts = trimmed.split(/[\s,]+/);
    if (parts.length === 4) {
      const nums = parts.map(Number);
      if (nums.every(n => !isNaN(n))) {
        return {
          start: { x: nums[0], y: nums[1] },
          end: { x: nums[2], y: nums[3] },
        };
      }
    }

    return null;
  }

  /**
   * 尝试解析两个坐标对，支持相对坐标 @dx,dy
   */
  private static tryParseTwoPoints(input: string): { start: Point; end: Point } | null {
    // 分割为两个部分（按空格分割，但要处理带逗号的坐标）
    const spaceIndex = input.indexOf(' ');
    if (spaceIndex === -1) return null;

    const firstPart = input.substring(0, spaceIndex).trim();
    const secondPart = input.substring(spaceIndex + 1).trim();

    // 解析第一个点（绝对坐标）
    const firstCoords = firstPart.split(',').map(Number);
    if (firstCoords.length !== 2 || firstCoords.some(isNaN)) return null;

    const start: Point = { x: firstCoords[0], y: firstCoords[1] };

    // 解析第二个点（支持相对坐标 @dx,dy）
    const isRelative = secondPart.startsWith('@');
    const coordStr = isRelative ? secondPart.substring(1) : secondPart;
    const secondCoords = coordStr.split(',').map(Number);
    if (secondCoords.length !== 2 || secondCoords.some(isNaN)) return null;

    const end: Point = isRelative
      ? { x: start.x + secondCoords[0], y: start.y + secondCoords[1] }
      : { x: secondCoords[0], y: secondCoords[1] };

    return { start, end };
  }
}
