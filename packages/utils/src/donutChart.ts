/**
 * Pure donut-chart geometry — extracted from ExpenseCategoryChart.tsx (v1.34.0 items 3-5) so the
 * arc/angle trigonometry gets real unit-test coverage instead of being buried inline in
 * component code with zero tests. This is exactly the kind of math that's easy to get subtly
 * wrong (wrong rotation direction, off-by-one segment ordering, a label landing in the wrong
 * slice) while still "looking plausible" in a quick visual check.
 */
export interface DonutArcInput {
  category: string;
  amount: number;
}

export interface DonutArc {
  category: string;
  amount: number;
  /** Rounded whole-number percent of the grand total (0-100). The in-slice label and the legend
   * row both read this one field, so the two numbers on screen can never disagree. */
  percent: number;
  /** SVG `strokeDasharray`'s "on" length. */
  dash: number;
  /** SVG `strokeDashoffset`. */
  offset: number;
  /** Degrees, already including the chart's -90 (12-o'clock) baseline — for a label rendered
   * OUTSIDE the stroke arcs' rotated `<G>`, which needs the offset baked into the angle itself
   * rather than inherited from a transform. */
  midAngleDeg: number;
}

export interface ComputeDonutArcsOptions {
  /** Overall SVG width/height (the donut is always drawn square). */
  size: number;
  strokeWidth: number;
  /** Arc-length gap between segments — applied only when there are 2+ segments (a single 100%
   * segment must be a full, ungapped circle). */
  gap?: number;
}

const DEFAULT_GAP = 3;

/**
 * Zero-amount and negative-total inputs both return `[]` — the caller (ExpenseCategoryChart)
 * already treats an empty result as "render nothing" (matching its prior early-`return null`).
 * Category order is preserved from the input array — this function never re-sorts by value, per
 * the existing "color follows the entity, never its rank" rule (segments are pre-ordered by the
 * caller's fixed CATEGORY_ORDER before being passed in).
 */
export function computeDonutArcs(segments: DonutArcInput[], options: ComputeDonutArcsOptions): DonutArc[] {
  const grandTotal = segments.reduce((sum, s) => sum + s.amount, 0);
  const nonZero = segments.filter((s) => s.amount > 0);
  if (grandTotal <= 0 || nonZero.length === 0) return [];

  const radius = (options.size - options.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = nonZero.length > 1 ? (options.gap ?? DEFAULT_GAP) : 0;

  // Largest-remainder rounding: rounding each segment's percent independently (Math.round) can
  // make the displayed set sum to 99 or 101 (e.g. three equal thirds round to 33/33/33 = 99) —
  // visible on screen since the in-slice labels and legend both show these percents side by side.
  // Floor every share first, then hand the leftover whole points to the segments with the largest
  // fractional remainder, so the displayed percentages always sum to exactly 100.
  const rawPercents = nonZero.map((seg) => (seg.amount / grandTotal) * 100);
  const percents = rawPercents.map((p) => Math.floor(p));
  const remainder = 100 - percents.reduce((sum, p) => sum + p, 0);
  const byRemainderDesc = rawPercents
    .map((p, i) => ({ i, frac: p - percents[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    percents[byRemainderDesc[k].i] += 1;
  }

  let cumulative = 0;
  return nonZero.map((seg, i) => {
    const fraction = seg.amount / grandTotal;
    const rawLength = fraction * circumference;
    const dash = Math.max(rawLength - gap, 0);
    const offset = -cumulative;
    const startAngleDeg = -90 + (cumulative / circumference) * 360;
    const sweepDeg = fraction * 360;
    const midAngleDeg = startAngleDeg + sweepDeg / 2;
    cumulative += rawLength;

    return {
      category: seg.category,
      amount: seg.amount,
      percent: percents[i],
      dash,
      offset,
      midAngleDeg,
    };
  });
}
