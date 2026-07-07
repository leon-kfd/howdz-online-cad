import { BaseTool, ToolContext } from './Tool';
import { EntityManager, GripHitResult } from '../EntityManager';
import { Point, BoundingBox, MouseButton } from '../types';
import { Viewport } from '../Viewport';

/**
 * 选择工具
 * 支持单击选择、Shift加选、框选/交叉选择、夹点拖拽编辑
 */
export class SelectTool extends BaseTool {
  public readonly name = 'select';

  private entityManager: EntityManager;
  private viewport: Viewport;

  // ---- 框选状态 ----
  /** 是否正在框选 */
  private isDragging = false;
  /** 框选起点（屏幕坐标） */
  private dragStartScreen: Point = { x: 0, y: 0 };
  /** 框选当前点（屏幕坐标） */
  private dragCurrentScreen: Point = { x: 0, y: 0 };

  // ---- 夹点拖拽状态 ----
  /** 是否正在拖拽夹点 */
  private isGripDragging = false;
  /** 当前拖拽的夹点信息 */
  private activeGrip: GripHitResult | null = null;

  /** 选择变更回调（供属性面板等使用） */
  public onSelectionChange: (() => void) | null = null;

  constructor(entityManager: EntityManager, viewport: Viewport) {
    super();
    this.entityManager = entityManager;
    this.viewport = viewport;
  }

  public onActivate(): void {
    // 激活时不改变选择
  }

  public onDeactivate(): void {
    this.cancelGripDrag();
    this.isDragging = false;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    const tolerance = 5 / ctx.scale; // 5像素容差转世界坐标

    // 1. 优先检测夹点命中（仅在选中实体中查找）
    const gripHit = this.entityManager.hitTestGripPoint(
      ctx.mouseWorld.x, ctx.mouseWorld.y, tolerance,
    );
    if (gripHit) {
      this.isGripDragging = true;
      this.activeGrip = gripHit;
      return;
    }

    // 2. 检测实体命中
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
      this.onSelectionChange?.();
    } else {
      // 点击空白处，开始框选（如果没有按Shift）
      if (!e.shiftKey) {
        this.entityManager.clearSelection();
        this.onSelectionChange?.();
      }
      this.isDragging = true;
      this.dragStartScreen = { ...ctx.mouseScreen };
      this.dragCurrentScreen = { ...ctx.mouseScreen };
    }
  }

  public onMouseMove(ctx: ToolContext, _e: MouseEvent): void {
    // 夹点拖拽中：实时更新实体形状
    if (this.isGripDragging && this.activeGrip) {
      this.activeGrip.entity.moveGripPoint(
        this.activeGrip.gripIndex,
        ctx.mouseWorld.x,
        ctx.mouseWorld.y,
      );
      // 更新夹点位置跟踪
      this.activeGrip.point = { x: ctx.mouseWorld.x, y: ctx.mouseWorld.y };
      return;
    }

    // 框选中：更新框选矩形
    if (this.isDragging) {
      this.dragCurrentScreen = { ...ctx.mouseScreen };
    }
  }

  public onMouseUp(_ctx: ToolContext, e: MouseEvent): void {
    // 夹点拖拽结束
    if (this.isGripDragging) {
      this.isGripDragging = false;
      this.activeGrip = null;
      return;
    }

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

    this.onSelectionChange?.();
  }

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    // Escape 清除选择 / 取消夹点拖拽
    if (e.key === 'Escape') {
      if (this.isGripDragging) {
        this.cancelGripDrag();
      } else {
        this.entityManager.clearSelection();
        this.onSelectionChange?.();
      }
    }
  }

  public drawOverlay(ctx: CanvasRenderingContext2D): void {
    // 绘制框选矩形
    if (this.isDragging) {
      this.drawSelectionBox(ctx);
    }

    // 夹点拖拽时高亮活动夹点
    if (this.isGripDragging && this.activeGrip) {
      this.drawActiveGrip(ctx);
    }
  }

  /**
   * 取消夹点拖拽（恢复原始位置——简单实现：不做恢复，因为实体已经修改）
   */
  private cancelGripDrag(): void {
    this.isGripDragging = false;
    this.activeGrip = null;
  }

  /**
   * 绘制框选矩形
   */
  private drawSelectionBox(ctx: CanvasRenderingContext2D): void {
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

  /**
   * 绘制当前正在拖拽的夹点（高亮）
   */
  private drawActiveGrip(ctx: CanvasRenderingContext2D): void {
    if (!this.activeGrip) return;

    const sp = this.viewport.worldToScreen(
      this.activeGrip.point.x,
      this.activeGrip.point.y,
    );

    // 绘制高亮夹点（稍大一些，醒目颜色）
    ctx.fillStyle = '#ff6600';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(sp.x - 6, sp.y - 6, 12, 12);
    ctx.fill();
    ctx.stroke();
  }
}
