import { Viewport } from './Viewport';
import { Renderer } from './Renderer';
import { CADOptions, Point } from './types';
import { formatCoord } from '../utils/math';
import { EntityManager } from './EntityManager';
import { LayerManager } from './LayerManager';
import { ToolManager } from './tools/ToolManager';
import { SelectTool } from './tools/SelectTool';
import { LineTool } from './tools/LineTool';
import { CircleTool } from './tools/CircleTool';
import { ArcTool } from './tools/ArcTool';
import { CopyTool } from './tools/CopyTool';
import { MoveTool } from './tools/MoveTool';
import { FilletTool } from './tools/FilletTool';
import { ChamferTool } from './tools/ChamferTool';
import { ExtendTool } from './tools/ExtendTool';
import { Entity, LineEntity, CircleEntity, ArcEntity } from './Entity';
import { DXFParser, DXFParseResult } from './DXFParser';
import { DXFWriter } from './DXFWriter';

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

  private entityManager: EntityManager;
  private layerManager: LayerManager;
  private toolManager: ToolManager;

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

    // 初始化实体管理器
    this.entityManager = new EntityManager();

    // 初始化图层管理器
    this.layerManager = new LayerManager();
    this.entityManager.setLayerManager(this.layerManager);

    // 初始化渲染器
    this.renderer = new Renderer(this.canvas, this.viewport, {
      showGrid: this.options.showGrid,
      showAxes: this.options.showAxes,
      backgroundColor: this.options.backgroundColor,
      gridColor: this.options.gridColor,
      gridMajorColor: this.options.gridMajorColor,
      entityManager: this.entityManager,
    });
    this.renderer.setLayerManager(this.layerManager);

    // 初始化工具管理器
    this.toolManager = new ToolManager();
    this.setupTools();

    // 视口变化时更新状态栏
    this.viewport.onUpdate = () => this.updateStatusBar();

    // 绑定鼠标事件到工具管理器
    this.bindToolEvents();

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
    canvas.tabIndex = 0;  // 使画布可接收键盘事件
    canvas.style.cursor = 'crosshair';
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
   * 设置工具
   */
  private setupTools(): void {
    // 辅助函数：为新实体设置当前图层
    const setCurrentLayer = (entity: Entity) => {
      entity.layer = this.layerManager.getCurrentLayer();
    };

    // 注册选择工具
    const selectTool = new SelectTool(this.entityManager, this.viewport);
    this.toolManager.register(selectTool);

    // 注册直线工具
    const lineTool = new LineTool((entity: LineEntity) => {
      setCurrentLayer(entity);
      this.entityManager.add(entity);
    });
    this.toolManager.register(lineTool);

    // 注册圆形工具
    const circleTool = new CircleTool((entity: CircleEntity) => {
      setCurrentLayer(entity);
      this.entityManager.add(entity);
    });
    this.toolManager.register(circleTool);

    // 注册圆弧工具
    const arcTool = new ArcTool((entity: ArcEntity) => {
      setCurrentLayer(entity);
      this.entityManager.add(entity);
    });
    this.toolManager.register(arcTool);

    // 注册复制工具
    const copyTool = new CopyTool(this.entityManager, (entity) => {
      setCurrentLayer(entity);
      this.entityManager.add(entity);
    });
    this.toolManager.register(copyTool);

    // 注册移动工具
    const moveTool = new MoveTool(this.entityManager);
    this.toolManager.register(moveTool);

    // 注册倒圆角工具
    const filletTool = new FilletTool(this.entityManager, (entity) => {
      setCurrentLayer(entity);
      this.entityManager.add(entity);
    });
    this.toolManager.register(filletTool);

    // 注册倒角工具
    const chamferTool = new ChamferTool(this.entityManager, (entity) => {
      setCurrentLayer(entity);
      this.entityManager.add(entity);
    });
    this.toolManager.register(chamferTool);

    // 注册延伸工具
    const extendTool = new ExtendTool(this.entityManager);
    this.toolManager.register(extendTool);

    // 默认激活选择工具
    this.toolManager.setActiveTool('select');

    // 将工具管理器的叠加层绘制传递给渲染器
    this.renderer.setOverlayRenderer((ctx) => {
      this.toolManager.drawOverlay(ctx, this.viewport);
    });
  }

  /**
   * 绑定画布鼠标/键盘事件到工具管理器
   */
  private bindToolEvents(): void {
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      const { mouseWorld, mouseScreen, scale } = this.viewport;
      this.toolManager.dispatchMouseDown(mouseWorld, mouseScreen, scale, e);
    });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const { mouseWorld, mouseScreen, scale } = this.viewport;
      this.toolManager.dispatchMouseMove(mouseWorld, mouseScreen, scale, e);
    });

    this.canvas.addEventListener('mouseup', (e: MouseEvent) => {
      const { mouseWorld, mouseScreen, scale } = this.viewport;
      this.toolManager.dispatchMouseUp(mouseWorld, mouseScreen, scale, e);
    });

    this.canvas.addEventListener('keydown', (e: KeyboardEvent) => {
      const { mouseWorld, mouseScreen, scale } = this.viewport;
      this.toolManager.dispatchKeyDown(mouseWorld, mouseScreen, scale, e);
    });
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
    const toolName = this.toolManager.getActiveToolName() || '无';
    const ortho = this.toolManager.orthoMode ? '正交' : '';
    const snap = this.toolManager.snapMode ? '捕捉' : '';
    const entityCount = this.entityManager.getCount();
    const selectedCount = this.entityManager.getSelectedCount();
    const currentLayer = this.layerManager.getCurrentLayer();

    let statusHtml = `
      <span>X: ${formatCoord(mouseWorld.x)}</span>
      <span>Y: ${formatCoord(mouseWorld.y)}</span>
      <span>缩放: ${(scale * 100).toFixed(0)}%</span>
      <span>FPS: ${fps}</span>
      <span>工具: ${toolName}</span>
    `;

    if (ortho) {
      statusHtml += `<span style="color: #0078d4">${ortho}</span>`;
    }

    if (snap) {
      statusHtml += `<span style="color: #0078d4">${snap}</span>`;
    }

    statusHtml += `
      <span>图层: ${currentLayer}</span>
      <span>图元: ${entityCount}</span>
    `;

    if (selectedCount > 0) {
      statusHtml += `<span style="color: #0078d4">选中: ${selectedCount}</span>`;
    }

    this.statusBar.innerHTML = statusHtml;
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
   * 获取实体管理器
   */
  public getEntityManager(): EntityManager {
    return this.entityManager;
  }

  /**
   * 获取工具管理器
   */
  public getToolManager(): ToolManager {
    return this.toolManager;
  }

  /**
   * 获取图层管理器
   */
  public getLayerManager(): LayerManager {
    return this.layerManager;
  }

  /**
   * 执行命令（命令行接口）
   * 支持: LINE x1,y1 x2,y2
   */
  public executeCommand(commandLine: string): boolean {
    const trimmed = commandLine.trim();
    if (!trimmed) return false;

    // 分离命令和参数
    const spaceIndex = trimmed.indexOf(' ');
    const cmd = (spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex)).toUpperCase();
    const args = spaceIndex === -1 ? '' : trimmed.substring(spaceIndex + 1).trim();

    switch (cmd) {
      case 'LINE':
      case 'L': {
        const result = LineTool.parseCommandLine(args);
        if (result) {
          const line = new LineEntity(result.start.x, result.start.y, result.end.x, result.end.y);
          this.entityManager.add(line);
          return true;
        }
        // 如果没有参数，切换到直线工具
        this.toolManager.setActiveTool('line');
        return true;
      }
      case 'CIRCLE':
      case 'C': {
        const result = CircleTool.parseCommandLine(args);
        if (result) {
          const circle = new CircleEntity(result.center.x, result.center.y, result.radius);
          this.entityManager.add(circle);
          return true;
        }
        // 如果没有参数，切换到圆形工具
        this.toolManager.setActiveTool('circle');
        return true;
      }
      case 'ARC':
      case 'A': {
        const arc = ArcTool.parseCommandLine(args);
        if (arc) {
          this.entityManager.add(arc);
          return true;
        }
        // 如果没有参数，切换到圆弧工具
        this.toolManager.setActiveTool('arc');
        return true;
      }
      case 'SELECT':
      case 'SEL': {
        this.toolManager.setActiveTool('select');
        return true;
      }
      case 'COPY':
      case 'CO': {
        this.toolManager.setActiveTool('copy');
        return true;
      }
      case 'MOVE':
      case 'M': {
        this.toolManager.setActiveTool('move');
        return true;
      }
      case 'FILLET':
      case 'F': {
        const result = FilletTool.parseCommandLine(args);
        if (result) {
          const filletTool = this.toolManager.getTool('fillet') as FilletTool;
          if (filletTool) filletTool.setRadius(result.radius);
          return true;
        }
        // 切换到倒圆角工具
        this.toolManager.setActiveTool('fillet');
        return true;
      }
      case 'CHAMFER':
      case 'CHA': {
        const result = ChamferTool.parseCommandLine(args);
        if (result) {
          const chamferTool = this.toolManager.getTool('chamfer') as ChamferTool;
          if (chamferTool) {
            if (result.dist !== undefined) {
              chamferTool.setDistance(result.dist);
            } else {
              if (result.dist1 !== undefined) chamferTool.setDistance1(result.dist1);
              if (result.dist2 !== undefined) chamferTool.setDistance2(result.dist2);
            }
          }
          return true;
        }
        // 切换到倒角工具
        this.toolManager.setActiveTool('chamfer');
        return true;
      }
      case 'EXTEND':
      case 'EX': {
        // 切换到延伸工具
        this.toolManager.setActiveTool('extend');
        return true;
      }
      case 'ERASE': {
        const upperArgs = args.toUpperCase();
        if (upperArgs === 'ALL') {
          // 清除全部
          if (this.entityManager.getCount() === 0) return true;
          if (confirm(`确定要删除全部 ${this.entityManager.getCount()} 个图元？`)) {
            this.entityManager.clear();
          }
          return true;
        }
        if (upperArgs === 'U' || upperArgs === 'UNDO') {
          // 撤销上一次删除
          return this.entityManager.undo();
        }
        // 删除选中实体
        this.entityManager.eraseSelected();
        return true;
      }
      case 'E': {
        // E 短命令：删除选中实体
        this.entityManager.eraseSelected();
        return true;
      }
      case 'OPEN': {
        // OPEN命令触发文件选择（由demo层处理）
        return true;
      }
      case 'SAVE': {
        // SAVE命令触发DXF导出（由demo层处理）
        return true;
      }
      case 'LAYER':
      case 'LA': {
        return this.executeLayerCommand(args);
      }
      default:
        return false;
    }
  }

  /**
   * 执行图层子命令
   * 支持: LAYER NEW <name> [color], LAYER DEL <name>, LAYER SET <name>
   * @returns 子命令执行结果（true=成功, false=未知子命令）
   */
  private executeLayerCommand(args: string): boolean {
    if (!args) {
      // 无参数：显示图层列表（由demo层处理显示）
      return true;
    }

    const parts = args.trim().split(/\s+/);
    const subCmd = parts[0].toUpperCase();

    switch (subCmd) {
      case 'NEW':
      case 'N': {
        const name = parts[1];
        if (!name) return false;
        const color = parts[2] || '#FFFFFF';
        const layer = this.layerManager.addLayer(name, color);
        return layer !== null;
      }
      case 'DEL':
      case 'D': {
        const name = parts[1];
        if (!name) return false;
        return this.layerManager.removeLayer(name);
      }
      case 'SET':
      case 'S': {
        const name = parts[1];
        if (!name) return false;
        return this.layerManager.setCurrentLayer(name);
      }
      default:
        return false;
    }
  }

  /**
   * 缩放到全部显示
   */
  public zoomExtents(): void {
    const size = this.renderer.getSize();
    this.viewport.fitBounds(-100, -100, 100, 100, size.width, size.height);
  }

  /**
   * 加载DXF文件内容
   * 解析DXF中的LINE、CIRCLE、ARC实体并添加到画布
   * @param content DXF文件文本内容
   * @returns 解析结果（实体数、版本等）
   */
  public loadDXF(content: string): DXFParseResult {
    const result = DXFParser.parse(content);

    // 同步DXF图层到图层管理器
    for (const dxfLayer of result.layers) {
      if (!this.layerManager.hasLayer(dxfLayer.name)) {
        this.layerManager.addLayer(dxfLayer.name, dxfLayer.color || '#FFFFFF');
      }
      const layer = this.layerManager.getLayer(dxfLayer.name);
      if (layer) {
        layer.visible = dxfLayer.visible;
        layer.locked = dxfLayer.locked;
        if (dxfLayer.color) layer.color = dxfLayer.color;
      }
    }

    // 添加解析到的实体
    if (result.entities.length > 0) {
      this.entityManager.clear();
      this.entityManager.addAll(result.entities);
    }

    // 缩放到全部显示
    if (result.entities.length > 0) {
      const bbox = this.computeEntitiesBounds();
      if (bbox) {
        const size = this.renderer.getSize();
        this.viewport.fitBounds(bbox.minX, bbox.minY, bbox.maxX, bbox.maxY, size.width, size.height);
      }
    }

    return result;
  }

  /**
   * 导出当前实体为DXF格式字符串
   * @returns DXF文件内容
   */
  public saveDXF(): string {
    const layers = this.layerManager.getLayers().map(l => ({
      name: l.name,
      color: l.color,
      visible: l.visible,
      locked: l.locked,
    }));
    return DXFWriter.export(this.entityManager.getAll(), layers);
  }

  /**
   * 计算所有实体的包围盒
   */
  private computeEntitiesBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const entities = this.entityManager.getAll();
    if (entities.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of entities) {
      const bb = entity.getBoundingBox();
      if (bb.minX < minX) minX = bb.minX;
      if (bb.minY < minY) minY = bb.minY;
      if (bb.maxX > maxX) maxX = bb.maxX;
      if (bb.maxY > maxY) maxY = bb.maxY;
    }

    return { minX, minY, maxX, maxY };
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
   * 删除选中的实体（支持撤销）
   * @returns 被删除的实体数量
   */
  public eraseSelected(): number {
    return this.entityManager.eraseSelected();
  }

  /**
   * 撤销上一步操作
   * @returns 是否成功撤销
   */
  public undo(): boolean {
    return this.entityManager.undo();
  }

  /**
   * 是否有可撤销的操作
   */
  public canUndo(): boolean {
    return this.entityManager.canUndo();
  }

  /**
   * 重做上一步操作
   * @returns 是否成功重做
   */
  public redo(): boolean {
    return this.entityManager.redo();
  }

  /**
   * 是否有可重做的操作
   */
  public canRedo(): boolean {
    return this.entityManager.canRedo();
  }

  /**
   * 获取撤销操作次数
   */
  public getUndoCount(): number {
    return this.entityManager.getUndoCount();
  }

  /**
   * 获取重做操作次数
   */
  public getRedoCount(): number {
    return this.entityManager.getRedoCount();
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
