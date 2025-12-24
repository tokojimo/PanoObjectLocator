export function bearingFromBox(xmin: number, xmax: number, imageWidth: number, heading: number) {
  const cx = (xmin + xmax) / 2;
  const relative = (cx / imageWidth) * 360 - 180;
  const bearing = (heading + relative + 360) % 360;
  return { bearing, cx };
}
