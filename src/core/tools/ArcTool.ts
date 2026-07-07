import { BaseTool, ToolContext } from './Tool';
import { ArcEntity } from '../Entity';
import { Point, MouseButton } from '../types';

/** 创建实体的回调 */
export type ArcEntityCreatedCallback = (entity: ArcEntity) => void;

/**
 * 绘制模式
 * - threePoint: 三点画弧（起点、经过点、终点）
 * - centerStart: 圆心+起点+终点模式（点击圆心、起点、终点）
 */
export type ArcDrawMode = 'threePoint' | 'centerStart';

/**
 * 圆弧绘制工具
 * 支持三点画弧和圆心+起点+终点模式
 */
export class ArcTool extends BaseTool {
  public readonly name = 'arc';

  /** 已收集的点（世界坐标） */
  private points: Point[] = [];
  /** 预览点（鼠标当前位置） */
  private previewPoint: Point | null = null;
  /** 实体创建回调 */
  private onEntityCreated: ArcEntityCreatedCallback | null = null;

  /** 绘制模式 */
  private drawMode: ArcDrawMode = 'threePoint';

  constructor(onEntityCreated?: ArcEntityCreatedCallback) {
    super();
    if (onEntityCreated) {
      this.onEntityCreated = onEntityCreated;
    }
  }

  /**
   * 设置实体创建回调
   */
  public setEntityCreatedCallback(cb: ArcEntityCreatedCallback): void {
    this.onEntityCreated = cb;
  }

  /**
   * 设置绘制模式
   */
  public setDrawMode(mode: ArcDrawMode): void {
    this.drawMode = mode;
    this.reset();
  }

  /**
   * 获取当前绘制模式
   */
  public getDrawMode(): ArcDrawMode {
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
    this.points = [];
    this.previewPoint = null;
  }

  public onMouseDown(ctx: ToolContext, e: MouseEvent): void {
    if (e.button !== MouseButton.Left) return;

    const worldPoint = { ...ctx.mouseWorld };
    this.points.push(worldPoint);

    if (this.drawMode === 'threePoint') {
      // 三点模式：收集3个点后创建圆弧
      if (this.points.length === 3) {
        const arc = ArcEntity.computeArcFromThreePoints(
          this.points[0],
          this.points[1],
          this.points[2],
        );
        if (arc) {
          this.onEntityCreated?.(arc);
        }
        this.reset();
      }
    } else {
      // 圆心+起点+终点模式：收集3个点后创建圆弧
      if (this.points.length === 3) {
        const arc = this.createArcFromCenterMode(
          this.points[0],
          this.points[1],
          this.points[2],
        );
        if (arc) {
          this.onEntityCreated?.(arc);
        }
        this.reset();
      }
    }
  }

  public onMouseMove(ctx: ToolContext, _e: MouseEvent): void {
    if (this.points.length > 0) {
      this.previewPoint = { ...ctx.mouseWorld };
    }
  }

  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {
    // 圆弧工具不处理鼠标释放
  }

  public onKeyDown(_ctx: ToolContext, e: KeyboardEvent): void {
    // Escape 取消当前绘制
    if (e.key === 'Escape') {
      this.reset();
      return;
    }

    // Enter 用当前预览点完成绘制
    if (e.key === 'Enter') {
      if (this.previewPoint) {
        this.points.push(this.previewPoint);

        if (this.drawMode === 'threePoint' && this.points.length === 3) {
          const arc = ArcEntity.computeArcFromThreePoints(
            this.points[0],
            this.points[1],
            this.points[2],
          );
          if (arc) {
            this.onEntityCreated?.(arc);
          }
        } else if (this.drawMode === 'centerStart' && this.points.length === 3) {
          const arc = this.createArcFromCenterMode(
            this.points[0],
            this.points[1],
            this.points[2],
          );
          if (arc) {
            this.onEntityCreated?.(arc);
          }
        }
      }
      this.reset();
      return;
    }
  }

  /**
   * 圆心+起点+终点模式创建圆弧
   */
  private createArcFromCenterMode(
    center: Point,
    startPoint: Point,
    endPoint: Point,
  ): ArcEntity | null {
    const radius = Math.hypot(startPoint.x - center.x, startPoint.y - center.y);
    if (radius < 1e-6) return null;

    const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
    const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);

    return new ArcEntity(center.x, center.y, radius, startAngle, endAngle);
  }

  /**
   * 绘制预览圆弧和辅助线
   */
  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (this.points.length === 0) return;

    const screenPoints = this.points.map((p) => viewport.worldToScreen(p.x, p.y));

    // 绘制已点击的点标记（小方块）
    for (const sp of screenPoints) {
      ctx.fillStyle = '#0078d4';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(sp.x - 4, sp.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }

    // 绘制辅助线（从已点击的点到预览点）
    if (this.previewPoint) {
      const previewScreen = viewport.worldToScreen(this.previewPoint.x, this.previewPoint.y);

      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);

      for (const sp of screenPoints) {
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(previewScreen.x, previewScreen.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // 绘制预览圆弧
    if (this.previewPoint && this.points.length >= 2) {
      const previewScreen = viewport.worldToScreen(this.previewPoint.x, this.previewPoint.y);
      let arc: ArcEntity | null = null;

      if (this.drawMode === 'threePoint' && this.points.length >= 2) {
        // 三点模式预览：需要已有的2个点 + 预览点
        arc = ArcEntity.computeArcFromThreePoints(
          this.points[0],
          this.points[1],
          this.previewPoint,
        );
      } else if (this.drawMode === 'centerStart' && this.points.length >= 2) {
        // 圆心+起点+终点模式预览
        const radius = Math.hypot(
          this.points[1].x - this.points[0].x,
          this.points[1].y - this.points[0].y,
        );
        if (radius > 1e-6) {
          const startAngle = Math.atan2(
            this.points[1].y - this.points[0].y,
            this.points[1].x - this.points[0].x,
          );
          const endAngle = Math.atan2(
            this.previewPoint.y - this.points[0].y,
            this.previewPoint.x - this.points[0].x,
          );
          arc = new ArcEntity(
            this.points[0].x,
            this.points[0].y,
            radius,
            startAngle,
            endAngle,
          );
        }
      }

      if (arc) {
        const center = viewport.worldToScreen(arc.centerX, arc.centerY);
        // 计算屏幕空间半径（不依赖 viewport.scale）
        const startPointOnArc = viewport.worldToScreen(
          arc.centerX + arc.radius * Math.cos(arc.startAngle),
          arc.centerY + arc.radius * Math.sin(arc.startAngle),
        );
        const screenRadius = Math.hypot(startPointOnArc.x - center.x, startPointOnArc.y - center.y);

        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(
          center.x,
          center.y,
          Math.abs(screenRadius),
          arc.startAngle,
          arc.endAngle,
          true,
        );
        ctx.stroke();
        ctx.setLineDash([]);

        // 绘制预览点标记
        ctx.fillStyle = '#0078d4';
        ctx.beginPath();
        ctx.arc(previewScreen.x, previewScreen.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.previewPoint && this.points.length === 1) {
      // 只有1个点时，绘制从第一点到鼠标的预览线
      const previewScreen = viewport.worldToScreen(this.previewPoint.x, this.previewPoint.y);
      const firstScreen = screenPoints[0];

      ctx.strokeStyle = '#0078d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(firstScreen.x, firstScreen.y);
      ctx.lineTo(previewScreen.x, previewScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 绘制预览点标记
      ctx.fillStyle = '#0078d4';
      ctx.beginPath();
      ctx.arc(previewScreen.x, previewScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 从命令行参数创建圆弧
   * 三点模式格式: "x1,y1 x2,y2 x3,y3"（起点、经过点、终点）
   * 圆心模式格式: "cx,cy sx,sy angle"（圆心、起点、角度）
   */
  public static parseCommandLine(input: string): ArcEntity | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 尝试解析为三个坐标对（三点模式）
    const threePointResult = ArcTool.tryParseThreePoints(trimmed);
    if (threePointResult) {
      return ArcEntity.computeArcFromThreePoints(
        threePointResult[0],
        threePointResult[1],
        threePointResult[2],
      );
    }

    // 尝试解析为圆心+起点+角度模式
    const centerStartResult = ArcTool.tryParseCenterStartAngle(trimmed);
    if (centerStartResult) {
      return centerStartResult;
    }

    return null;
  }

  /**
   * 尝试解析三个坐标对
   * 支持格式: "x1,y1 x2,y2 x3,y3" 或 "x1 y1 x2 y2 x3 y3"
   */
  private static tryParseThreePoints(input: string): [Point, Point, Point] | null {
    const parts = input.trim().split(/[\s,]+/);

    // 格式: "x1 y1 x2 y2 x3 y3"（6个数字）
    if (parts.length === 6) {
      const nums = parts.map(Number);
      if (nums.every((n) => !isNaN(n))) {
        return [
          { x: nums[0], y: nums[1] },
          { x: nums[2], y: nums[3] },
          { x: nums[4], y: nums[5] },
        ];
      }
    }

    // 格式: "x1,y1 x2,y2 x3,y3"（3个坐标对）
    if (parts.length === 3) {
      const coords = parts.map((p) => p.split(',').map(Number));
      if (
        coords.length === 3 &&
        coords.every((c) => c.length === 2 && c.every((n) => !isNaN(n)))
      ) {
        return [
          { x: coords[0][0], y: coords[0][1] },
          { x: coords[1][0], y: coords[1][1] },
          { x: coords[2][0], y: coords[2][1] },
        ];
      }
    }

    return null;
  }

  /**
   * 尝试解析圆心+起点+角度模式
   * 格式: "cx,cy sx,sy angle"（圆心坐标、起点坐标、角度值）
   */
  private static tryParseCenterStartAngle(input: string): ArcEntity | null {
    const parts = input.trim().split(/[\s,]+/);

    // 需要至少5个值: cx cy sx sy angle
    if (parts.length === 5) {
      const nums = parts.map(Number);
      if (nums.every((n) => !isNaN(n)) && !isNaN(nums[4])) {
        const center: Point = { x: nums[0], y: nums[1] };
        const startPoint: Point = { x: nums[2], y: nums[3] };
        const sweepAngle = nums[4]; // 角度值

        if (Math.abs(sweepAngle) < 1e-6) return null;

        const radius = Math.hypot(startPoint.x - center.x, startPoint.y - center.y);
        if (radius < 1e-6) return null;

        const startAngle = Math.atan2(
          startPoint.y - center.y,
          startPoint.x - center.x,
        );
        const endAngle = startAngle + (sweepAngle * Math.PI) / 180;

        return new ArcEntity(center.x, center.y, radius, startAngle, endAngle);
      }
    }

    return null;
  }
}
