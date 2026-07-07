import { BaseTool, ToolContext } from './Tool';
import { EntityManager } from '../EntityManager';
import { Point, BoundingBox, MouseButton } from '../types';
import { Viewport } from '../Viewport';

/**
 * 选择工具
 * 支持单击选择、Shift加选、框选/交叉选择
 */
export class SelectTool extends BaseTool {
  public readonly name = 'select';

  private entityManager: EntityManager;
  private viewport: Viewport;
  /** 是否正在框选 */
  private isDragging = false;
  /** 框选起点（屏幕坐标） */
  private dragStartScreen: Point = { x: 0, y: 0 };
  /** 框选当前点（屏幕坐标） */
  private dragCurrentScreen: Point = { x: 0, y: 0 };

  constructor(entityManager: EntityManager, viewport: Viewport) {
    super();
    this.entityManager = entityManager;
    this.viewport = viewport;
  }

  public onActivate(): void {
    // 激活时不改变选择
  }

  public onDeactivate(): void {
    this.isDragging = false;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    // 检查是否点击到实体
    const tolerance = 5 / ctx.scale; // 5像素容差转世界坐标
    const hits = this.entityManager.hitTest(ctx.mouseWorld.x, ctx.mouseWorld.y, tolerance);

    if (hits.length > 0) {
      const entity = hits[0];
      if (e.shiftKey) {
        // Shift+点击：切换选择
        this.entityManager.toggleSelect(entity);
      } else {
        // 普通点击：选中（替换选择集）
        this.entityManager.select(entity);
      }
    } else {
      // 点击空白处，开始框选（如果没有按Shift）
      if (!e.shiftKey) {
        this.entityManager.clearSelection();
      }
      this.isDragging = true;
      this.dragStartScreen = { ...ctx.mouseScreen };
      this.dragCurrentScreen = { ...ctx.mouseScreen };
    }
  }

  public onMouseMove(_ctx: ToolContext, _e: MouseEvent): void {
    if (this.isDragging) {
      this.dragCurrentScreen = { ..._ctx.mouseScreen };
    }
  }

  public onMouseUp(_ctx: ToolContext, e: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    // 如果框选区域太小，忽略
    const boxWidth = Math.abs(this.dragCurrentScreen.x - this.dragStartScreen.x);
    const boxHeight = Math.abs(this.dragCurrentScreen.y - this.dragStartScreen.y);
    if (boxWidth < 3 && boxHeight < 3) return;

    // 转换为世界坐标包围盒
    const worldStart = this.viewport.screenToWorld(this.dragStartScreen.x, this.dragStartScreen.y);
    const worldEnd = this.viewport.screenToWorld(this.dragCurrentScreen.x, this.dragCurrentScreen.y);

    const bbox: BoundingBox = {
      minX: Math.min(worldStart.x, worldEnd.x),
      minY: Math.min(worldStart.y, worldEnd.y),
      maxX: Math.max(worldStart.x, worldEnd.x),
      maxY: Math.max(worldStart.y, worldEnd.y),
    };

    // 判断是框选（从左到右）还是交叉选择（从右到左）
    const isWindowSelect = this.dragStartScreen.x < this.dragCurrentScreen.x;
    const selected = this.entityManager.hitTestBoundingBox(bbox, isWindowSelect);

    if (e.shiftKey) {
      // Shift+框选：追加选择
      for (const entity of selected) {
        this.entityManager.selectAdd(entity);
      }
    } else {
      this.entityManager.selectAll(selected);
    }
  }

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    // Escape 清除选择
    if (e.key === 'Escape') {
      this.entityManager.clearSelection();
    }
  }

  public drawOverlay(ctx: CanvasRenderingContext2D): void {
    // 绘制框选矩形
    if (!this.isDragging) return;

    const startX = this.dragStartScreen.x;
    const startY = this.dragStartScreen.y;
    const endX = this.dragCurrentScreen.x;
    const endY = this.dragCurrentScreen.y;

    const isWindowSelect = this.dragStartScreen.x < this.dragCurrentScreen.x;

    ctx.strokeStyle = isWindowSelect ? '#0078d4' : '#d47800';
    ctx.fillStyle = isWindowSelect ? 'rgba(0, 120, 212, 0.1)' : 'rgba(212, 120, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash(isWindowSelect ? [] : [4, 4]);

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}
