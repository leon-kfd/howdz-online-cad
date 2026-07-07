import { Entity } from '../Entity';

/**
 * 命令接口 - 所有可撤销操作的基础
 */
export interface Command {
  /** 执行命令 */
  execute(): void;
  /** 撤销命令 */
  undo(): void;
  /** 命令描述（用于调试和UI显示） */
  readonly description: string;
}

/**
 * 添加实体命令
 */
export class AddEntityCommand implements Command {
  public readonly description: string;
  private entities: Entity[];
  private addFn: (entity: Entity) => void;
  private removeFn: (entity: Entity) => boolean;

  constructor(
    entities: Entity[],
    addFn: (entity: Entity) => void,
    removeFn: (entity: Entity) => boolean,
    description?: string,
  ) {
    this.entities = entities;
    this.addFn = addFn;
    this.removeFn = removeFn;
    this.description = description || `添加 ${entities.length} 个图元`;
  }

  public execute(): void {
    for (const entity of this.entities) {
      this.addFn(entity);
    }
  }

  public undo(): void {
    for (const entity of this.entities) {
      this.removeFn(entity);
    }
  }
}

/**
 * 删除实体命令
 */
export class RemoveEntityCommand implements Command {
  public readonly description: string;
  private entities: Entity[];
  private indices: number[];
  private addFn: (entity: Entity) => void;
  private removeFn: (entity: Entity) => boolean;
  private getAllFn: () => Entity[];

  constructor(
    entities: Entity[],
    addFn: (entity: Entity) => void,
    removeFn: (entity: Entity) => boolean,
    getAllFn: () => Entity[],
    description?: string,
  ) {
    this.entities = entities;
    this.indices = [];
    this.addFn = addFn;
    this.removeFn = removeFn;
    this.getAllFn = getAllFn;
    this.description = description || `删除 ${entities.length} 个图元`;
  }

  public execute(): void {
    // 记录删除前的位置
    const all = this.getAllFn();
    this.indices = this.entities.map(e => all.indexOf(e));
    // 执行删除
    for (const entity of this.entities) {
      this.removeFn(entity);
    }
  }

  public undo(): void {
    // 按原位置恢复（从后往前插入以保持索引正确）
    const sorted = this.entities
      .map((e, i) => ({ entity: e, index: this.indices[i] }))
      .sort((a, b) => a.index - b.index);

    for (const { entity } of sorted) {
      this.addFn(entity);
    }
  }
}

/**
 * 移动实体命令
 */
export class MoveEntityCommand implements Command {
  public readonly description: string;
  private entities: Entity[];
  private dx: number;
  private dy: number;

  constructor(entities: Entity[], dx: number, dy: number, description?: string) {
    this.entities = entities;
    this.dx = dx;
    this.dy = dy;
    this.description = description || `移动 ${entities.length} 个图元`;
  }

  public execute(): void {
    for (const entity of this.entities) {
      entity.move(this.dx, this.dy);
    }
  }

  public undo(): void {
    for (const entity of this.entities) {
      entity.move(-this.dx, -this.dy);
    }
  }
}

/**
 * 修改实体属性命令（用于夹点编辑、延伸等）
 * 通过快照实体状态实现撤销/重做
 */
export class ModifyEntityCommand implements Command {
  public readonly description: string;
  private entity: Entity;
  private beforeState: any;
  private afterState: any;
  private applyStateFn: (entity: Entity, state: any) => void;

  constructor(
    entity: Entity,
    beforeState: any,
    afterState: any,
    applyStateFn: (entity: Entity, state: any) => void,
    description?: string,
  ) {
    this.entity = entity;
    this.beforeState = beforeState;
    this.afterState = afterState;
    this.applyStateFn = applyStateFn;
    this.description = description || `修改图元 ${entity.type}`;
  }

  public execute(): void {
    this.applyStateFn(this.entity, this.afterState);
  }

  public undo(): void {
    this.applyStateFn(this.entity, this.beforeState);
  }
}

/**
 * 复合命令 - 将多个命令组合为一个操作
 * 用于倒圆角、倒角等需要同时修改多个实体的操作
 */
export class CompoundCommand implements Command {
  public readonly description: string;
  private commands: Command[];

  constructor(commands: Command[], description?: string) {
    this.commands = commands;
    this.description = description || `复合操作 (${commands.length} 步)`;
  }

  public execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  public undo(): void {
    // 逆序撤销
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}
