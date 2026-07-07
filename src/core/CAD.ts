import { Viewport } from './Viewport';
import { Renderer } from './Renderer';
import { CADOptions, Point } from './types';
import { formatCoord } from '../utils/math';

/**
 * HowdzCAD 主类
 * 组合视口和渲染器，提供完整的CAD画布功能
 */
export class HowdzCAD {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private viewport: Viewport;
  private renderer: Renderer;
  private statusBar: HTMLElement | null = null;

  private options: Required<CADOptions>;

  constructor(options: CADOptions) {
    // 解析容器
    if (typeof options.container === 'string') {
      const el = document.querySelector<HTMLElement>(options.container);
      if (!el) throw new Error(`容器元素未找到: ${options.container}`);
      this.container = el;
    } else {
      this.container = options.container;
    }

    // 合并默认选项
    this.options = {
      container: this.container,
      width: options.width ?? '100%',
      height: options.height ?? '100%',
      showGrid: options.showGrid ?? true,
      showAxes: options.showAxes ?? true,
      backgroundColor: options.backgroundColor ?? '#1e1e1e',
      gridColor: options.gridColor ?? '#2a2a2a',
      gridMajorColor: options.gridMajorColor ?? '#3a3a3a',
    };

    // 创建DOM结构
    const { canvas, statusBar } = this.createDOM();
    this.canvas = canvas;
    this.statusBar = statusBar;

    // 初始化视口
    this.viewport = new Viewport(this.canvas);

    // 初始化渲染器
    this.renderer = new Renderer(this.canvas, this.viewport, {
      showGrid: this.options.showGrid,
      showAxes: this.options.showAxes,
      backgroundColor: this.options.backgroundColor,
      gridColor: this.options.gridColor,
      gridMajorColor: this.options.gridMajorColor,
    });

    // 视口变化时更新状态栏
    this.viewport.onUpdate = () => this.updateStatusBar();

    // 处理窗口resize
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    // 启动渲染
    this.renderer.resize();
    this.renderer.start();
    this.updateStatusBar();
  }

  /**
   * 创建DOM结构
   */
  private createDOM(): { canvas: HTMLCanvasElement; statusBar: HTMLElement } {
    // 设置容器样式
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.backgroundColor = this.options.backgroundColor;

    // 创建画布
    const canvas = document.createElement('canvas');
    canvas.style.width = typeof this.options.width === 'number'
      ? `${this.options.width}px`
      : this.options.width;
    canvas.style.height = typeof this.options.height === 'number'
      ? `${this.options.height}px`
      : this.options.height;
    canvas.style.display = 'block';
    this.container.appendChild(canvas);

    // 创建状态栏
    const statusBar = document.createElement('div');
    statusBar.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 24px;
      background: #2d2d2d;
      color: #999;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 24px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      gap: 20px;
      user-select: none;
      border-top: 1px solid #3a3a3a;
    `;
    this.container.appendChild(statusBar);

    return { canvas, statusBar };
  }

  /**
   * 处理窗口尺寸变化
   */
  private handleResize = (): void => {
    this.renderer.resize();
  };

  /**
   * 更新状态栏显示
   */
  private updateStatusBar(): void {
    if (!this.statusBar) return;

    const { mouseWorld, scale } = this.viewport;
    const fps = this.renderer.fps;

    this.statusBar.innerHTML = `
      <span>X: ${formatCoord(mouseWorld.x)}</span>
      <span>Y: ${formatCoord(mouseWorld.y)}</span>
      <span>缩放: ${(scale * 100).toFixed(0)}%</span>
      <span>FPS: ${fps}</span>
    `;
  }

  // ========== 公开API ==========

  /**
   * 获取视口实例
   */
  public getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * 获取渲染器实例
   */
  public getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * 获取画布元素
   */
  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 缩放到全部显示
   */
  public zoomExtents(): void {
    const size = this.renderer.getSize();
    this.viewport.fitBounds(-100, -100, 100, 100, size.width, size.height);
  }

  /**
   * 重置视图
   */
  public resetView(): void {
    this.viewport.reset();
  }

  /**
   * 设置网格显示
   */
  public setShowGrid(show: boolean): void {
    this.renderer.setShowGrid(show);
  }

  /**
   * 设置坐标轴显示
   */
  public setShowAxes(show: boolean): void {
    this.renderer.setShowAxes(show);
  }

  /**
   * 获取当前鼠标世界坐标
   */
  public getMousePosition(): Point {
    return { ...this.viewport.mouseWorld };
  }

  /**
   * 销毁CAD实例，清理资源
   */
  public destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.destroy();
    this.viewport.destroy();
    this.canvas.remove();
    this.statusBar?.remove();
  }
}
