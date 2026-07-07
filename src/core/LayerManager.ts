import { Entity } from './Entity';

/** ACI (AutoCAD Color Index) 标准8色 */
export const ACI_LAYER_COLORS: Record<number, string> = {
  1: '#FF0000', // 红
  2: '#FFFF00', // 黄
  3: '#00FF00', // 绿
  4: '#00FFFF', // 青
  5: '#0000FF', // 蓝
  6: '#FF00FF', // 品红
  7: '#FFFFFF', // 白
  8: '#808080', // 灰
};

/** 图层信息 */
export interface LayerInfo {
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

/**
 * 图层管理器
 * 管理CAD图层的增删查改、显示/隐藏、锁定/解锁
 */
export class LayerManager {
  /** 图层列表（保持插入顺序） */
  private layers: LayerInfo[] = [];
  /** 当前图层名 */
  private currentLayerName: string = '0';

  /** 图层变更回调 */
  public onChange: (() => void) | null = null;

  constructor() {
    // 默认图层0
    this.layers.push({
      name: '0',
      color: '#FFFFFF',
      visible: true,
      locked: false,
    });
  }

  /**
   * 添加图层
   * @returns 成功添加的图层，如果名称已存在返回null
   */
  public addLayer(name: string, color: string = '#FFFFFF'): LayerInfo | null {
    if (this.hasLayer(name)) return null;

    const layer: LayerInfo = {
      name,
      color,
      visible: true,
      locked: false,
    };
    this.layers.push(layer);
    this.onChange?.();
    return layer;
  }

  /**
   * 删除图层
   * 不能删除默认图层0和当前图层
   * @returns 是否成功删除
   */
  public removeLayer(name: string): boolean {
    if (name === '0') return false; // 不能删除默认图层
    if (name === this.currentLayerName) return false; // 不能删除当前图层

    const index = this.layers.findIndex(l => l.name === name);
    if (index === -1) return false;

    this.layers.splice(index, 1);
    this.onChange?.();
    return true;
  }

  /**
   * 重命名图层
   * 不能重命名默认图层0
   * @returns 是否成功重命名
   */
  public renameLayer(oldName: string, newName: string): boolean {
    if (oldName === '0') return false; // 不能重命名默认图层
    if (oldName === newName) return true;
    if (this.hasLayer(newName)) return false; // 新名称已存在

    const layer = this.getLayer(oldName);
    if (!layer) return false;

    layer.name = newName;

    // 如果是当前图层，更新当前图层名
    if (this.currentLayerName === oldName) {
      this.currentLayerName = newName;
    }

    this.onChange?.();
    return true;
  }

  /**
   * 设置图层颜色
   */
  public setLayerColor(name: string, color: string): boolean {
    const layer = this.getLayer(name);
    if (!layer) return false;

    layer.color = color;
    this.onChange?.();
    return true;
  }

  /**
   * 切换图层可见性
   * @returns 切换后的可见状态
   */
  public toggleVisibility(name: string): boolean {
    const layer = this.getLayer(name);
    if (!layer) return layer!.visible;

    layer.visible = !layer.visible;
    this.onChange?.();
    return layer.visible;
  }

  /**
   * 设置图层可见性
   */
  public setVisibility(name: string, visible: boolean): boolean {
    const layer = this.getLayer(name);
    if (!layer) return false;

    layer.visible = visible;
    this.onChange?.();
    return true;
  }

  /**
   * 切换图层锁定状态
   * @returns 切换后的锁定状态
   */
  public toggleLock(name: string): boolean {
    const layer = this.getLayer(name);
    if (!layer) return layer!.locked;

    layer.locked = !layer.locked;
    this.onChange?.();
    return layer.locked;
  }

  /**
   * 设置图层锁定状态
   */
  public setLock(name: string, locked: boolean): boolean {
    const layer = this.getLayer(name);
    if (!layer) return false;

    layer.locked = locked;
    this.onChange?.();
    return true;
  }

  /**
   * 设置当前图层
   * @returns 是否成功设置
   */
  public setCurrentLayer(name: string): boolean {
    if (!this.hasLayer(name)) return false;

    this.currentLayerName = name;
    this.onChange?.();
    return true;
  }

  /**
   * 获取当前图层名
   */
  public getCurrentLayer(): string {
    return this.currentLayerName;
  }

  /**
   * 获取当前图层信息
   */
  public getCurrentLayerInfo(): LayerInfo | undefined {
    return this.getLayer(this.currentLayerName);
  }

  /**
   * 按名称获取图层
   */
  public getLayer(name: string): LayerInfo | undefined {
    return this.layers.find(l => l.name === name);
  }

  /**
   * 获取所有图层
   */
  public getLayers(): LayerInfo[] {
    return this.layers;
  }

  /**
   * 检查图层是否存在
   */
  public hasLayer(name: string): boolean {
    return this.layers.some(l => l.name === name);
  }

  /**
   * 检查图层是否可见
   */
  public isLayerVisible(name: string): boolean {
    const layer = this.getLayer(name);
    return layer ? layer.visible : true;
  }

  /**
   * 检查图层是否锁定
   */
  public isLayerLocked(name: string): boolean {
    const layer = this.getLayer(name);
    return layer ? layer.locked : false;
  }

  /**
   * 获取图层的颜色（用于实体绘制时的回退颜色）
   */
  public getLayerColor(name: string): string {
    const layer = this.getLayer(name);
    return layer ? layer.color : '#FFFFFF';
  }

  /**
   * 获取图层上的实体数量
   */
  public getLayerEntityCount(name: string, entities: Entity[]): number {
    return entities.filter(e => e.layer === name).length;
  }
}
