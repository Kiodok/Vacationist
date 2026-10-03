import { Text, Linking } from 'react-native';
import type { TextProps } from 'react-native';
import { splitTextIntoLinkSegments } from '@vacationist/utils';
import { colors } from '../theme';

export interface RichTextProps extends Omit<TextProps, 'children'> {
  children: string;
  /**
   * Enables native text selection (long-press to select + copy). Defaults to false.
   * Only opt in on reading surfaces that show the full text (note sheets, chat, detail
   * sheets) — inside a tappable card preview, a selectable Text can swallow the card's
   * own onPress on Android, and a numberOfLines-truncated preview can only ever copy its
   * visible lines anyway.
   */
  selectable?: boolean;
  /**
   * Whether link segments are tappable. Defaults to true. React Native's nested
   * `<Text onPress>` hit-testing can extend a link's touchable region across the rest of
   * its text line — including trailing empty space — which steals taps meant for an
   * OUTER Pressable/TouchableOpacity wrapping the whole RichText (e.g. a card's
   * open/expand action). Pass `false` in exactly that situation: the link keeps its
   * color+underline styling but renders as plain (non-interactive) text, so the outer
   * card gets the tap instead. Leave true (default) wherever there's no competing outer
   * Pressable over the same text.
   */
  linksInteractive?: boolean;
}

/**
 * Drop-in replacement for <Text> that auto-links https:// URLs and optionally enables
 * native text selection. Only https:// is recognized as a link — matching the DB's
 * *_url_https CHECK constraints and the app's httpsUrlSchema (see engineering guide §15
 * Input Sanitization). Linking.openURL is additionally guarded with a startsWith check
 * as defence in depth even though the regex only ever matches https:// text.
 */
export function RichText({ children, selectable = false, linksInteractive = true, ...rest }: RichTextProps) {
  const segments = splitTextIntoLinkSegments(children ?? '');

  return (
    <Text selectable={selectable} {...rest}>
      {segments.map((segment, i) =>
        segment.isLink ? (
          <Text
            key={i}
            onPress={linksInteractive ? () => segment.text.startsWith('https://') && Linking.openURL(segment.text) : undefined}
            style={{ color: colors.primary, textDecorationLine: 'underline' }}
          >
            {segment.text}
          </Text>
        ) : (
          <Text key={i}>{segment.text}</Text>
        )
      )}
    </Text>
  );
}
