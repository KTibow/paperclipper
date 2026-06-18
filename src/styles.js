// Paperclip style catalog. Each style defines the parameter envelope the
// factory samples within. Dimensions are in millimetres and reflect real
// paperclip sizes so QA's manufacturability checks are meaningful.
//
// Parameters (see src/paperclip.js for geometry):
//   length        overall length (long axis)
//   width         overall width  (outer-left -> outer-right)
//   innerFrac     inner lanes span this fraction of the width
//   innerShift    inner loop offset toward the left (0..1)
//   topMargin     distance of the top turn from the top edge
//   wire          wire diameter (stroke width)
//   ripples       1 => add non-skid bumps on the outer lanes
//   bottomGapFrac inner bottom turn sits this fraction of L above outer bottom
//   tongueFrac    inner-left free end terminates this fraction of L from top
//   outerEndFrac  outer-left free end terminates this fraction of L from top

export const STYLES = {
  standard: {
    label: "Standard (Gem No. 1)",
    length: [30, 34],
    width: [8, 9.6],
    innerFrac: [0.42, 0.54],
    innerShift: [0.3, 0.5],
    topMargin: [1.6, 2.6],
    wire: [0.8, 1.0],
    ripples: 0,
    bottomGapFrac: [0.04, 0.09],
    tongueFrac: [0.14, 0.26],
    outerEndFrac: [0.03, 0.08],
  },
  small: {
    label: "Small (No. 1 mini)",
    length: [21, 26],
    width: [6.5, 8],
    innerFrac: [0.42, 0.54],
    innerShift: [0.3, 0.5],
    topMargin: [1.2, 2.0],
    wire: [0.6, 0.82],
    ripples: 0,
    bottomGapFrac: [0.04, 0.09],
    tongueFrac: [0.14, 0.26],
    outerEndFrac: [0.03, 0.08],
  },
  jumbo: {
    label: "Jumbo (No. 1 Giant)",
    length: [44, 52],
    width: [11, 13],
    innerFrac: [0.5, 0.6],
    innerShift: [0.4, 0.5],
    topMargin: [2.4, 3.6],
    wire: [1.0, 1.3],
    ripples: 0,
    bottomGapFrac: [0.04, 0.09],
    tongueFrac: [0.14, 0.26],
    outerEndFrac: [0.03, 0.08],
  },
  nonskid: {
    label: "Non-Skid (ridged)",
    length: [30, 35],
    width: [8.5, 10],
    innerFrac: [0.42, 0.54],
    innerShift: [0.3, 0.48],
    topMargin: [1.6, 2.6],
    wire: [0.85, 1.05],
    ripples: 1,
    bottomGapFrac: [0.04, 0.09],
    tongueFrac: [0.14, 0.26],
    outerEndFrac: [0.03, 0.08],
  },
  ideal: {
    label: "Ideal (round-back)",
    length: [33, 40],
    width: [11, 13.5],
    innerFrac: [0.54, 0.64],
    innerShift: [0.4, 0.5],
    topMargin: [2.0, 3.2],
    wire: [0.95, 1.2],
    ripples: 0,
    bottomGapFrac: [0.04, 0.09],
    tongueFrac: [0.14, 0.26],
    outerEndFrac: [0.03, 0.08],
  },
};

export const STYLE_NAMES = Object.keys(STYLES);

export function getStyle(name) {
  const style = STYLES[name];
  if (!style) {
    throw new Error(`Unknown paperclip style: ${name}`);
  }
  return style;
}

// FROZEN, APPEND-ONLY CATALOGS.
//
// Reproducibility of the production ledger depends on (style, seed) always
// mapping to the exact same clip. Therefore:
//   * NEVER edit the parameters of an existing style above.
//   * NEVER reorder or remove entries in an existing catalog array below.
// To evolve the product line, ADD a new style key to STYLES (with new ranges)
// and PUSH a new array to CATALOGS that lists the styles in production for that
// version. New production uses LATEST_CATALOG; old batches keep their own
// recorded catalog version, so the whole ledger stays verifiable forever.
export const CATALOGS = [
  ["standard", "small", "jumbo", "nonskid", "ideal"],
];
export const LATEST_CATALOG = CATALOGS.length - 1;

export function catalogStyles(version = LATEST_CATALOG) {
  const list = CATALOGS[version];
  if (!list) throw new Error(`Unknown catalog version: ${version}`);
  return list;
}
