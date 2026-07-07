import { Entity } from './Entity';
import { BoundingBox } from './types';

/**
 * 实体管理器
 * 管理所有CAD实体的增删查改和选择操作
 */
export class EntityManager {
  /** 所有实体 */
  private entities: Entity[] = [];
  /** 选中的实体集合 */
  private selectedSet: Set<string> = new Set();

  /** 实体变更回调 */
  public onChange: (() => void) | null = null;

  /**
   * 添加实体
   */
  public add(entity: Entity): void {
    this.entities.push(entity);
    this.onChange?.();
  }

  /**
   * 批量添加实体
   */
  public addAll(entityList: Entity[]): void {
    this.entities.push(...entityList);
    this.onChange?.();
  }

  /**
   * 移除实体
   */
  public remove(entity: Entity): boolean {
    const index = this.entities.indexOf(entity);
    if (index === -1) return false;
    this.entities.splice(index, 1);
    this.selectedSet.delete(entity.id);
    this.onChange?.();
    return true;
  }

  /**
   * 按ID移除实体
   */
  public removeById(id: string): boolean {
    const index = this.entities.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.entities.splice(index, 1);
    this.selectedSet.delete(id);
    this.onChange?.();
    return true;
  }

  /**
   * 清除所有实体
   */
  public clear(): void {
    this.entities = [];
    this.selectedSet.clear();
    this.onChange?.();
  }

  /**
   * 获取所有实体
   */
  public getAll(): Entity[] {
    return this.entities;
  }

  /**
   * 获取实体数量
   */
  public getCount(): number {
    return this.entities.length;
  }

  /**
   * 按ID查找实体
   */
  public getById(id: string): Entity | undefined {
    return this.entities.find(e => e.id === id);
  }

  /**
   * 根据世界坐标点进行命中测试
   * 返回命中的实体列表（按绘制顺序，后绘制的在前）
   */
  public hitTest(worldX: number, worldY: number, tolerance: number): Entity[] {
    // 从后往前遍历（后绘制的在上层）
    const hits: Entity[] = [];
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (!entity.visible || entity.locked) continue;
      if (entity.hitTest(worldX, worldY, tolerance)) {
        hits.push(entity);
      }
    }
    return hits;
  }

  /**
   * 获取与包围盒相交的实体（框选用）
   * 如果 onlyFullyContained 为 true，则只返回完全在框内的实体
   */
  public hitTestBoundingBox(bbox: BoundingBox, onlyFullyContained: boolean): Entity[] {
    const hits: Entity[] = [];
    for (const entity of this.entities) {
      if (!entity.visible || entity.locked) continue;
      const eb = entity.getBoundingBox();
      if (onlyFullyContained) {
        // 完全包含
        if (eb.minX >= bbox.minX && eb.minY >= bbox.minY &&
            eb.maxX <= bbox.maxX && eb.maxY <= bbox.maxY) {
          hits.push(entity);
        }
      } else {
        // 相交即可
        if (eb.minX <= bbox.maxX && eb.maxX >= bbox.minX &&
            eb.minY <= bbox.maxY && eb.maxY >= bbox.minY) {
          hits.push(entity);
        }
      }
    }
    return hits;
  }

  // ========== 选择操作 ==========

  /**
   * 选择实体（替换选择集）
   */
  public select(entity: Entity): void {
    this.selectedSet.clear();
    this.selectedSet.add(entity.id);
    this.onChange?.();
  }

  /**
   * 追加选择实体
   */
  public selectAdd(entity: Entity): void {
    this.selectedSet.add(entity.id);
    this.onChange?.();
  }

  /**
   * 从选择集中移除实体
   */
  public selectRemove(entity: Entity): void {
    this.selectedSet.delete(entity.id);
    this.onChange?.();
  }

  /**
   * 批量选择（替换选择集）
   */
  public selectAll(entityList: Entity[]): void {
    this.selectedSet.clear();
    for (const entity of entityList) {
      this.selectedSet.add(entity.id);
    }
    this.onChange?.();
  }

  /**
   * 清除选择
   */
  public clearSelection(): void {
    if (this.selectedSet.size === 0) return;
    this.selectedSet.clear();
    this.onChange?.();
  }

  /**
   * 切换选择状态
   */
  public toggleSelect(entity: Entity): void {
    if (this.selectedSet.has(entity.id)) {
      this.selectedSet.delete(entity.id);
    } else {
      this.selectedSet.add(entity.id);
    }
    this.onChange?.();
  }

  /**
   * 判断实体是否被选中
   */
  public isSelected(entity: Entity): boolean {
    return this.selectedSet.has(entity.id);
  }

  /**
   * 获取所有选中的实体
   */
  public getSelected(): Entity[] {
    return this.entities.filter(e => this.selectedSet.has(e.id));
  }

  /**
   * 获取选中实体数量
   */
  public getSelectedCount(): number {
    return this.selectedSet.size;
  }
}
