import { ScrollView as RNScrollView } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import type { ComponentClass } from 'react';

type NWScrollViewProps = ScrollViewProps & {
  contentContainerClassName?: string;
  indicatorClassName?: string;
};

// NativeWind applies contentContainerClassName/indicatorClassName at runtime via CSS interop,
// but the type augmentation doesn't propagate through this project's TS resolution chain.
// This re-export closes the type gap without changing runtime behavior.
export const ScrollView: ComponentClass<NWScrollViewProps> = RNScrollView as unknown as ComponentClass<NWScrollViewProps>;

// Export the instance type so `useRef<ScrollView>` works identically to the RN import.
export type ScrollView = InstanceType<typeof RNScrollView>;
