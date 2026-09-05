import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { ExpenseCategoryTotal, Currency, ExpenseRelatedType } from '@vacationist/types';
import { formatCurrency, computeDonutArcs } from '@vacationist/utils';
import { useResolvedTheme } from '@vacationist/ui';

interface ExpenseCategoryChartProps {
  totals: ExpenseCategoryTotal[];
  currency: Currency;
}

// Fixed hue-order categorical palette (dataviz skill) — validated for a donut's circular
// adjacency (including the wrap-around last→first pair) in light, dark, AND colorful mode via
// scripts/validate_palette.js, `--pairs adjacent` (the default; a donut only ever neighbors two
// slices per wedge, not every pair, so the stricter `--pairs all` gate scatter/bubble/choropleth
// charts need doesn't apply here). Order is fixed per category, never re-sorted by value, per the
// "color follows the entity, never its rank" rule — a category keeps its hue every time this
// chart renders, even as amounts change.
// `colorful` reuses the `light` hues verbatim rather than a fourth invented set — re-validated
// against the colorful chart surface (bg-surface-elevated, #FEE0AD, the modal's own background)
// and they independently pass (same WARN-tier contrast band `light` already carries against its
// own surface, mitigated the same way: the direct labels below are the required "relief").
const CATEGORY_COLORS: Record<ExpenseRelatedType, { light: string; dark: string; colorful: string }> = {
  accommodation: { light: '#2a78d6', dark: '#3987e5', colorful: '#2a78d6' }, // blue
  activity:      { light: '#eb6834', dark: '#d95926', colorful: '#eb6834' }, // orange
  transport:     { light: '#1baf7a', dark: '#199e70', colorful: '#1baf7a' }, // aqua
  shopping:      { light: '#eda100', dark: '#c98500', colorful: '#eda100' }, // yellow
  manual:        { light: '#e87ba4', dark: '#d55181', colorful: '#e87ba4' }, // magenta
};
const CATEGORY_ORDER: ExpenseRelatedType[] = ['accommodation', 'activity', 'transport', 'shopping', 'manual'];

const SIZE = 140;
const STROKE_WIDTH = 22;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ExpenseCategoryChart({ totals, currency }: ExpenseCategoryChartProps) {
  const { t } = useTranslation('expenses');
  const theme = useResolvedTheme();

  const totalsByCategory = new Map(totals.map((c) => [c.related_type, c.total]));
  // Raw sum of category amounts — the center total and the arc math both derive from this same
  // number, never from already-rounded percentage/display strings (see donutChart.test.ts).
  const grandTotal = totals.reduce((sum, c) => sum + c.total, 0);

  // computeDonutArcs is generic over `category: string` (it has no notion of ExpenseRelatedType)
  // — re-narrow it back to the real union right after, since CATEGORY_ORDER guarantees every
  // value came from that domain, rather than casting at every downstream usage.
  const arcs = computeDonutArcs(
    CATEGORY_ORDER.map((category) => ({ category, amount: totalsByCategory.get(category) ?? 0 })),
    { size: SIZE, strokeWidth: STROKE_WIDTH },
  ).map((arc) => ({
    ...arc,
    category: arc.category as ExpenseRelatedType,
    color: CATEGORY_COLORS[arc.category as ExpenseRelatedType][theme],
  }));

  if (arcs.length === 0) return null;

  return (
    <View className="gap-sm">
      <Text className="text-body text-text-secondary font-semibold">{t('modal.categoryBreakdown')}</Text>
      <View className="flex-row items-center gap-md">
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            {/* Standard SVG `transform` string (not the rotation/origin shorthand props) —
                react-native-svg's web adapter derives those into a raw `transform-origin` key that
                triggers React's "did you mean transformOrigin" DOM warning. */}
            <G transform={`rotate(-90, ${SIZE / 2}, ${SIZE / 2})`}>
              {arcs.map((arc) => (
                <Circle
                  key={arc.category}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={arc.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                  strokeDashoffset={arc.offset}
                  strokeLinecap="butt"
                  fill="none"
                />
              ))}
            </G>
          </Svg>

          {/* Center total — free space inside the ring. Absolutely positioned over the Svg
              rather than an SVG <Text> so it can use the same text tokens/line-wrapping as the
              rest of the app; pointerEvents="none" so it never intercepts taps meant for the ring. */}
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
            pointerEvents="none"
          >
            <Text className="text-label text-text-muted uppercase">{t('modal.categoryTotal')}</Text>
            <Text
              className="text-body font-semibold text-text-primary"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={{ maxWidth: RADIUS * 1.6 }}
            >
              {formatCurrency(grandTotal, currency)}
            </Text>
          </View>
        </View>

        {/* Direct labels satisfy the "relief" requirement for the WARN-level contrast a couple
            of these hues have against a light surface — identity is never color-alone here. */}
        <View className="flex-1 gap-xs">
          {arcs.map((arc) => (
            <View key={arc.category} className="flex-row items-center gap-xs">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: arc.color }} />
              <Text className="text-body-small text-text-primary flex-1" numberOfLines={1}>
                {t(`category.${arc.category}`)}
              </Text>
              <Text className="text-body-small text-text-secondary">
                {formatCurrency(arc.amount, currency)}
              </Text>
              <Text className="text-label text-text-muted w-[36px] text-right">
                {arc.percent}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
