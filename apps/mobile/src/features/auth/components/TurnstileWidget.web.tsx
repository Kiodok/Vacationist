import { useEffect, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

const SITE_KEY = '0x4AAAAAADmlpH4qVMwb-i5j';

interface Props {
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  // Bump to discard a delivered/failed result and request a new token.
  // Turnstile tokens are single-use, so callers must reset after every
  // consumption attempt (success or failure) before submitting again.
  resetNonce?: number;
}

export function TurnstileWidget({ onToken, onExpired, onError, resetNonce }: Props) {
  const ref = useRef<TurnstileInstance>(undefined);
  const prevResetNonce = useRef(resetNonce);

  useEffect(() => {
    if (resetNonce === undefined || resetNonce === prevResetNonce.current) return;
    prevResetNonce.current = resetNonce;
    ref.current?.reset();
  }, [resetNonce]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        onSuccess={onToken}
        onExpire={onExpired}
        onError={onError}
        options={{ refreshExpired: 'auto' }}
      />
    </div>
  );
}
