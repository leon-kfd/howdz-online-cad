import { Entity, LineEntity, CircleEntity, ArcEntity } from './Entity';
import { DXFLayer } from './DXFParser';

/** ACI (AutoCAD Color Index) 颜色名到索引的映射 */
const COLOR_TO_ACI: Record<string, number> = {
  '#FF0000': 1, // 红
  '#FFFF00': 2, // 黄
  '#00FF00': 3, // 绿
  '#00FFFF': 4, // 青
  '#0000FF': 5, // 蓝
  '#FF00FF': 6, // 品红
  '#FFFFFF': 7, // 白
};

/**
 * DXF文件写入器
 * 将CAD实体导出为DXF R15 (2000) 格式
 */
export class DXFWriter {
  /**
   * 将实体列表导出为DXF格式字符串
   * @param entities 要导出的实体
   * @param layers 图层信息（可选，默认从实体推导）
   * @returns DXF文件内容
   */
  public static export(entities: Entity[], layers?: DXFLayer[]): string {
    const lines: string[] = [];

    // 从实体推导图层信息（如果未提供）
    const resolvedLayers = layers ?? DXFWriter.deriveLayers(entities);

    // HEADER 段
    DXFWriter.writeHeader(lines);

    // TABLES 段
    DXFWriter.writeTables(lines, resolvedLayers);

    // ENTITIES 段
    DXFWriter.writeEntities(lines, entities);

    // 文件结束
    DXFWriter.writeGroup(lines, 0, 'EOF');

    return lines.join('\n');
  }

  /**
   * 从实体列表推导图层信息
   */
  private static deriveLayers(entities: Entity[]): DXFLayer[] {
    const layerSet = new Set<string>();
    for (const entity of entities) {
      layerSet.add(entity.layer || '0');
    }
    // 始终包含默认图层0
    layerSet.add('0');

    return Array.from(layerSet).map(name => ({
      name,
      color: '#FFFFFF',
      visible: true,
      locked: false,
    }));
  }

  /**
   * 写入HEADER段
   */
  private static writeHeader(lines: string[]): void {
    DXFWriter.writeGroup(lines, 0, 'SECTION');
    DXFWriter.writeGroup(lines, 2, 'HEADER');

    // DXF版本 R15 (2000)
    DXFWriter.writeGroup(lines, 9, '$ACADVER');
    DXFWriter.writeGroup(lines, 1, 'AC1015');

    // 插入基点
    DXFWriter.writeGroup(lines, 9, '$INSBASE');
    DXFWriter.writeGroup(lines, 10, '0.0');
    DXFWriter.writeGroup(lines, 20, '0.0');
    DXFWriter.writeGroup(lines, 30, '0.0');

    // 图形范围
    DXFWriter.writeGroup(lines, 9, '$EXTMIN');
    DXFWriter.writeGroup(lines, 10, '-1000.0');
    DXFWriter.writeGroup(lines, 20, '-1000.0');
    DXFWriter.writeGroup(lines, 9, '$EXTMAX');
    DXFWriter.writeGroup(lines, 10, '1000.0');
    DXFWriter.writeGroup(lines, 20, '1000.0');

    DXFWriter.writeGroup(lines, 0, 'ENDSEC');
  }

  /**
   * 写入TABLES段
   */
  private static writeTables(lines: string[], layers: DXFLayer[]): void {
    DXFWriter.writeGroup(lines, 0, 'SECTION');
    DXFWriter.writeGroup(lines, 2, 'TABLES');

    // LAYER表
    DXFWriter.writeGroup(lines, 0, 'TABLE');
    DXFWriter.writeGroup(lines, 2, 'LAYER');
    DXFWriter.writeGroup(lines, 70, String(layers.length + 10)); // 表容量标记

    for (const layer of layers) {
      DXFWriter.writeGroup(lines, 0, 'LAYER');
      DXFWriter.writeGroup(lines, 2, layer.name);
      // 颜色号（负值表示图层关闭）
      const aciColor = COLOR_TO_ACI[layer.color?.toUpperCase() ?? ''] ?? 7;
      const colorNum = layer.visible ? aciColor : -aciColor;
      DXFWriter.writeGroup(lines, 62, String(colorNum));
      DXFWriter.writeGroup(lines, 6, 'CONTINUOUS'); // 线型
      // 标志位：bit 1 = frozen, bit 4 = locked
      let flags = 0;
      if (layer.locked) flags |= 4;
      DXFWriter.writeGroup(lines, 70, String(flags));
    }

    DXFWriter.writeGroup(lines, 0, 'ENDTAB');

    // 线型表（最小化，只需CONTINUOUS）
    DXFWriter.writeGroup(lines, 0, 'TABLE');
    DXFWriter.writeGroup(lines, 2, 'LTYPE');
    DXFWriter.writeGroup(lines, 70, '1');
    DXFWriter.writeGroup(lines, 0, 'LTYPE');
    DXFWriter.writeGroup(lines, 2, 'CONTINUOUS');
    DXFWriter.writeGroup(lines, 70, '0');
    DXFWriter.writeGroup(lines, 3, 'Solid line');
    DXFWriter.writeGroup(lines, 72, '65');
    DXFWriter.writeGroup(lines, 73, '0');
    DXFWriter.writeGroup(lines, 40, '0.0');
    DXFWriter.writeGroup(lines, 0, 'ENDTAB');

    DXFWriter.writeGroup(lines, 0, 'ENDSEC');
  }

  /**
   * 写入ENTITIES段
   */
  private static writeEntities(lines: string[], entities: Entity[]): void {
    DXFWriter.writeGroup(lines, 0, 'SECTION');
    DXFWriter.writeGroup(lines, 2, 'ENTITIES');

    for (const entity of entities) {
      if (!entity.visible) continue; // 跳过隐藏实体

      switch (entity.type) {
        case 'line':
          DXFWriter.writeLine(lines, entity as LineEntity);
          break;
        case 'circle':
          DXFWriter.writeCircle(lines, entity as CircleEntity);
          break;
        case 'arc':
          DXFWriter.writeArc(lines, entity as ArcEntity);
          break;
      }
    }

    DXFWriter.writeGroup(lines, 0, 'ENDSEC');
  }

  /**
   * 写入LINE实体
   */
  private static writeLine(lines: string[], entity: LineEntity): void {
    DXFWriter.writeGroup(lines, 0, 'LINE');
    DXFWriter.writeEntityCommon(lines, entity);
    DXFWriter.writeGroup(lines, 10, DXFWriter.fmt(entity.startX));
    DXFWriter.writeGroup(lines, 20, DXFWriter.fmt(entity.startY));
    DXFWriter.writeGroup(lines, 30, '0.0');
    DXFWriter.writeGroup(lines, 11, DXFWriter.fmt(entity.endX));
    DXFWriter.writeGroup(lines, 21, DXFWriter.fmt(entity.endY));
    DXFWriter.writeGroup(lines, 31, '0.0');
  }

  /**
   * 写入CIRCLE实体
   */
  private static writeCircle(lines: string[], entity: CircleEntity): void {
    DXFWriter.writeGroup(lines, 0, 'CIRCLE');
    DXFWriter.writeEntityCommon(lines, entity);
    DXFWriter.writeGroup(lines, 10, DXFWriter.fmt(entity.centerX));
    DXFWriter.writeGroup(lines, 20, DXFWriter.fmt(entity.centerY));
    DXFWriter.writeGroup(lines, 30, '0.0');
    DXFWriter.writeGroup(lines, 40, DXFWriter.fmt(entity.radius));
  }

  /**
   * 写入ARC实体
   * DXF角度为度，需从弧度转换
   * DXF的0度在X轴正方向，逆时针增加（与数学坐标系相同）
   */
  private static writeArc(lines: string[], entity: ArcEntity): void {
    DXFWriter.writeGroup(lines, 0, 'ARC');
    DXFWriter.writeEntityCommon(lines, entity);
    DXFWriter.writeGroup(lines, 10, DXFWriter.fmt(entity.centerX));
    DXFWriter.writeGroup(lines, 20, DXFWriter.fmt(entity.centerY));
    DXFWriter.writeGroup(lines, 30, '0.0');
    DXFWriter.writeGroup(lines, 40, DXFWriter.fmt(entity.radius));
    // 弧度转角度
    const startDeg = (entity.startAngle * 180) / Math.PI;
    const endDeg = (entity.endAngle * 180) / Math.PI;
    DXFWriter.writeGroup(lines, 50, DXFWriter.fmt(startDeg));
    DXFWriter.writeGroup(lines, 51, DXFWriter.fmt(endDeg));
  }

  /**
   * 写入实体的公共属性（图层、颜色）
   */
  private static writeEntityCommon(lines: string[], entity: Entity): void {
    DXFWriter.writeGroup(lines, 8, entity.layer || '0');
    // 实体自身颜色（ACI索引）
    if (entity.color) {
      const aci = COLOR_TO_ACI[entity.color.toUpperCase()];
      if (aci) {
        DXFWriter.writeGroup(lines, 62, String(aci));
      }
    }
  }

  /**
   * 写入一个DXF组码-值对
   */
  private static writeGroup(lines: string[], code: number, value: string): void {
    lines.push(String(code));
    lines.push(value);
  }

  /**
   * 格式化数值（保留6位小数，去除尾部多余的0）
   */
  private static fmt(n: number): string {
    return n.toFixed(6).replace(/\.?0+$/, '') || '0';
  }
}
