import { Entity } from './Entity';
import { BoundingBox, Point } from './types';

/** 夹点命中结果 */
export interface GripHitResult {
  entity: Entity;
  gripIndex: number;
  point: Point;
}

/**
 * 撤销条目
 */
interface UndoEntry {
  /** 被删除的实体（按顺序） */
  entities: Entity[];
  /** 在原数组中的插入位置 */
  index: number;
}

/**
 * 实体管理器
 * 管理所有CAD实体的增删查改和选择操作
 */
export class EntityManager {
  /** 所有实体 */
  private entities: Entity[] = [];
  /** 选中的实体集合 */
  private selectedSet: Set<string> = new Set();
  /** 撤销栈（仅用于删除操作） */
  private undoStack: UndoEntry[] = [];
  /** 重做栈 */
  private redoStack: UndoEntry[] = [];

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
   * 命中测试夹点：返回最近的夹点（在选中实体中查找）
   */
  public hitTestGripPoint(worldX: number, worldY: number, tolerance: number): GripHitResult | null {
    let bestDist = tolerance;
    let bestResult: GripHitResult | null = null;

    for (const entity of this.entities) {
      if (!entity.visible || entity.locked) continue;
      if (!this.selectedSet.has(entity.id)) continue;

      const grips = entity.getGripPoints();
      for (let i = 0; i < grips.length; i++) {
        const d = Math.hypot(worldX - grips[i].x, worldY - grips[i].y);
        if (d < bestDist) {
          bestDist = d;
          bestResult = { entity, gripIndex: i, point: grips[i] };
        }
      }
    }

    return bestResult;
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

  // ========== 删除与撤销 ==========

  /**
   * 删除选中的实体（支持撤销）
   * @returns 被删除的实体数量
   */
  public eraseSelected(): number {
    const selected = this.getSelected();
    if (selected.length === 0) return 0;

    // 记录第一个被删实体在数组中的位置（用于精确撤销恢复位置）
    const firstIndex = this.entities.indexOf(selected[0]);

    // 从实体数组中移除
    for (const entity of selected) {
      const idx = this.entities.indexOf(entity);
      if (idx !== -1) {
        this.entities.splice(idx, 1);
      }
    }
    this.selectedSet.clear();

    // 压入撤销栈，清空重做栈（新操作使重做历史失效）
    this.undoStack.push({ entities: selected, index: firstIndex });
    this.redoStack = [];
    this.onChange?.();
    return selected.length;
  }

  /**
   * 撤销上一次删除操作
   * @returns 恢复的实体数量，如果没有可撤销的操作返回 0
   */
  public undo(): number {
    const entry = this.undoStack.pop();
    if (!entry) return 0;

    // 记录恢复实体的当前位置（用于重做时精确移除）
    const insertAt = Math.min(entry.index, this.entities.length);

    // 在原位置插入恢复的实体
    this.entities.splice(insertAt, 0, ...entry.entities);

    // 压入重做栈
    this.redoStack.push({ entities: entry.entities, index: insertAt });
    this.onChange?.();
    return entry.entities.length;
  }

  /**
   * 是否有可撤销的操作
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * 重做上一次撤销的操作（重新删除已恢复的实体）
   * @returns 被重新删除的实体数量
   */
  public redo(): number {
    const entry = this.redoStack.pop();
    if (!entry) return 0;

    // 重新删除这些实体
    for (const entity of entry.entities) {
      const idx = this.entities.indexOf(entity);
      if (idx !== -1) {
        this.entities.splice(idx, 1);
      }
    }

    // 压回撤销栈
    this.undoStack.push(entry);
    this.onChange?.();
    return entry.entities.length;
  }

  /**
   * 是否有可重做的操作
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
