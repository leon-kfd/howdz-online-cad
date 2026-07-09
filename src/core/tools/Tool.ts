import { Point } from '../types';

/** 工具事件上下文 */
export interface ToolContext {
  /** 当前鼠标世界坐标 */
  mouseWorld: Point;
  /** 当前鼠标屏幕坐标 */
  mouseScreen: Point;
  /** 正交模式是否开启 */
  orthoMode: boolean;
  /** 捕捉模式是否开启 */
  snapMode: boolean;
  /** 当前缩放比例（用于计算容差） */
  scale: number;
}

/**
 * 工具基类/接口
 * 所有绘图和编辑工具都实现此接口
 */
export interface Tool {
  /** 工具名称 */
  readonly name: string;

  /** 工具激活时调用 */
  onActivate(): void;

  /** 工具停用时调用 */
  onDeactivate(): void;

  /** 鼠标按下 */
  onMouseDown(ctx: ToolContext, e: MouseEvent): void;

  /** 鼠标移动 */
  onMouseMove(ctx: ToolContext, e: MouseEvent): void;

  /** 鼠标释放 */
  onMouseUp(ctx: ToolContext, e: MouseEvent): void;

  /** 键盘按下 */
  onKeyDown(ctx: ToolContext, e: KeyboardEvent): void;

  /** 绘制工具的临时图形（如正在绘制的预览线） */
  drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void;
}

/**
 * 工具基类 - 提供默认空实现
 */
export abstract class BaseTool implements Tool {
  public abstract readonly name: string;

  public onActivate(): void {}
  public onDeactivate(): void {}
  public onMouseDown(_ctx: ToolContext, _e: MouseEvent): void {}
  public onMouseMove(_ctx: ToolContext, _e: MouseEvent): void {}
  public onMouseUp(_ctx: ToolContext, _e: MouseEvent): void {}
  public onKeyDown(_ctx: ToolContext, _e: KeyboardEvent): void {}
  public drawOverlay(_ctx: CanvasRenderingContext2D, _viewport: { worldToScreen: (x: number, y: number) => Point }): void {}
}
