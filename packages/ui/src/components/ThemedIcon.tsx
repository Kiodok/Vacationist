import { Ionicons } from '@expo/vector-icons';
import { useResolvedTheme } from '../themeContext';

export type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type Props = React.ComponentProps<typeof Ionicons>;

// In colorful mode, swap outline Ionicons variants for their filled equivalents
// to give the UI a warmer, more playful feel.
export function ThemedIcon(props: Props) {
  const theme = useResolvedTheme();
  let name = props.name as string;

  if (theme === 'colorful' && name.endsWith('-outline')) {
    name = name.replace('-outline', '');
  }

  return <Ionicons {...props} name={name as IoniconsName} />;
}
