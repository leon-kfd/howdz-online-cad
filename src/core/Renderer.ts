import { Viewport } from './Viewport';
import { EntityManager } from './EntityManager';
import { LayerManager } from './LayerManager';
import { calculateGridSpacing } from '../utils/math';

/** 默认颜色配置 */
const DEFAULT_COLORS = {
  background: '#1e1e1e',
  grid: '#2a2a2a',
  gridMajor: '#3a3a3a',
  axisX: '#e06060',
  axisY: '#60c060',
  crosshair: '#cccccc',
  coordinateText: '#999999',
};

/**
 * Canvas渲染引擎
 * 负责网格、坐标轴、光标等基础渲染
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private entityManager: EntityManager | null = null;
  private layerManager: LayerManager | null = null;
  private colors: typeof DEFAULT_COLORS;

  private showGrid: boolean;
  private showAxes: boolean;

  /** 网格大小模式：'auto' 自适应缩放，'fixed' 固定间距 */
  private gridSizeMode: 'auto' | 'fixed' = 'auto';
  /** 固定网格间距（仅 fixed 模式生效） */
  private gridSize = 10;

  /** 叠加层渲染回调（用于工具的临时图形） */
  private overlayRenderer: ((ctx: CanvasRenderingContext2D) => void) | null = null;

  /** 动画帧ID */
  private rafId = 0;
  /** 帧率统计 */
  private frameCount = 0;
  private lastFpsTime = 0;
  public fps = 0;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    options: {
      showGrid?: boolean;
      showAxes?: boolean;
      backgroundColor?: string;
      gridColor?: string;
      gridMajorColor?: string;
      entityManager?: EntityManager;
    } = {}
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.entityManager = options.entityManager ?? null;
    this.showGrid = options.showGrid ?? true;
    this.showAxes = options.showAxes ?? true;

    this.colors = {
      ...DEFAULT_COLORS,
      background: options.backgroundColor ?? DEFAULT_COLORS.background,
      grid: options.gridColor ?? DEFAULT_COLORS.grid,
      gridMajor: options.gridMajorColor ?? DEFAULT_COLORS.gridMajor,
    };

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建Canvas 2D上下文');
    this.ctx = ctx;

    // 设置十字光标
    this.canvas.style.cursor = 'crosshair';
  }

  /**
   * 设置叠加层渲染回调
   */
  public setOverlayRenderer(renderer: (ctx: CanvasRenderingContext2D) => void): void {
    this.overlayRenderer = renderer;
  }

  /**
   * 设置图层管理器引用
   */
  public setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  /**
   * 调整画布尺寸（处理DPR）
   */
  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * 获取画布CSS尺寸
   */
  public getSize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  /**
   * 开始渲染循环
   */
  public start(): void {
    this.lastFpsTime = performance.now();
    this.render();
  }

  /**
   * 停止渲染循环
   */
  public stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /**
   * 主渲染函数
   */
  private render = (): void => {
    const { width, height } = this.getSize();

    // 清屏
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, width, height);

    // 绘制网格
    if (this.showGrid) {
      this.drawGrid(width, height);
    }

    // 绘制坐标轴
    if (this.showAxes) {
      this.drawAxes(width, height);
    }

    // 绘制实体
    this.drawEntities();

    // 绘制十字光标
    this.drawCrosshair(width, height);

    // 绘制叠加层（工具临时图形）
    if (this.overlayRenderer) {
      this.overlayRenderer(this.ctx);
    }

    // 帧率统计
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // 继续下一帧
    this.rafId = requestAnimationFrame(this.render);
  };

  /**
   * 绘制所有实体
   */
  private drawEntities(): void {
    if (!this.entityManager) return;

    const entities = this.entityManager.getAll();
    for (const entity of entities) {
      if (!entity.visible) continue;

      // 检查图层可见性
      if (this.layerManager && !this.layerManager.isLayerVisible(entity.layer)) continue;

      const selected = this.entityManager.isSelected(entity);

      // 解析实体颜色：实体颜色 > 图层颜色 > 默认颜色
      const originalColor = entity.color;
      if (!entity.color && this.layerManager) {
        entity.color = this.layerManager.getLayerColor(entity.layer);
      }

      entity.draw(this.ctx, this.viewport, selected);

      // 恢复原始颜色（null表示跟随图层）
      entity.color = originalColor;
    }
  }

  /**
   * 绘制自适应网格
   */
  private drawGrid(canvasWidth: number, canvasHeight: number): void {
    const { scale, offsetX, offsetY } = this.viewport;
    const ctx = this.ctx;

    // 计算网格间距
    const gridSpacing = this.getGridSpacing(scale);
    const majorGridSpacing = gridSpacing * 5;

    // 计算可见区域的世界坐标范围
    const topLeft = this.viewport.screenToWorld(0, 0);
    const bottomRight = this.viewport.screenToWorld(canvasWidth, canvasHeight);

    // 网格线起始/结束位置（世界坐标，对齐到网格间距）
    const startX = Math.floor(topLeft.x / gridSpacing) * gridSpacing;
    const endX = Math.ceil(bottomRight.x / gridSpacing) * gridSpacing;
    const startY = Math.floor(topLeft.y / gridSpacing) * gridSpacing;
    const endY = Math.ceil(bottomRight.y / gridSpacing) * gridSpacing;

    ctx.lineWidth = 1;

    // 绘制次网格线
    ctx.strokeStyle = this.colors.grid;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSpacing) {
      const screenX = Math.round((x + offsetX) * scale) + 0.5;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvasHeight);
    }
    for (let y = startY; y <= endY; y += gridSpacing) {
      const screenY = Math.round((y + offsetY) * scale) + 0.5;
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvasWidth, screenY);
    }
    ctx.stroke();

    // 绘制主网格线
    const majorStartX = Math.floor(topLeft.x / majorGridSpacing) * majorGridSpacing;
    const majorEndX = Math.ceil(bottomRight.x / majorGridSpacing) * majorGridSpacing;
    const majorStartY = Math.floor(topLeft.y / majorGridSpacing) * majorGridSpacing;
    const majorEndY = Math.ceil(bottomRight.y / majorGridSpacing) * majorGridSpacing;

    ctx.strokeStyle = this.colors.gridMajor;
    ctx.beginPath();
    for (let x = majorStartX; x <= majorEndX; x += majorGridSpacing) {
      const screenX = Math.round((x + offsetX) * scale) + 0.5;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, canvasHeight);
    }
    for (let y = majorStartY; y <= majorEndY; y += majorGridSpacing) {
      const screenY = Math.round((y + offsetY) * scale) + 0.5;
      ctx.moveTo(0, screenY);
      ctx.lineTo(canvasWidth, screenY);
    }
    ctx.stroke();
  }

  /**
   * 绘制坐标轴（原点处的X/Y轴）
   */
  private drawAxes(canvasWidth: number, canvasHeight: number): void {
    const origin = this.viewport.worldToScreen(0, 0);
    const ctx = this.ctx;
    const axisLength = 30; // 箭头长度（像素）

    // X轴（红色）
    if (origin.x >= 0 && origin.x <= canvasWidth) {
      ctx.strokeStyle = this.colors.axisX;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x + axisLength, origin.y);
      // 箭头
      ctx.lineTo(origin.x + axisLength - 6, origin.y - 4);
      ctx.moveTo(origin.x + axisLength, origin.y);
      ctx.lineTo(origin.x + axisLength - 6, origin.y + 4);
      ctx.stroke();

      // 标签
      ctx.fillStyle = this.colors.axisX;
      ctx.font = '10px monospace';
      ctx.fillText('X', origin.x + axisLength + 4, origin.y + 4);
    }

    // Y轴（绿色）- 注意Canvas Y轴向下
    if (origin.y >= 0 && origin.y <= canvasHeight) {
      ctx.strokeStyle = this.colors.axisY;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x, origin.y - axisLength);
      // 箭头
      ctx.lineTo(origin.x - 4, origin.y - axisLength + 6);
      ctx.moveTo(origin.x, origin.y - axisLength);
      ctx.lineTo(origin.x + 4, origin.y - axisLength + 6);
      ctx.stroke();

      // 标签
      ctx.fillStyle = this.colors.axisY;
      ctx.font = '10px monospace';
      ctx.fillText('Y', origin.x + 4, origin.y - axisLength - 4);
    }
  }

  /**
   * 绘制十字光标
   */
  private drawCrosshair(canvasWidth: number, canvasHeight: number): void {
    const { mouseScreen } = this.viewport;
    const ctx = this.ctx;

    // 光标超出画布范围时不绘制
    if (
      mouseScreen.x < 0 || mouseScreen.x > canvasWidth ||
      mouseScreen.y < 0 || mouseScreen.y > canvasHeight
    ) {
      return;
    }

    ctx.strokeStyle = this.colors.crosshair;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);

    // 水平线
    ctx.beginPath();
    ctx.moveTo(0, mouseScreen.y);
    ctx.lineTo(canvasWidth, mouseScreen.y);
    ctx.stroke();

    // 垂直线
    ctx.beginPath();
    ctx.moveTo(mouseScreen.x, 0);
    ctx.lineTo(mouseScreen.x, canvasHeight);
    ctx.stroke();

    ctx.setLineDash([]);

    // 中心小圆点
    ctx.fillStyle = this.colors.crosshair;
    ctx.beginPath();
    ctx.arc(mouseScreen.x, mouseScreen.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 获取当前网格间距（世界坐标）
   * auto 模式根据缩放自适应，fixed 模式返回固定值
   */
  public getGridSpacing(scale: number): number {
    if (this.gridSizeMode === 'fixed') {
      return this.gridSize;
    }
    return calculateGridSpacing(scale);
  }

  /**
   * 获取网格大小模式
   */
  public getGridSizeMode(): 'auto' | 'fixed' {
    return this.gridSizeMode;
  }

  /**
   * 获取固定网格间距
   */
  public getGridSize(): number {
    return this.gridSize;
  }

  /**
   * 设置网格大小模式
   */
  public setGridSizeMode(mode: 'auto' | 'fixed'): void {
    this.gridSizeMode = mode;
  }

  /**
   * 设置固定网格间距并切换到 fixed 模式
   */
  public setGridSize(size: number): void {
    this.gridSize = size;
    this.gridSizeMode = 'fixed';
  }

  /**
   * 设置网格显示
   */
  public setShowGrid(show: boolean): void {
    this.showGrid = show;
  }

  /**
   * 设置坐标轴显示
   */
  public setShowAxes(show: boolean): void {
    this.showAxes = show;
  }

  /**
   * 销毁渲染器
   */
  public destroy(): void {
    this.stop();
  }
}
