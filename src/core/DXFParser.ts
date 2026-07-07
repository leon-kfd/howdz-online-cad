import { Entity, LineEntity, CircleEntity, ArcEntity } from './Entity';

/** ACI (AutoCAD Color Index) 标准色表 */
const ACI_COLORS: Record<number, string> = {
  1: '#FF0000', // 红
  2: '#FFFF00', // 黄
  3: '#00FF00', // 绿
  4: '#00FFFF', // 青
  5: '#0000FF', // 蓝
  6: '#FF00FF', // 品红
  7: '#FFFFFF', // 白/黑（视背景而定）
};

/** DXF图层信息 */
export interface DXFLayer {
  name: string;
  color: string | null;
  visible: boolean;
  locked: boolean;
}

/** DXF解析结果 */
export interface DXFParseResult {
  entities: Entity[];
  layers: DXFLayer[];
  version: string;
}

/** DXF组码-值对 */
interface DXFGroup {
  code: number;
  value: string;
}

/**
 * DXF文件解析器
 * 支持R12至R32版本，解析LINE、CIRCLE、ARC实体和图层信息
 */
export class DXFParser {
  /**
   * 解析DXF文件内容
   */
  public static parse(content: string): DXFParseResult {
    const groups = DXFParser.tokenize(content);
    const version = DXFParser.extractVersion(groups);
    const layers = DXFParser.extractLayers(groups);
    const entities = DXFParser.extractEntities(groups, layers);

    return { entities, layers, version };
  }

  /**
   * 将DXF文本拆分为组码-值对
   */
  private static tokenize(content: string): DXFGroup[] {
    const lines = content.split(/\r?\n/);
    const groups: DXFGroup[] = [];

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = parseInt(lines[i].trim(), 10);
      const value = lines[i + 1]?.trim() ?? '';
      if (!isNaN(code)) {
        groups.push({ code, value });
      }
    }

    return groups;
  }

  /**
   * 提取DXF版本
   */
  private static extractVersion(groups: DXFGroup[]): string {
    // 在HEADER段中查找 $ACADVER
    let inHeader = false;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].code === 2 && groups[i].value === 'HEADER') {
        inHeader = true;
        continue;
      }
      if (inHeader && groups[i].code === 9 && groups[i].value === '$ACADVER') {
        // 下一个组应该是版本值
        if (i + 1 < groups.length && groups[i + 1].code === 1) {
          return groups[i + 1].value;
        }
      }
      // 离开HEADER段
      if (inHeader && groups[i].code === 0 && groups[i].value === 'ENDSEC') {
        break;
      }
    }
    return 'AC1015'; // 默认R15
  }

  /**
   * 从TABLES段提取图层信息
   */
  private static extractLayers(groups: DXFGroup[]): DXFLayer[] {
    const layers: DXFLayer[] = [];
    let inTables = false;
    let inLayerTable = false;
    let currentLayer: Partial<DXFLayer> | null = null;

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];

      // 进入TABLES段
      if (g.code === 0 && g.value === 'SECTION' &&
          i + 1 < groups.length && groups[i + 1].value === 'TABLES') {
        inTables = true;
        continue;
      }

      if (!inTables) continue;

      // 进入LAYER表
      if (g.code === 0 && g.value === 'TABLE' &&
          i + 1 < groups.length && groups[i + 1].value === 'LAYER') {
        inLayerTable = true;
        continue;
      }

      // LAYER表中的条目开始
      if (inLayerTable && g.code === 0 && g.value === 'LAYER') {
        // 保存前一个图层
        if (currentLayer?.name) {
          layers.push({
            name: currentLayer.name,
            color: currentLayer.color ?? null,
            visible: currentLayer.visible ?? true,
            locked: currentLayer.locked ?? false,
          });
        }
        currentLayer = { name: '0', visible: true, locked: false };
        continue;
      }

      // 解析图层属性
      if (inLayerTable && currentLayer) {
        if (g.code === 2) {
          currentLayer.name = g.value;
        } else if (g.code === 62) {
          const colorNum = parseInt(g.value, 10);
          // 负值表示图层关闭
          if (colorNum < 0) {
            currentLayer.visible = false;
            currentLayer.color = ACI_COLORS[Math.abs(colorNum)] ?? null;
          } else {
            currentLayer.color = ACI_COLORS[colorNum] ?? null;
          }
        } else if (g.code === 70) {
          const flags = parseInt(g.value, 10);
          currentLayer.locked = (flags & 4) !== 0;
        }
      }

      // TABLE结束
      if (inLayerTable && g.code === 0 && g.value === 'ENDTAB') {
        // 保存最后一个图层
        if (currentLayer?.name) {
          layers.push({
            name: currentLayer.name,
            color: currentLayer.color ?? null,
            visible: currentLayer.visible ?? true,
            locked: currentLayer.locked ?? false,
          });
        }
        currentLayer = null;
        inLayerTable = false;
        continue;
      }

      // TABLES段结束
      if (g.code === 0 && g.value === 'ENDSEC' && inTables) {
        // 保存残留图层
        if (currentLayer?.name) {
          layers.push({
            name: currentLayer.name,
            color: currentLayer.color ?? null,
            visible: currentLayer.visible ?? true,
            locked: currentLayer.locked ?? false,
          });
        }
        break;
      }
    }

    // 至少包含默认图层0
    if (layers.length === 0) {
      layers.push({ name: '0', color: '#FFFFFF', visible: true, locked: false });
    }

    return layers;
  }

  /**
   * 从ENTITIES段提取实体
   */
  private static extractEntities(groups: DXFGroup[], layers: DXFLayer[]): Entity[] {
    const entities: Entity[] = [];
    let inEntities = false;

    // 构建图层颜色映射
    const layerColorMap = new Map<string, string | null>();
    for (const layer of layers) {
      layerColorMap.set(layer.name, layer.color);
    }

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];

      // 进入ENTITIES段
      if (g.code === 0 && g.value === 'SECTION' &&
          i + 1 < groups.length && groups[i + 1].value === 'ENTITIES') {
        inEntities = true;
        continue;
      }

      if (!inEntities) continue;

      // 解析实体
      if (g.code === 0) {
        const entityType = g.value;
        let entity: Entity | null = null;

        switch (entityType) {
          case 'LINE':
            entity = DXFParser.parseLine(groups, i, layerColorMap);
            break;
          case 'CIRCLE':
            entity = DXFParser.parseCircle(groups, i, layerColorMap);
            break;
          case 'ARC':
            entity = DXFParser.parseArc(groups, i, layerColorMap);
            break;
          case 'ENDSEC':
            return entities; // ENTITIES段结束
        }

        if (entity) {
          entities.push(entity);
        }
      }
    }

    return entities;
  }

  /**
   * 解析LINE实体
   */
  private static parseLine(
    groups: DXFGroup[],
    startIndex: number,
    layerColorMap: Map<string, string | null>,
  ): LineEntity | null {
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    let layer = '0';
    let colorNum = -1;

    // 从下一个组开始读取实体属性
    for (let i = startIndex + 1; i < groups.length; i++) {
      const g = groups[i];
      // 遇到下一个实体则停止
      if (g.code === 0) break;

      switch (g.code) {
        case 8: layer = g.value; break;
        case 62: colorNum = parseInt(g.value, 10); break;
        case 10: x1 = parseFloat(g.value); break;
        case 20: y1 = parseFloat(g.value); break;
        case 11: x2 = parseFloat(g.value); break;
        case 21: y2 = parseFloat(g.value); break;
      }
    }

    const entity = new LineEntity(x1, y1, x2, y2);
    entity.layer = layer;
    entity.color = DXFParser.resolveColor(colorNum, layer, layerColorMap);
    return entity;
  }

  /**
   * 解析CIRCLE实体
   */
  private static parseCircle(
    groups: DXFGroup[],
    startIndex: number,
    layerColorMap: Map<string, string | null>,
  ): CircleEntity | null {
    let cx = 0, cy = 0, radius = 0;
    let layer = '0';
    let colorNum = -1;

    for (let i = startIndex + 1; i < groups.length; i++) {
      const g = groups[i];
      if (g.code === 0) break;

      switch (g.code) {
        case 8: layer = g.value; break;
        case 62: colorNum = parseInt(g.value, 10); break;
        case 10: cx = parseFloat(g.value); break;
        case 20: cy = parseFloat(g.value); break;
        case 40: radius = parseFloat(g.value); break;
      }
    }

    if (radius <= 0) return null;

    const entity = new CircleEntity(cx, cy, radius);
    entity.layer = layer;
    entity.color = DXFParser.resolveColor(colorNum, layer, layerColorMap);
    return entity;
  }

  /**
   * 解析ARC实体
   * DXF ARC使用角度（度），需转换为弧度
   * DXF角度为顺时针方向（与数学坐标系相反）
   */
  private static parseArc(
    groups: DXFGroup[],
    startIndex: number,
    layerColorMap: Map<string, string | null>,
  ): ArcEntity | null {
    let cx = 0, cy = 0, radius = 0;
    let startAngleDeg = 0, endAngleDeg = 0;
    let layer = '0';
    let colorNum = -1;

    for (let i = startIndex + 1; i < groups.length; i++) {
      const g = groups[i];
      if (g.code === 0) break;

      switch (g.code) {
        case 8: layer = g.value; break;
        case 62: colorNum = parseInt(g.value, 10); break;
        case 10: cx = parseFloat(g.value); break;
        case 20: cy = parseFloat(g.value); break;
        case 40: radius = parseFloat(g.value); break;
        case 50: startAngleDeg = parseFloat(g.value); break;
        case 51: endAngleDeg = parseFloat(g.value); break;
      }
    }

    if (radius <= 0) return null;

    // DXF角度为度，顺时针方向；转换为弧度（数学坐标系，逆时针为正）
    // DXF的0度在X轴正方向，顺时针增加
    // 数学坐标系的0度也在X轴正方向，但逆时针增加
    // 转换：数学角度 = -DXF角度（取负值即反转方向）
    const startAngle = (startAngleDeg * Math.PI) / 180;
    const endAngle = (endAngleDeg * Math.PI) / 180;

    const entity = new ArcEntity(cx, cy, radius, startAngle, endAngle);
    entity.layer = layer;
    entity.color = DXFParser.resolveColor(colorNum, layer, layerColorMap);
    return entity;
  }

  /**
   * 解析颜色
   * 优先使用实体自身的ACI颜色，否则使用图层颜色
   */
  private static resolveColor(
    entityColorNum: number,
    layerName: string,
    layerColorMap: Map<string, string | null>,
  ): string | null {
    // 实体有自身颜色
    if (entityColorNum > 0) {
      return ACI_COLORS[entityColorNum] ?? null;
    }
    // 使用图层颜色
    return layerColorMap.get(layerName) ?? null;
  }
}
