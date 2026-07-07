import { BaseTool, ToolContext } from './Tool';
import { Entity } from '../Entity';
import { EntityManager } from '../EntityManager';
import { Point, MouseButton } from '../types';

/**
 * 移动工具
 * 支持选中图元后指定基点和目标点进行移动
 */
export class MoveTool extends BaseTool {
  public readonly name = 'move';

  private entityManager: EntityManager;

  /** 基点（世界坐标），null表示还未指定 */
  private basePoint: Point | null = null;
  /** 预览目标点（鼠标当前位置） */
  private previewPoint: Point | null = null;
  /** 开始移动时的选中实体快照 */
  private sourceEntities: Entity[] = [];

  constructor(entityManager: EntityManager) {
    super();
    this.entityManager = entityManager;
  }

  public onActivate(): void {
    this.reset();
    // 激活时快照当前选中实体
    this.sourceEntities = [...this.entityManager.getSelected()];
  }

  public onDeactivate(): void {
    this.reset();
  }

  private reset(): void {
    this.basePoint = null;
    this.previewPoint = null;
    this.sourceEntities = [];
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;
    if (this.sourceEntities.length === 0) return;

    const worldPoint = { ...ctx.mouseWorld };

    if (!this.basePoint) {
      // 第一次点击：设置基点
      this.basePoint = worldPoint;
    } else {
      // 第二次点击：执行移动
      this.executeMove(worldPoint);
    }
  }

  public onMouseMove(ctx: ToolContext, _e: MouseEvent): void {
    if (this.basePoint) {
      this.previewPoint = { ...ctx.mouseWorld };
    }
  }

  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {
    // 移动工具不处理鼠标释放
  }

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    // Escape 取消移动
    if (e.key === 'Escape') {
      this.reset();
      return;
    }

    // Enter 确认移动（如果有预览位置）
    if (e.key === 'Enter') {
      if (this.basePoint && this.previewPoint) {
        this.executeMove(this.previewPoint);
      }
      this.reset();
      return;
    }
  }

  /**
   * 执行移动：将选中实体移动到目标位置
   */
  private executeMove(targetPoint: Point): void {
    if (!this.basePoint) return;

    const dx = targetPoint.x - this.basePoint.x;
    const dy = targetPoint.y - this.basePoint.y;

    for (const entity of this.sourceEntities) {
      entity.move(dx, dy);
    }

    // 移动完成后重置基点，允许继续移动（不退出工具）
    this.basePoint = null;
    this.previewPoint = null;
  }

  /**
   * 绘制预览（基点标记 + 偏移预览线）
   */
  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (!this.basePoint) return;

    const baseScreen = viewport.worldToScreen(this.basePoint.x, this.basePoint.y);

    // 绘制基点标记
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(baseScreen.x - 4, baseScreen.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();

    // 绘制预览线（基点到当前鼠标位置）
    if (this.previewPoint) {
      const previewScreen = viewport.worldToScreen(this.previewPoint.x, this.previewPoint.y);

      ctx.strokeStyle = '#0078d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(baseScreen.x, baseScreen.y);
      ctx.lineTo(previewScreen.x, previewScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /**
   * 从命令行参数解析移动偏移
   * 格式: "dx,dy"
   */
  public static parseCommandLine(input: string): { dx: number; dy: number } | null {
    const parts = input.trim().split(/[\s,]+/);
    if (parts.length === 2) {
      const nums = parts.map(Number);
      if (nums.every(n => !isNaN(n))) {
        return { dx: nums[0], dy: nums[1] };
      }
    }
    return null;
  }
}
