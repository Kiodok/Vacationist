import { useEffect, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

interface UseDiscardGuardOptions {
  /** The sheet's own `visible` prop — clears a stale confirm bar when the sheet closes some
   * other way (a successful save, the parent unmounting it) so the next open doesn't show it. */
  visible: boolean;
  /** Whether the form currently holds anything that closing would silently throw away. */
  hasUnsavedInput: boolean;
  /** The sheet's LOCAL close (form reset, etc. — whatever the sheet already does when it
   * actually closes), never the raw `onClose` prop unless that IS the sheet's local close. */
  onClose: () => void;
}

interface UseDiscardGuardResult {
  /** Wire to `Modal.onRequestClose` and the header Cancel/X button. */
  requestClose: () => void;
  /** Spread onto `<SwipeToDismiss {...swipeProps}>`. */
  swipeProps: {
    onDismiss: () => void;
    dismissGuard: SharedValue<boolean>;
    onDismissBlocked: () => void;
  };
  /** True while the inline "Discard changes?" bar should replace the sheet body. */
  discardConfirmVisible: boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
}

/**
 * Shared "resist accidental close" guard for an input-collecting sheet — the pattern first built
 * for CreateExpenseSheet/EditExpenseSheet (v1.39.6 Task 4), extracted so every other sheet with a
 * discardable draft can reuse it instead of hand-rolling the same ~25 lines.
 *
 * Covers all three close surfaces through one `requestClose`: the Android back button /
 * `Modal.onRequestClose`, the header Cancel button, and (via `swipeProps`) the swipe-down
 * gesture and backdrop tap inside `<SwipeToDismiss>`.
 */
export function useDiscardGuard({ visible, hasUnsavedInput, onClose }: UseDiscardGuardOptions): UseDiscardGuardResult {
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

  useEffect(() => {
    if (!visible) setDiscardConfirmVisible(false);
  }, [visible]);

  const requestClose = () => {
    if (hasUnsavedInput) setDiscardConfirmVisible(true);
    else onClose();
  };
  const confirmDiscard = () => {
    setDiscardConfirmVisible(false);
    onClose();
  };
  const cancelDiscard = () => setDiscardConfirmVisible(false);

  // Mirrors hasUnsavedInput into a SharedValue so SwipeToDismiss's gesture worklet can read it
  // synchronously on the UI thread, BEFORE it commits to the slide-away animation — discovering
  // the close was blocked only once the panel has already finished sliding off-screen leaves it
  // invisible and stuck. See the swipetodismiss-ondismiss-may-not-dismiss skill.
  const dismissGuard = useSharedValue(false);
  useEffect(() => {
    dismissGuard.value = hasUnsavedInput;
  }, [hasUnsavedInput, dismissGuard]);

  return {
    requestClose,
    swipeProps: {
      onDismiss: requestClose,
      dismissGuard,
      onDismissBlocked: () => setDiscardConfirmVisible(true),
    },
    discardConfirmVisible,
    confirmDiscard,
    cancelDiscard,
  };
}
