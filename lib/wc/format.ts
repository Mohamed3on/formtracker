// World Cup squad values are stored in millions (see model.ts); render them as
// compact €m / €bn strings. Kept dependency-free so the client bracket/schedule
// components can import it without dragging in buildModel and its 495-row
// third-place allocation table.
export const fmt = (mv: number) =>
  mv >= 1000 ? `€${(mv / 1000).toFixed(2)}bn` : `€${mv.toFixed(2)}m`;
export const fmtS = (mv: number) =>
  mv >= 1000 ? `€${(mv / 1000).toFixed(2)}bn` : `€${Math.round(mv)}m`;
