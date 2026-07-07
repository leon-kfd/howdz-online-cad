import { Command } from './Command';

/**
 * 历史管理器
 * 管理撤销/重做栈，支持无限撤销（内存限制内）
 */
export class HistoryManager {
  /** 撤销栈 */
  private undoStack: Command[] = [];
  /** 重做栈 */
  private redoStack: Command[] = [];
  /** 最大历史记录数（0表示无限制） */
  private maxHistory: number;

  /** 历史变更回调 */
  public onChange: (() => void) | null = null;

  constructor(maxHistory: number = 0) {
    this.maxHistory = maxHistory;
  }

  /**
   * 执行命令并添加到历史
   */
  public execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    // 新操作使重做历史失效
    this.redoStack = [];
    // 限制历史记录数
    if (this.maxHistory > 0 && this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.onChange?.();
  }

  /**
   * 记录已执行的命令到历史（不执行命令本身）
   * 用于工具已经执行了操作，只需要记录历史的情况
   */
  public record(command: Command): void {
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.maxHistory > 0 && this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.onChange?.();
  }

  /**
   * 撤销上一步操作
   * @returns 是否成功撤销
   */
  public undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    this.onChange?.();
    return true;
  }

  /**
   * 重做上一步撤销的操作
   * @returns 是否成功重做
   */
  public redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    this.onChange?.();
    return true;
  }

  /**
   * 是否有可撤销的操作
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * 是否有可重做的操作
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 获取撤销栈深度
   */
  public getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * 获取重做栈深度
   */
  public getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * 清空所有历史
   */
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange?.();
  }

  /**
   * 获取撤销栈中最近的命令描述
   */
  public getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * 获取重做栈中最近的命令描述
   */
  public getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }
}
