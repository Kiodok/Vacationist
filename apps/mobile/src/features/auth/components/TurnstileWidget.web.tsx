import { Turnstile } from '@marsidev/react-turnstile';

const SITE_KEY = '0x4AAAAAADmlpH4qVMwb-i5j';

interface Props {
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
}

export function TurnstileWidget({ onToken, onExpired, onError }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Turnstile
        siteKey={SITE_KEY}
        onSuccess={onToken}
        onExpire={onExpired}
        onError={onError}
        options={{ size: 'normal', refreshExpired: 'auto' }}
      />
    </div>
  );
}
