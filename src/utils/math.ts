/**
 * 将值限制在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 计算两点之间的距离
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 1-2-5 序列：根据基准值返回最近的 1-2-5 倍数
 * 用于网格间距自适应
 */
export function niceNumber(value: number): number {
  const exp = Math.floor(Math.log10(value));
  const frac = value / Math.pow(10, exp);
  let nice: number;

  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 5) nice = 5;
  else nice = 10;

  return nice * Math.pow(10, exp);
}

/**
 * 根据缩放比例计算合适的网格间距（世界坐标单位）
 * 目标：网格线在屏幕上的像素间距在 40~100px 之间
 */
export function calculateGridSpacing(scale: number, targetPixelSpacing = 60): number {
  // 世界坐标中对应的间距
  const worldSpacing = targetPixelSpacing / scale;
  return niceNumber(worldSpacing);
}

/**
 * 角度转弧度
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 弧度转角度
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * 格式化坐标值为固定小数位
 */
export function formatCoord(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}
