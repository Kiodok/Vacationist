import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const SITE_KEY = '0x4AAAAAADmlpH4qVMwb-i5j';

// baseUrl makes Cloudflare domain validation pass against the configured origin.
const BASE_URL = 'https://web.vacationist.app';

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}</style>
</head>
<body>
<div id="c"></div>
<script>
function onReady(){
  turnstile.render('#c',{
    sitekey:'${SITE_KEY}',
    'refresh-expired':'auto',
    callback:function(t){window.ReactNativeWebView.postMessage(JSON.stringify({type:'token',token:t}))},
    'error-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}))},
    'expired-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'expired'}))}
  });
}
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onReady&render=explicit" async defer></script>
</body>
</html>`;

interface Props {
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
}

export function TurnstileWidget({ onToken, onExpired, onError }: Props) {
  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; token?: string };
      if (msg.type === 'token' && msg.token) onToken(msg.token);
      else if (msg.type === 'expired') onExpired?.();
      else if (msg.type === 'error') onError?.();
    } catch {}
  }

  return (
    <WebView
      source={{ html: HTML, baseUrl: BASE_URL }}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      style={styles.hidden}
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  hidden: { width: 0, height: 0, opacity: 0, position: 'absolute' },
});
