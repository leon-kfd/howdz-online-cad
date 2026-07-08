# Howdz Online CAD

纯前端在线CAD插件 - 基于 Canvas 2D 渲染，支持二维图形绘制和 DXF 文件导入导出。

## 🚀 在线演示

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/howdz-online-cad)

## ✨ 特性

- 🎨 **完整的绘图工具** - 直线、圆形、圆弧等基本图形绘制
- ✏️ **图形编辑** - 移动、复制、删除、夹点编辑
- 🔧 **修改工具** - 倒圆角、倒角、延伸
- 📂 **DXF 支持** - 导入和导出标准 DXF 文件格式
- 📚 **图层管理** - 完整的图层系统，支持显示/锁定/颜色设置
- ↩️ **撤销/重做** - 无限撤销/重做支持
- 🖥️ **经典界面** - AutoCAD 风格的 UI 布局
- ⌨️ **快捷键** - 完整的键盘快捷键支持
- 📱 **响应式** - 自适应窗口大小

## 🚀 快速开始

### 安装

```bash
npm install howdz-online-cad
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
# 构建库
npm run build

# 构建 Demo 页面（用于部署）
npm run build:demo
```

### 部署到 Vercel

1. Fork 或克隆此仓库
2. 在 Vercel 中导入项目
3. Vercel 会自动检测 `vercel.json` 配置
4. 部署完成后即可访问在线 Demo

或者使用 Vercel CLI：

```bash
npm i -g vercel
vercel
```

### 使用

```typescript
import { HowdzCAD } from 'howdz-online-cad';

// 创建 CAD 实例
const cad = new HowdzCAD({
  container: '#cad-container',
  showGrid: true,
  showAxes: true,
});

// 切换到直线工具
cad.getToolManager().setActiveTool('line');

// 执行命令
cad.executeCommand('LINE 0,0 100,100');

// 加载 DXF 文件
const result = cad.loadDXF(dxfContent);

// 保存 DXF 文件
const dxfContent = cad.saveDXF();
```

## 📦 核心模块

### HowdzCAD

主入口类，提供完整的 CAD 功能。

```typescript
const cad = new HowdzCAD({
  container: '#cad-container',  // 容器选择器或 DOM 元素
  showGrid: true,               // 显示网格
  showAxes: true,               // 显示坐标轴
  backgroundColor: '#1e1e1e',   // 背景颜色
  gridColor: '#2a2a2a',         // 网格颜色
  gridMajorColor: '#3a3a3a',    // 主网格线颜色
});
```

### 实体类型

- **LineEntity** - 直线
- **CircleEntity** - 圆形
- **ArcEntity** - 圆弧

### 工具

| 工具 | 名称 | 快捷键 | 说明 |
|------|------|--------|------|
| SelectTool | select | Esc | 选择和夹点编辑 |
| LineTool | line | L | 绘制直线 |
| CircleTool | circle | C | 绘制圆形 |
| ArcTool | arc | A | 绘制圆弧 |
| MoveTool | move | M | 移动图元 |
| CopyTool | copy | CO | 复制图元 |
| FilletTool | fillet | F | 倒圆角 |
| ChamferTool | chamfer | CHA | 倒角 |
| ExtendTool | extend | EX | 延伸 |

### 图层管理

```typescript
const layerManager = cad.getLayerManager();

// 添加图层
layerManager.addLayer('myLayer', '#FF0000');

// 设置当前图层
layerManager.setCurrentLayer('myLayer');

// 切换可见性
layerManager.toggleVisibility('myLayer');

// 切换锁定
layerManager.toggleLock('myLayer');
```

### 历史管理

```typescript
// 撤销
cad.undo();

// 重做
cad.redo();

// 检查是否可撤销/重做
if (cad.canUndo()) { ... }
if (cad.canRedo()) { ... }
```

## ⌨️ 快捷键

### 工具切换

| 快捷键 | 功能 |
|--------|------|
| `L` | 直线工具 |
| `C` | 圆形工具 |
| `A` | 圆弧工具 |
| `M` | 移动工具 |
| `CO` | 复制工具 |
| `F` | 倒圆角工具 |
| `CHA` | 倒角工具 |
| `EX` | 延伸工具 |
| `E` / `Delete` | 删除选中图元 |
| `Esc` | 选择工具 |

### 编辑操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` | 重做 |
| `Ctrl+C` | 复制到剪贴板 |
| `Ctrl+V` | 从剪贴板粘贴 |
| `Ctrl+S` | 保存 DXF |
| `Ctrl+O` | 打开 DXF |

### 视图控制

| 快捷键 | 功能 |
|--------|------|
| `鼠标滚轮` | 缩放 |
| `鼠标中键拖拽` | 平移 |
| `F2` | 切换命令行 |
| `F3` | 切换捕捉模式 |
| `F8` | 切换正交模式 |

### 命令行输入

支持以下命令（不区分大小写）：

```
LINE / L          - 绘制直线
CIRCLE / C        - 绘制圆形
ARC / A           - 绘制圆弧
MOVE / M          - 移动图元
COPY / CO         - 复制图元
FILLET / F        - 倒圆角
CHAMFER / CHA     - 倒角
EXTEND / EX       - 延伸
ERASE / E         - 删除图元
LAYER / LA        - 图层管理
OPEN              - 打开 DXF 文件
SAVE              - 保存 DXF 文件
UNDO              - 撤销
REDO              - 重做
```

## 🏗️ 项目结构

```
howdz-online-cad/
├── src/
│   ├── core/
│   │   ├── commands/          # 命令模式实现
│   │   │   ├── Command.ts     # 命令接口和具体命令
│   │   │   └── HistoryManager.ts  # 历史管理器
│   │   ├── tools/             # 绘图工具
│   │   │   ├── Tool.ts        # 工具基类
│   │   │   ├── ToolManager.ts # 工具管理器
│   │   │   ├── SelectTool.ts  # 选择工具
│   │   │   ├── LineTool.ts    # 直线工具
│   │   │   ├── CircleTool.ts  # 圆形工具
│   │   │   ├── ArcTool.ts     # 圆弧工具
│   │   │   ├── MoveTool.ts    # 移动工具
│   │   │   ├── CopyTool.ts    # 复制工具
│   │   │   ├── FilletTool.ts  # 倒圆角工具
│   │   │   ├── ChamferTool.ts # 倒角工具
│   │   │   └── ExtendTool.ts  # 延伸工具
│   │   ├── CAD.ts             # 主 CAD 类
│   │   ├── Entity.ts          # 实体定义
│   │   ├── EntityManager.ts   # 实体管理器
│   │   ├── LayerManager.ts    # 图层管理器
│   │   ├── Renderer.ts        # 渲染器
│   │   ├── Viewport.ts        # 视口控制
│   │   ├── DXFParser.ts       # DXF 解析器
│   │   ├── DXFWriter.ts       # DXF 写入器
│   │   └── types.ts           # 类型定义
│   ├── utils/
│   │   └── math.ts            # 数学工具函数
│   └── index.ts               # 入口文件
├── demo/
│   ├── index.html             # 演示页面
│   └── icons.js               # 图标定义
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔧 API 参考

### HowdzCAD

```typescript
class HowdzCAD {
  constructor(options: CADOptions);

  // 获取管理器
  getEntityManager(): EntityManager;
  getToolManager(): ToolManager;
  getLayerManager(): LayerManager;
  getViewport(): Viewport;

  // 命令执行
  executeCommand(cmd: string): boolean;

  // 文件操作
  loadDXF(content: string): DXFParseResult;
  saveDXF(): string;

  // 编辑操作
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  eraseSelected(): number;

  // 视图控制
  zoomExtents(): void;
  resetView(): void;
  setShowGrid(show: boolean): void;
  setShowAxes(show: boolean): void;
}
```

### EntityManager

```typescript
class EntityManager {
  // 实体操作
  add(entity: Entity): void;
  remove(entity: Entity): boolean;
  getAll(): Entity[];
  getById(id: string): Entity | undefined;

  // 选择操作
  select(entity: Entity): void;
  deselect(entity: Entity): void;
  clearSelection(): void;
  getSelected(): Entity[];

  // 移动操作
  moveEntities(entities: Entity[], dx: number, dy: number): void;

  // 历史管理
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

### LayerManager

```typescript
class LayerManager {
  // 图层操作
  addLayer(name: string, color?: string): void;
  removeLayer(name: string): void;
  getLayer(name: string): LayerInfo | undefined;
  getLayers(): LayerInfo[];

  // 当前图层
  setCurrentLayer(name: string): void;
  getCurrentLayer(): string;

  // 图层属性
  toggleVisibility(name: string): void;
  toggleLock(name: string): void;
  setLayerColor(name: string, color: string): void;
}
```

## 📄 DXF 支持

### 导入

```typescript
const content = fs.readFileSync('drawing.dxf', 'utf-8');
const result = cad.loadDXF(content);

console.log(`导入了 ${result.entities.length} 个图元`);
console.log(`DXF 版本: ${result.version}`);
```

### 导出

```typescript
const dxfContent = cad.saveDXF();
fs.writeFileSync('output.dxf', dxfContent);
```

### 支持的 DXF 实体

- LINE - 直线
- CIRCLE - 圆形
- ARC - 圆弧

## 🎨 界面定制

演示页面 (`demo/index.html`) 展示了完整的 AutoCAD 风格界面，包括：

- 顶部菜单栏
- 左侧工具栏
- 绘图区域
- 右侧属性面板和图层管理
- 底部命令行
- 状态栏

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 许可证

MIT License

## 🔗 相关链接

- [Canvas 2D API 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D)
- [DXF 文件格式规范](https://www.autodesk.com/techpubs/autocad/dxf/)

---

Made with ❤️ by howdz
