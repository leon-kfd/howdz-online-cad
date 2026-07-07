import { Point, ViewportState, MouseButton } from './types';
import { clamp } from '../utils/math';

/** 最小缩放比例 */
const MIN_SCALE = 0.01;
/** 最大缩放比例 */
const MAX_SCALE = 100;
/** 缩放灵敏度 */
const ZOOM_SENSITIVITY = 0.001;

/**
 * 视口管理器
 * 负责平移、缩放和坐标变换
 */
export class Viewport {
  /** 平移偏移X（屏幕像素） */
  public offsetX = 0;
  /** 平移偏移Y（屏幕像素） */
  public offsetY = 0;
  /** 缩放比例 */
  public scale = 1;

  /** 鼠标在世界坐标中的位置 */
  public mouseWorld: Point = { x: 0, y: 0 };
  /** 鼠标在屏幕坐标中的位置 */
  public mouseScreen: Point = { x: 0, y: 0 };

  private canvas: HTMLCanvasElement;
  private isPanning = false;
  private panStartScreen: Point = { x: 0, y: 0 };
  private panStartOffset: Point = { x: 0, y: 0 };

  /** 状态变化回调 */
  public onUpdate: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  /**
   * 绑定鼠标事件
   */
  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    // 鼠标离开画布时停止平移
    this.canvas.addEventListener('mouseleave', this.onMouseUp);
  }

  /**
   * 解绑事件
   */
  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('mouseleave', this.onMouseUp);
  }

  /**
   * 鼠标按下 - 开始平移
   */
  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === MouseButton.Middle) {
      this.isPanning = true;
      this.panStartScreen = { x: e.clientX, y: e.clientY };
      this.panStartOffset = { x: this.offsetX, y: this.offsetY };
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  };

  /**
   * 鼠标移动 - 更新平移或光标位置
   */
  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreen = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    this.mouseWorld = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);

    if (this.isPanning) {
      const dx = e.clientX - this.panStartScreen.x;
      const dy = e.clientY - this.panStartScreen.y;
      this.offsetX = this.panStartOffset.x + dx / this.scale;
      this.offsetY = this.panStartOffset.y + dy / this.scale;
    }

    this.onUpdate?.();
  };

  /**
   * 鼠标释放 - 结束平移
   */
  private onMouseUp = (): void => {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'crosshair';
    }
  };

  /**
   * 鼠标滚轮 - 缩放
   * 缩放中心为鼠标位置
   */
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 缩放前鼠标在世界坐标中的位置
    const worldBefore = this.screenToWorld(mouseX, mouseY);

    // 应用缩放
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newScale = clamp(this.scale * (1 + delta), MIN_SCALE, MAX_SCALE);
    this.scale = newScale;

    // 缩放后调整偏移，使鼠标下的世界坐标点保持不动
    const worldAfter = this.screenToWorld(mouseX, mouseY);
    this.offsetX += worldAfter.x - worldBefore.x;
    this.offsetY += worldAfter.y - worldBefore.y;

    this.onUpdate?.();
  };

  /**
   * 阻止右键菜单
   */
  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  /**
   * 屏幕坐标 → 世界坐标
   */
  public screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: screenX / this.scale - this.offsetX,
      y: screenY / this.scale - this.offsetY,
    };
  }

  /**
   * 世界坐标 → 屏幕坐标
   */
  public worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: (worldX + this.offsetX) * this.scale,
      y: (worldY + this.offsetY) * this.scale,
    };
  }

  /**
   * 获取当前视口状态
   */
  public getState(): ViewportState {
    return {
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      scale: this.scale,
    };
  }

  /**
   * 重置视口到初始状态
   */
  public reset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.onUpdate?.();
  }

  /**
   * 缩放到适合显示指定区域
   */
  public fitBounds(minX: number, minY: number, maxX: number, maxY: number, canvasWidth: number, canvasHeight: number): void {
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    if (worldWidth === 0 && worldHeight === 0) {
      this.reset();
      return;
    }

    const padding = 50; // 像素边距
    const scaleX = (canvasWidth - padding * 2) / worldWidth;
    const scaleY = (canvasHeight - padding * 2) / worldHeight;
    this.scale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, MAX_SCALE);

    // 居中显示
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.offsetX = canvasWidth / 2 / this.scale - centerX;
    this.offsetY = canvasHeight / 2 / this.scale - centerY;

    this.onUpdate?.();
  }
}
