import { HowdzCAD } from '../src/index.ts';
import ICONS from './icons.js';

const cad = new HowdzCAD({
  container: '#cad-container',
  showGrid: true,
  showAxes: true,
});

// 暴露到全局供调试
window.cad = cad;

// 命令行交互
const commandInput = document.getElementById('command-input');
const commandHistory = document.getElementById('command-history');
const commandPrompt = document.getElementById('command-prompt');
const historyLines = [];

function addHistory(text, type = '') {
  const line = document.createElement('div');
  line.className = 'history-line' + (type ? ' ' + type : '');
  line.textContent = text;
  commandHistory.appendChild(line);
  commandHistory.scrollTop = commandHistory.scrollHeight;
  historyLines.push({ text, type });
}

// 命令历史记录
let commandHistoryList = [];
let historyIndex = -1;

/**
 * 获取命令执行反馈信息
 * 根据命令类型返回具体的操作描述
 */
function getCommandFeedback(cmdLine) {
  const trimmed = cmdLine.trim();
  const spaceIndex = trimmed.indexOf(' ');
  const cmd = (spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex)).toUpperCase();
  const args = spaceIndex === -1 ? '' : trimmed.substring(spaceIndex + 1).trim();

  switch (cmd) {
    case 'LINE':
    case 'L':
      if (args) return '已绘制直线';
      return '已切换到直线工具';
    case 'CIRCLE':
    case 'C':
      if (args) return '已绘制圆形';
      return '已切换到圆形工具';
    case 'ARC':
    case 'A':
      if (args) return '已绘制圆弧';
      return '已切换到圆弧工具';
    case 'SELECT':
    case 'SEL':
      return '已切换到选择工具';
    case 'COPY':
    case 'CO':
      return '已切换到复制工具';
    case 'MOVE':
    case 'M':
      return '已切换到移动工具';
    case 'FILLET':
    case 'F':
      if (args && args.toUpperCase().startsWith('R')) {
        return '已设置圆角半径';
      }
      return '已切换到倒圆角工具';
    case 'CHAMFER':
    case 'CHA':
      if (args && args.toUpperCase().startsWith('D')) {
        return '已设置倒角距离';
      }
      return '已切换到倒角工具';
    case 'EXTEND':
    case 'EX':
      return '已切换到延伸工具';
    case 'ERASE':
    case 'E':
      if (args.toUpperCase() === 'ALL') return '已清除全部图元';
      if (args.toUpperCase() === 'U' || args.toUpperCase() === 'UNDO') return '已撤销删除';
      return '已删除选中图元';
    case 'OPEN':
      return '正在打开DXF文件';
    case 'SAVE':
      return '已保存DXF文件';
    case 'LAYER':
    case 'LA':
      if (args) {
        const sub = args.trim().split(/\s+/)[0].toUpperCase();
        if (sub === 'NEW' || sub === 'N') return '已创建图层';
        if (sub === 'DEL' || sub === 'D') return '已删除图层';
        if (sub === 'SET' || sub === 'S') return '已切换当前图层';
      }
      return '图层管理';
    default:
      return '命令已执行';
  }
}

commandInput.addEventListener('keydown', (e) => {
  // 阻止事件传播到CAD的键盘处理
  e.stopPropagation();

  if (e.key === 'Enter') {
    const value = commandInput.value.trim();
    if (!value) return;

    // 添加到历史
    commandHistoryList.push(value);
    historyIndex = commandHistoryList.length;

    // 显示输入
    addHistory(`> ${value}`);

    // 拦截OPEN命令，触发文件选择
    const upperCmd = value.trim().toUpperCase();
    if (upperCmd === 'OPEN') {
      openDXFFile();
      commandInput.value = '';
      commandHistory.classList.add('visible');
      return;
    }

    // 拦截SAVE命令，触发DXF导出
    if (upperCmd === 'SAVE') {
      saveDXFFile();
      commandInput.value = '';
      commandHistory.classList.add('visible');
      return;
    }

    // 当倒圆角工具激活时，R <number> 设置半径
    const activeTool = toolManager.getActiveTool?.();
    if (activeTool?.name === 'fillet' && /^R\s+[\d.]+$/i.test(value.trim())) {
      const rMatch = value.trim().match(/^R\s+([\d.]+)$/i);
      if (rMatch) {
        const radius = parseFloat(rMatch[1]);
        if (radius > 0) {
          activeTool.setRadius(radius);
          addHistory(`圆角半径已设为 ${radius}`, 'success');
        }
      }
      commandInput.value = '';
      commandHistory.classList.add('visible');
      return;
    }

    // 当倒角工具激活时，D <number> 设置倒角距离
    if (activeTool?.name === 'chamfer' && /^D\s+[\d.]+$/i.test(value.trim())) {
      const dMatch = value.trim().match(/^D\s+([\d.]+)$/i);
      if (dMatch) {
        const dist = parseFloat(dMatch[1]);
        if (dist > 0) {
          activeTool.setDistance(dist);
          addHistory(`倒角距离已设为 ${dist}`, 'success');
        }
      }
      commandInput.value = '';
      commandHistory.classList.add('visible');
      return;
    }

    // 执行命令并获取反馈
    const feedback = getCommandFeedback(value);
    const result = cad.executeCommand(value);
    if (result) {
      addHistory(feedback, 'success');
    } else {
      addHistory('未知命令: ' + value, 'error');
    }

    commandInput.value = '';
    commandHistory.classList.add('visible');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      commandInput.value = commandHistoryList[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < commandHistoryList.length - 1) {
      historyIndex++;
      commandInput.value = commandHistoryList[historyIndex];
    } else {
      historyIndex = commandHistoryList.length;
      commandInput.value = '';
    }
  } else if (e.key === 'Escape') {
    commandInput.blur();
    commandHistory.classList.remove('visible');
  }
});

// 聚焦命令行时显示历史
commandInput.addEventListener('focus', () => {
  if (historyLines.length > 0) {
    commandHistory.classList.add('visible');
  }
});

// 点击画布时隐藏历史并聚焦画布
document.getElementById('cad-container').addEventListener('mousedown', () => {
  commandHistory.classList.remove('visible');
});

// 工具栏按钮交互
const toolBtns = document.querySelectorAll('.tool-btn');
const toolManager = cad.getToolManager();

function setActiveButton(toolName) {
  toolBtns.forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById('tool-' + toolName);
  if (btn) btn.classList.add('active');
}

// 监听工具切换
toolManager.onToolChange = (name) => {
  setActiveButton(name);
  const prompts = { line: '直线:', circle: '圆形:', arc: '圆弧:', select: '选择:', copy: '复制:', move: '移动:', fillet: '倒圆角:', chamfer: '倒角:', extend: '延伸:' };
  commandPrompt.textContent = prompts[name] || '命令:';
};

// 工具栏按钮点击
document.getElementById('tool-select')?.addEventListener('click', () => {
  toolManager.setActiveTool('select');
});
document.getElementById('tool-line')?.addEventListener('click', () => {
  toolManager.setActiveTool('line');
});
document.getElementById('tool-circle')?.addEventListener('click', () => {
  toolManager.setActiveTool('circle');
});
document.getElementById('tool-arc')?.addEventListener('click', () => {
  toolManager.setActiveTool('arc');
});
document.getElementById('tool-copy')?.addEventListener('click', () => {
  toolManager.setActiveTool('copy');
});
document.getElementById('tool-move')?.addEventListener('click', () => {
  toolManager.setActiveTool('move');
});
document.getElementById('tool-fillet')?.addEventListener('click', () => {
  toolManager.setActiveTool('fillet');
});
document.getElementById('tool-chamfer')?.addEventListener('click', () => {
  toolManager.setActiveTool('chamfer');
});
document.getElementById('tool-extend')?.addEventListener('click', () => {
  toolManager.setActiveTool('extend');
});
document.getElementById('tool-erase')?.addEventListener('click', () => {
  const count = cad.eraseSelected();
  if (count > 0) {
    updatePropertyPanel();
    addHistory(`已删除 ${count} 个图元`, 'success');
  } else {
    addHistory('未选中图元', 'error');
  }
});

// 撤销/重做按钮
const undoBtn = document.getElementById('tool-undo');
const redoBtn = document.getElementById('tool-redo');

function updateUndoRedoButtons() {
  if (undoBtn) {
    undoBtn.disabled = !cad.canUndo();
    undoBtn.title = cad.canUndo() ? `撤销 (Ctrl+Z) - ${cad.getUndoCount()} 步` : '无可撤销操作';
  }
  if (redoBtn) {
    redoBtn.disabled = !cad.canRedo();
    redoBtn.title = cad.canRedo() ? `重做 (Ctrl+Y) - ${cad.getRedoCount()} 步` : '无可重做操作';
  }
}

undoBtn?.addEventListener('click', () => {
  if (cad.undo()) {
    updatePropertyPanel();
    addHistory('已撤销', 'success');
  }
});

redoBtn?.addEventListener('click', () => {
  if (cad.redo()) {
    updatePropertyPanel();
    addHistory('已重做', 'success');
  }
});

// 定期更新撤销/重做按钮状态
setInterval(updateUndoRedoButtons, 500);
updateUndoRedoButtons();

// ========== 多键快捷键缓冲 ==========
let keyBuffer = '';
let keyBufferTimer = null;
const KEY_BUFFER_TIMEOUT = 500; // ms

function clearKeyBuffer() {
  keyBuffer = '';
  if (keyBufferTimer) {
    clearTimeout(keyBufferTimer);
    keyBufferTimer = null;
  }
}

function processKeyBuffer() {
  const seq = keyBuffer.toUpperCase();
  clearKeyBuffer();

  switch (seq) {
    case 'CO':
      toolManager.setActiveTool('copy');
      addHistory('已切换到复制工具', 'success');
      return true;
    case 'CHA':
      toolManager.setActiveTool('chamfer');
      addHistory('已切换到倒角工具', 'success');
      return true;
    case 'EX':
      toolManager.setActiveTool('extend');
      addHistory('已切换到延伸工具', 'success');
      return true;
    default:
      return false;
  }
}

// 键盘快捷键（命令行未聚焦时生效）
document.addEventListener('keydown', (e) => {
  // 命令行聚焦时不处理快捷键
  if (document.activeElement === commandInput) return;

  const key = e.key.toLowerCase();

  // Ctrl 组合键优先处理（不进入多键缓冲）
  if (e.ctrlKey) {
    // Ctrl+C 复制
    if (key === 'c') {
      e.preventDefault();
      clearKeyBuffer();
      const selected = cad.getEntityManager().getSelected();
      if (selected.length > 0) {
        window._cadClipboard = selected.map(e => e.clone());
        addHistory(`已复制 ${selected.length} 个图元`, 'success');
      }
      return;
    }

    // Ctrl+V 粘贴
    if (key === 'v') {
      e.preventDefault();
      clearKeyBuffer();
      if (window._cadClipboard && window._cadClipboard.length > 0) {
        const em = cad.getEntityManager();
        for (const entity of window._cadClipboard) {
          em.add(entity.clone());
        }
        em.clearSelection();
        addHistory(`已粘贴 ${window._cadClipboard.length} 个图元`, 'success');
      }
      return;
    }

    // Ctrl+Z 撤销
    if (key === 'z') {
      e.preventDefault();
      clearKeyBuffer();
      if (cad.undo()) {
        updatePropertyPanel();
        addHistory('已撤销', 'success');
      }
      return;
    }

    // Ctrl+Y 重做
    if (key === 'y') {
      e.preventDefault();
      clearKeyBuffer();
      if (cad.redo()) {
        updatePropertyPanel();
        addHistory('已重做', 'success');
      }
      return;
    }

    // Ctrl+S 保存DXF
    if (key === 's') {
      e.preventDefault();
      clearKeyBuffer();
      saveDXFFile();
      return;
    }

    // Ctrl+O 打开DXF
    if (key === 'o') {
      e.preventDefault();
      clearKeyBuffer();
      openDXFFile();
      return;
    }

    return; // 其他 Ctrl 组合键忽略
  }

  // 功能键处理
  if (e.key === 'F8') {
    e.preventDefault();
    clearKeyBuffer();
    const ortho = toolManager.toggleOrtho();
    addHistory(`正交模式: ${ortho ? '开' : '关'}`, 'success');
    return;
  }

  if (e.key === 'F3') {
    e.preventDefault();
    clearKeyBuffer();
    const snap = toolManager.toggleSnap();
    addHistory(`捕捉模式: ${snap ? '开' : '关'}`, 'success');
    return;
  }

  // Escape 回到选择工具
  if (e.key === 'Escape') {
    clearKeyBuffer();
    toolManager.setActiveTool('select');
    return;
  }

  // Delete 键删除选中图元
  if (e.key === 'Delete') {
    clearKeyBuffer();
    const count = cad.eraseSelected();
    if (count > 0) {
      updatePropertyPanel();
      addHistory(`已删除 ${count} 个图元`, 'success');
    }
    return;
  }

  // 单字母快捷键（直接映射）
  const singleKeyMap = {
    'l': 'line',
    'c': 'circle',
    'a': 'arc',
    'm': 'move',
    'f': 'fillet',
    'e': null, // 特殊处理：E 直接删除
  };

  if (singleKeyMap.hasOwnProperty(key)) {
    // E 键直接删除选中图元
    if (key === 'e') {
      clearKeyBuffer();
      const count = cad.eraseSelected();
      if (count > 0) {
        updatePropertyPanel();
        addHistory(`已删除 ${count} 个图元`, 'success');
      }
      return;
    }

    // 检查是否是多键序列的起始字符
    // C 可能是 CO 的开始，A 可能是 ARC 的开始（但 A 已经是圆弧）
    // 只有 C 需要等待看是否后面跟着 O
    if (key === 'c') {
      keyBuffer += key;
      if (keyBufferTimer) clearTimeout(keyBufferTimer);
      keyBufferTimer = setTimeout(() => {
        // 超时：当作单键 C 处理（圆形工具）
        if (keyBuffer === 'c') {
          toolManager.setActiveTool('circle');
        }
        clearKeyBuffer();
      }, KEY_BUFFER_TIMEOUT);
      return;
    }

    // 其他单键直接激活工具
    clearKeyBuffer();
    toolManager.setActiveTool(singleKeyMap[key]);
    return;
  }

  // 多键序列字符（O, H, X 等）
  if (key === 'o' || key === 'h' || key === 'x') {
    keyBuffer += key;

    if (keyBufferTimer) clearTimeout(keyBufferTimer);

    // 尝试匹配完整序列
    const upper = keyBuffer.toUpperCase();
    if (upper === 'CO' || upper === 'CHA' || upper === 'EX') {
      processKeyBuffer();
      return;
    }

    // 检查是否有匹配的前缀
    const hasPrefix = ['CO', 'CHA', 'EX'].some(seq => seq.startsWith(upper));
    if (hasPrefix) {
      // 继续等待
      keyBufferTimer = setTimeout(() => {
        // 超时：尝试处理缓冲区
        if (!processKeyBuffer()) {
          // 无法匹配，回退到第一个字符的单键映射
          const firstChar = keyBuffer[0].toLowerCase();
          if (firstChar === 'c') toolManager.setActiveTool('circle');
        }
        clearKeyBuffer();
      }, KEY_BUFFER_TIMEOUT);
      return;
    }

    // 无匹配前缀，清空缓冲并忽略
    clearKeyBuffer();
    return;
  }
});

// ========== DXF文件操作 ==========
function openDXFFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.dxf';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      input.remove();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      if (typeof content === 'string') {
        const result = cad.loadDXF(content);
        addHistory(`已打开 ${file.name}（${result.entities.length} 个图元，版本: ${result.version}）`, 'success');
        updatePropertyPanel();
      }
      input.remove();
    };
    reader.onerror = () => {
      addHistory('读取文件失败', 'error');
      input.remove();
    };
    reader.readAsText(file);
  });

  input.click();
}

// ========== DXF保存 ==========
function saveDXFFile() {
  const dxfContent = cad.saveDXF();
  const blob = new Blob([dxfContent], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawing.dxf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  addHistory('已保存DXF文件', 'success');
}

// ========== 属性面板 ==========
const panelContent = document.getElementById('panel-content');
const propertiesPanel = document.getElementById('properties-panel');

function formatNum(n) {
  return n.toFixed(2);
}

function formatAngle(rad) {
  return (rad * 180 / Math.PI).toFixed(1) + '°';
}

function updatePropertyPanel() {
  const selected = cad.getEntityManager().getSelected();

  if (selected.length === 0) {
    panelContent.innerHTML = '<div class="panel-empty">未选中图元</div>';
    return;
  }

  if (selected.length > 1) {
    panelContent.innerHTML = `<div class="panel-section">
      <div class="panel-section-title">选择集</div>
      <div class="prop-row"><span class="prop-label">数量</span><span class="prop-value">${selected.length}</span></div>
    </div>`;
    return;
  }

  const entity = selected[0];
  let html = '';

  // 通用属性
  html += `<div class="panel-section">
    <div class="panel-section-title">基本信息</div>
    <div class="prop-row"><span class="prop-label">类型</span><span class="prop-value">${entity.type === 'line' ? '直线' : entity.type === 'circle' ? '圆形' : '圆弧'}</span></div>
    <div class="prop-row"><span class="prop-label">图层</span><span class="prop-value">${entity.layer}</span></div>
    <div class="prop-row"><span class="prop-label">ID</span><span class="prop-value" style="font-size:10px">${entity.id}</span></div>
  </div>`;

  // 类型特有属性
  if (entity.type === 'line') {
    html += `<div class="panel-section">
      <div class="panel-section-title">直线参数</div>
      <div class="prop-row"><span class="prop-label">起点 X</span><span class="prop-value">${formatNum(entity.startX)}</span></div>
      <div class="prop-row"><span class="prop-label">起点 Y</span><span class="prop-value">${formatNum(entity.startY)}</span></div>
      <div class="prop-row"><span class="prop-label">终点 X</span><span class="prop-value">${formatNum(entity.endX)}</span></div>
      <div class="prop-row"><span class="prop-label">终点 Y</span><span class="prop-value">${formatNum(entity.endY)}</span></div>
      <div class="prop-row"><span class="prop-label">长度</span><span class="prop-value">${formatNum(entity.getLength())}</span></div>
      <div class="prop-row"><span class="prop-label">角度</span><span class="prop-value">${formatAngle(entity.getAngle())}</span></div>
    </div>`;
  } else if (entity.type === 'circle') {
    html += `<div class="panel-section">
      <div class="panel-section-title">圆形参数</div>
      <div class="prop-row"><span class="prop-label">圆心 X</span><span class="prop-value">${formatNum(entity.centerX)}</span></div>
      <div class="prop-row"><span class="prop-label">圆心 Y</span><span class="prop-value">${formatNum(entity.centerY)}</span></div>
      <div class="prop-row"><span class="prop-label">半径</span><span class="prop-value">${formatNum(entity.radius)}</span></div>
      <div class="prop-row"><span class="prop-label">周长</span><span class="prop-value">${formatNum(entity.getCircumference())}</span></div>
      <div class="prop-row"><span class="prop-label">面积</span><span class="prop-value">${formatNum(entity.getArea())}</span></div>
    </div>`;
  } else if (entity.type === 'arc') {
    html += `<div class="panel-section">
      <div class="panel-section-title">圆弧参数</div>
      <div class="prop-row"><span class="prop-label">圆心 X</span><span class="prop-value">${formatNum(entity.centerX)}</span></div>
      <div class="prop-row"><span class="prop-label">圆心 Y</span><span class="prop-value">${formatNum(entity.centerY)}</span></div>
      <div class="prop-row"><span class="prop-label">半径</span><span class="prop-value">${formatNum(entity.radius)}</span></div>
      <div class="prop-row"><span class="prop-label">起始角度</span><span class="prop-value">${formatAngle(entity.startAngle)}</span></div>
      <div class="prop-row"><span class="prop-label">终止角度</span><span class="prop-value">${formatAngle(entity.endAngle)}</span></div>
      <div class="prop-row"><span class="prop-label">弧度</span><span class="prop-value">${formatAngle(entity.getArcAngle())}</span></div>
    </div>`;
  }

  panelContent.innerHTML = html;
}

// 接入选择变更回调
const selectTool = toolManager.getTool('select');
if (selectTool) {
  selectTool.onSelectionChange = updatePropertyPanel;
}

// 属性面板关闭/打开
document.getElementById('panel-close')?.addEventListener('click', () => {
  propertiesPanel.classList.toggle('hidden');
});

// 初始更新
updatePropertyPanel();

// ========== 图层管理 ==========
const layerManager = cad.getLayerManager();
const layerListEl = document.getElementById('layer-list');

const LAYER_COLORS = [
  '#FF0000', '#FFFF00', '#00FF00', '#00FFFF',
  '#0000FF', '#FF00FF', '#FFFFFF', '#808080',
];

function renderLayerList() {
  const layers = layerManager.getLayers();
  const currentLayer = layerManager.getCurrentLayer();
  const entities = cad.getEntityManager().getAll();

  let html = '';
  for (const layer of layers) {
    const isActive = layer.name === currentLayer;
    const entityCount = entities.filter(e => e.layer === layer.name).length;

    html += `<div class="layer-item${isActive ? ' active' : ''}" data-layer="${layer.name}">
      <span class="layer-color" style="background: ${layer.color}" data-layer="${layer.name}" title="点击修改颜色"></span>
      <span class="layer-name" data-layer="${layer.name}" title="双击重命名">${layer.name}</span>
      <span class="layer-count">${entityCount}</span>
      <button class="layer-btn${layer.visible ? '' : ' off'}" data-action="visibility" data-layer="${layer.name}" title="${layer.visible ? '隐藏' : '显示'}图层">${layer.visible ? ICONS.eye : ICONS['eye-off']}</button>
      <button class="layer-btn${layer.locked ? '' : ' off'}" data-action="lock" data-layer="${layer.name}" title="${layer.locked ? '解锁' : '锁定'}图层">${layer.locked ? ICONS.lock : ICONS['lock-open']}</button>
      ${layer.name !== '0' ? `<button class="layer-btn" data-action="delete" data-layer="${layer.name}" title="删除图层">${ICONS.delete}</button>` : ''}
    </div>`;
  }
  layerListEl.innerHTML = html;
}

// 图层列表点击事件（事件委托）
layerListEl.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]') || e.target.closest('.layer-item');
  if (!target) return;

  const action = target.dataset.action;
  const layerName = target.dataset.layer;
  if (!layerName) return;

  if (action === 'visibility') {
    layerManager.toggleVisibility(layerName);
    renderLayerList();
    return;
  }

  if (action === 'lock') {
    layerManager.toggleLock(layerName);
    renderLayerList();
    return;
  }

  if (action === 'delete') {
    const entityCount = layerManager.getLayerEntityCount(layerName, cad.getEntityManager().getAll());
    if (entityCount > 0) {
      if (!confirm(`图层 "${layerName}" 上有 ${entityCount} 个图元，确定删除？`)) return;
    }
    layerManager.removeLayer(layerName);
    renderLayerList();
    return;
  }

  // 点击图层项设置为当前图层
  if (target.classList.contains('layer-item')) {
    layerManager.setCurrentLayer(layerName);
    renderLayerList();
  }
});

// 双击图层名重命名
layerListEl.addEventListener('dblclick', (e) => {
  const nameEl = e.target.closest('.layer-name');
  if (!nameEl) return;

  const layerName = nameEl.dataset.layer;
  if (!layerName || layerName === '0') return;

  const newName = prompt('重命名图层:', layerName);
  if (newName && newName !== layerName) {
    if (layerManager.hasLayer(newName)) {
      alert('图层名已存在');
      return;
    }
    // 更新实体的图层名
    const entities = cad.getEntityManager().getAll();
    for (const entity of entities) {
      if (entity.layer === layerName) {
        entity.layer = newName;
      }
    }
    layerManager.renameLayer(layerName, newName);
    renderLayerList();
    updatePropertyPanel();
  }
});

// 点击颜色块修改图层颜色
layerListEl.addEventListener('click', (e) => {
  const colorEl = e.target.closest('.layer-color');
  if (!colorEl) return;

  const layerName = colorEl.dataset.layer;
  if (!layerName) return;

  // 创建颜色选择弹窗
  const popup = document.createElement('div');
  popup.style.cssText = 'position:absolute;background:#2d2d2d;border:1px solid #3a3a3a;border-radius:4px;padding:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.5);';

  const rect = colorEl.getBoundingClientRect();
  popup.style.left = rect.left + 'px';
  popup.style.top = rect.bottom + 4 + 'px';

  for (const color of LAYER_COLORS) {
    const swatch = document.createElement('div');
    swatch.style.cssText = `width:24px;height:24px;background:${color};border:1px solid #555;border-radius:3px;cursor:pointer;`;
    swatch.title = color;
    swatch.addEventListener('click', () => {
      layerManager.setLayerColor(layerName, color);
      renderLayerList();
      popup.remove();
    });
    popup.appendChild(swatch);
  }

  document.body.appendChild(popup);

  // 点击外部关闭
  const closePopup = (ev) => {
    if (!popup.contains(ev.target)) {
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 0);
});

// 新建图层按钮
document.getElementById('layer-add')?.addEventListener('click', () => {
  const name = prompt('新图层名称:');
  if (!name) return;
  if (layerManager.hasLayer(name)) {
    alert('图层名已存在');
    return;
  }
  layerManager.addLayer(name);
  layerManager.setCurrentLayer(name);
  renderLayerList();
});

// 图层变更时更新UI
layerManager.onChange = () => {
  renderLayerList();
  updateStatusBar();
};

// 初始渲染图层列表
renderLayerList();

// ========== 菜单下拉 ==========
const menuBar = document.getElementById('menu-bar');
let openMenu = null;

function closeAllMenus() {
  menuBar.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
  openMenu = null;
}

menuBar.addEventListener('click', (e) => {
  const menuItem = e.target.closest('.menu-item');
  if (!menuItem) return;

  // 如果点击的是下拉项，执行操作
  const dropdownItem = e.target.closest('.menu-dropdown-item');
  if (dropdownItem) {
    const action = dropdownItem.dataset.action;
    if (action) executeMenuAction(action);
    closeAllMenus();
    return;
  }

  // 切换菜单展开
  if (menuItem.classList.contains('open')) {
    closeAllMenus();
  } else {
    closeAllMenus();
    menuItem.classList.add('open');
    openMenu = menuItem;
  }
});

// 鼠标移入其他菜单项时自动切换
menuBar.addEventListener('mouseover', (e) => {
  if (!openMenu) return;
  const menuItem = e.target.closest('.menu-item');
  if (menuItem && menuItem !== openMenu && menuItem.dataset.menu) {
    closeAllMenus();
    menuItem.classList.add('open');
    openMenu = menuItem;
  }
});

// 点击外部关闭菜单
document.addEventListener('click', (e) => {
  if (!menuBar.contains(e.target)) {
    closeAllMenus();
  }
});

let gridEnabled = true;

function executeMenuAction(action) {
  switch (action) {
    // 文件
    case 'open': openDXFFile(); break;
    case 'save': saveDXFFile(); break;

    // 编辑
    case 'undo':
      if (cad.undo()) { updatePropertyPanel(); addHistory('已撤销', 'success'); }
      break;
    case 'redo':
      if (cad.redo()) { updatePropertyPanel(); addHistory('已重做', 'success'); }
      break;
    case 'copy':
      {
        const sel = cad.getEntityManager().getSelected();
        if (sel.length > 0) {
          window._cadClipboard = sel.map(e => e.clone());
          addHistory(`已复制 ${sel.length} 个图元`, 'success');
        }
      }
      break;
    case 'paste':
      if (window._cadClipboard && window._cadClipboard.length > 0) {
        const em = cad.getEntityManager();
        for (const entity of window._cadClipboard) {
          em.add(entity.clone());
        }
        em.clearSelection();
        addHistory(`已粘贴 ${window._cadClipboard.length} 个图元`, 'success');
      }
      break;
    case 'erase':
      {
        const count = cad.eraseSelected();
        if (count > 0) { updatePropertyPanel(); addHistory(`已删除 ${count} 个图元`, 'success'); }
      }
      break;

    // 视图
    case 'toggle-command':
      toggleCommandLine();
      break;
    case 'toggle-properties':
      propertiesPanel.classList.toggle('hidden');
      break;
    case 'toggle-grid':
      gridEnabled = !gridEnabled;
      cad.setShowGrid(gridEnabled);
      addHistory(`网格: ${gridEnabled ? '开' : '关'}`, 'success');
      break;
    case 'zoom-extents':
      cad.zoomExtents();
      addHistory('已缩放全部', 'success');
      break;
    case 'reset-view':
      cad.resetView();
      addHistory('已重置视图', 'success');
      break;

    // 绘图/修改工具
    case 'tool-line': toolManager.setActiveTool('line'); break;
    case 'tool-circle': toolManager.setActiveTool('circle'); break;
    case 'tool-arc': toolManager.setActiveTool('arc'); break;
    case 'tool-move': toolManager.setActiveTool('move'); break;
    case 'tool-copy': toolManager.setActiveTool('copy'); break;
    case 'tool-fillet': toolManager.setActiveTool('fillet'); break;
    case 'tool-chamfer': toolManager.setActiveTool('chamfer'); break;
    case 'tool-extend': toolManager.setActiveTool('extend'); break;

    // 帮助
    case 'about':
      alert('Howdz CAD\n纯前端在线CAD插件\n基于Canvas 2D渲染');
      break;
  }
}

// ========== 命令行折叠 ==========
let commandLineCollapsed = false;
const commandLineBody = document.getElementById('command-line-body');
const commandToggleBtn = document.getElementById('command-toggle-btn');
const commandLineHeader = document.getElementById('command-line-header');

function toggleCommandLine() {
  commandLineCollapsed = !commandLineCollapsed;
  const svg = commandToggleBtn.querySelector('svg');
  if (commandLineCollapsed) {
    commandLineBody.classList.add('collapsed');
    svg.outerHTML = ICONS['arrow-right'];
  } else {
    commandLineBody.classList.remove('collapsed');
    svg.outerHTML = ICONS['arrow-down'];
  }
}

commandLineHeader.addEventListener('click', (e) => {
  // 避免点击按钮时重复触发
  if (e.target === commandToggleBtn) return;
  toggleCommandLine();
});

commandToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleCommandLine();
});

// ========== 状态栏更新 ==========
const statusCoords = document.getElementById('status-coords');
const statusLayer = document.getElementById('status-layer');
const statusOrtho = document.getElementById('status-ortho');
const statusSnap = document.getElementById('status-snap');
const statusGrid = document.getElementById('status-grid');
const statusZoom = document.getElementById('status-zoom');
const gridPopup = document.getElementById('grid-popup');

function updateStatusBar() {
  const viewport = cad.getViewport();
  const lm = cad.getLayerManager();
  const tm = cad.getToolManager();

  const { mouseWorld, scale } = viewport;
  statusCoords.textContent = `X: ${mouseWorld.x.toFixed(2)}   Y: ${mouseWorld.y.toFixed(2)}`;
  statusLayer.textContent = `图层: ${lm.getCurrentLayer()}`;
  statusOrtho.innerHTML = `正交: ${tm.orthoMode ? '开' : '关'} <span class="status-key">F8</span>`;
  statusOrtho.className = tm.orthoMode ? 'status-item status-clickable status-active' : 'status-item status-clickable';
  statusSnap.innerHTML = `捕捉: ${tm.snapMode ? '开' : '关'} <span class="status-key">F3</span>`;
  statusSnap.className = tm.snapMode ? 'status-item status-clickable status-active' : 'status-item status-clickable';
  statusZoom.textContent = `缩放: ${(scale * 100).toFixed(0)}%`;

  // 更新网格大小显示
  const gridMode = cad.getGridSizeMode();
  const gridLabel = gridMode === 'auto' ? '自动' : cad.getGridSize().toString();
  statusGrid.textContent = `网格: ${gridLabel}`;
  gridPopup.querySelectorAll('.grid-popup-item').forEach(item => {
    if (gridMode === 'auto') {
      item.classList.toggle('active', item.dataset.mode === 'auto');
    } else {
      item.classList.toggle('active', item.dataset.size === String(cad.getGridSize()));
    }
  });
}

// 状态栏点击切换正交/捕捉
statusOrtho.addEventListener('click', () => {
  const ortho = toolManager.toggleOrtho();
  addHistory(`正交模式: ${ortho ? '开' : '关'}`, 'success');
  updateStatusBar();
});
statusSnap.addEventListener('click', () => {
  const snap = toolManager.toggleSnap();
  addHistory(`捕捉模式: ${snap ? '开' : '关'}`, 'success');
  updateStatusBar();
});

// 网格大小弹出菜单
statusGrid.addEventListener('click', (e) => {
  e.stopPropagation();
  gridPopup.classList.toggle('visible');
  // 定位到状态栏项上方
  const rect = statusGrid.getBoundingClientRect();
  gridPopup.style.left = rect.left + 'px';
});

gridPopup.addEventListener('click', (e) => {
  const item = e.target.closest('.grid-popup-item');
  if (!item) return;

  if (item.dataset.mode === 'auto') {
    cad.setGridSizeMode('auto');
    addHistory('网格: 自动', 'success');
  } else if (item.dataset.size) {
    const size = parseInt(item.dataset.size, 10);
    cad.setGridSize(size);
    addHistory(`网格: ${size}`, 'success');
  }

  gridPopup.classList.remove('visible');
  updateStatusBar();
});

// 点击外部关闭网格弹出菜单
document.addEventListener('click', (e) => {
  if (!gridPopup.contains(e.target) && e.target !== statusGrid) {
    gridPopup.classList.remove('visible');
  }
});

// 定期更新状态栏
setInterval(updateStatusBar, 100);
updateStatusBar();

// F2 切换命令行
document.addEventListener('keydown', (e) => {
  if (document.activeElement === commandInput) return;
  if (e.key === 'F2') {
    e.preventDefault();
    toggleCommandLine();
    // 展开时聚焦命令输入框
    if (!commandLineCollapsed) {
      commandInput.focus();
    }
  }
});

console.log('HowdzCAD 初始化完成');
console.log('操作说明:');
console.log('  - 鼠标滚轮: 缩放');
console.log('  - 鼠标中键拖拽: 平移');
console.log('快捷键:');
console.log('  - L: 直线 | C: 圆形 | A: 圆弧');
console.log('  - M: 移动 | CO: 复制 | E/Delete: 删除');
console.log('  - F: 倒圆角 | CHA: 倒角 | EX: 延伸');
console.log('  - Esc: 选择工具');
console.log('  - F3: 捕捉模式 | F8: 正交模式');
console.log('  - Ctrl+Z: 撤销 | Ctrl+Y: 重做');
console.log('  - Ctrl+C: 复制到剪贴板 | Ctrl+V: 粘贴');
console.log('  - Ctrl+S: 保存DXF | Ctrl+O: 打开DXF');
console.log('  - 拖拽夹点可实时修改图形形状');
console.log('图层管理:');
console.log('  - 右侧面板管理图层（新建/删除/重命名/颜色/显示/锁定）');
console.log('  - LAYER NEW <名称> [颜色] | LAYER DEL <名称> | LAYER SET <名称>');
