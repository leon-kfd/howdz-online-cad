/** 二维点 */
export interface Point {
  x: number;
  y: number;
}

/** 包围盒 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** CAD配置选项 */
export interface CADOptions {
  /** 挂载容器（CSS选择器或DOM元素） */
  container: string | HTMLElement;
  /** 画布宽度，默认 '100%' */
  width?: string | number;
  /** 画布高度，默认 '100%' */
  height?: string | number;
  /** 是否显示网格，默认 true */
  showGrid?: boolean;
  /** 是否显示坐标轴，默认 true */
  showAxes?: boolean;
  /** 背景色，默认 '#1e1e1e' */
  backgroundColor?: string;
  /** 网格颜色，默认 '#333333' */
  gridColor?: string;
  /** 主网格颜色，默认 '#444444' */
  gridMajorColor?: string;
}

/** 视口状态 */
export interface ViewportState {
  /** 平移偏移X（屏幕像素） */
  offsetX: number;
  /** 平移偏移Y（屏幕像素） */
  offsetY: number;
  /** 缩放比例 */
  scale: number;
}

/** 鼠标按钮枚举 */
export enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2,
}
