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
   * visible lines anyway. Links (isLink segments) are always tappable regardless of this
   * prop — nested <Text onPress> does not have the same touch-swallowing problem.
   */
  selectable?: boolean;
}

/**
 * Drop-in replacement for <Text> that auto-links https:// URLs and optionally enables
 * native text selection. Only https:// is recognized as a link — matching the DB's
 * *_url_https CHECK constraints and the app's httpsUrlSchema (see engineering guide §15
 * Input Sanitization). Linking.openURL is additionally guarded with a startsWith check
 * as defence in depth even though the regex only ever matches https:// text.
 */
export function RichText({ children, selectable = false, ...rest }: RichTextProps) {
  const segments = splitTextIntoLinkSegments(children ?? '');

  return (
    <Text selectable={selectable} {...rest}>
      {segments.map((segment, i) =>
        segment.isLink ? (
          <Text
            key={i}
            onPress={() => segment.text.startsWith('https://') && Linking.openURL(segment.text)}
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
