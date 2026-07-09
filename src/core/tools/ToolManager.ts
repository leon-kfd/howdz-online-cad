import { Tool, ToolContext } from './Tool';
import { Point } from '../types';
import { calculateGridSpacing } from '../../utils/math';

/**
 * 工具管理器
 * 管理当前活动工具，分发鼠标/键盘事件
 */
export class ToolManager {
  private currentTool: Tool | null = null;
  private tools: Map<string, Tool> = new Map();

  /** 正交模式 */
  public orthoMode = false;
  /** 捕捉模式 */
  public snapMode = false;

  /** 工具切换回调 */
  public onToolChange: ((toolName: string) => void) | null = null;

  /** 获取当前网格间距的回调（由 CAD 注入，与渲染器共享网格配置） */
  public getGridSpacing: ((scale: number) => number) | null = null;

  /**
   * 注册工具
   */
  public register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 切换到指定工具
   */
  public setActiveTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    if (this.currentTool) {
      this.currentTool.onDeactivate();
    }

    this.currentTool = tool;
    tool.onActivate();
    this.onToolChange?.(name);
    return true;
  }

  /**
   * 获取当前活动工具
   */
  public getActiveTool(): Tool | null {
    return this.currentTool;
  }

  /**
   * 获取当前工具名称
   */
  public getActiveToolName(): string | null {
    return this.currentTool?.name ?? null;
  }

  /**
   * 获取已注册的工具
   */
  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // ========== 事件分发 ==========

  /**
   * 分发鼠标按下事件
   */
  public dispatchMouseDown(mouseWorld: Point, mouseScreen: Point, scale: number, e: MouseEvent): void {
    if (!this.currentTool) return;
    const ctx = this.createContext(mouseWorld, mouseScreen, scale);
    this.currentTool.onMouseDown(ctx, e);
  }

  /**
   * 分发鼠标移动事件
   */
  public dispatchMouseMove(mouseWorld: Point, mouseScreen: Point, scale: number, e: MouseEvent): void {
    if (!this.currentTool) return;
    const ctx = this.createContext(mouseWorld, mouseScreen, scale);
    this.currentTool.onMouseMove(ctx, e);
  }

  /**
   * 分发鼠标释放事件
   */
  public dispatchMouseUp(mouseWorld: Point, mouseScreen: Point, scale: number, e: MouseEvent): void {
    if (!this.currentTool) return;
    const ctx = this.createContext(mouseWorld, mouseScreen, scale);
    this.currentTool.onMouseUp(ctx, e);
  }

  /**
   * 分发键盘事件
   */
  public dispatchKeyDown(mouseWorld: Point, mouseScreen: Point, scale: number, e: KeyboardEvent): void {
    if (!this.currentTool) return;
    const ctx = this.createContext(mouseWorld, mouseScreen, scale);
    this.currentTool.onKeyDown(ctx, e);
  }

  /**
   * 绘制当前工具的叠加层
   */
  public drawOverlay(ctx: CanvasRenderingContext2D, viewport: { worldToScreen: (x: number, y: number) => Point }): void {
    if (this.currentTool) {
      this.currentTool.drawOverlay(ctx, viewport);
    }
  }

  /**
   * 切换正交模式
   */
  public toggleOrtho(): boolean {
    this.orthoMode = !this.orthoMode;
    return this.orthoMode;
  }

  /**
   * 切换捕捉模式
   */
  public toggleSnap(): boolean {
    this.snapMode = !this.snapMode;
    return this.snapMode;
  }

  private createContext(mouseWorld: Point, mouseScreen: Point, scale: number): ToolContext {
    // 捕捉模式：将鼠标坐标吸附到最近的网格点
    let snappedWorld = mouseWorld;
    if (this.snapMode) {
      const gridSpacing = this.getGridSpacing?.(scale) ?? calculateGridSpacing(scale);
      snappedWorld = {
        x: Math.round(mouseWorld.x / gridSpacing) * gridSpacing,
        y: Math.round(mouseWorld.y / gridSpacing) * gridSpacing,
      };
    }

    return {
      mouseWorld: snappedWorld,
      mouseScreen,
      orthoMode: this.orthoMode,
      snapMode: this.snapMode,
      scale,
    };
  }
}
