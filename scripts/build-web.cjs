/**
 * Wraps `expo export --platform web` so that Vercel builds exit cleanly.
 *
 * Root cause: NativeWind forks a Tailwind CLI child process via child_process.fork().
 * The forked child keeps Tailwind's internal setTimeout handles alive even after the
 * export finishes. Those handles prevent Node from exiting, so `expo export` prints
 * "Exported: dist" and then hangs indefinitely.
 *
 * Fix: run expo export as a child of this wrapper. When we see "Exported:" in the
 * output we know the bundle is on disk and complete. We give a short grace period for
 * any final file flushes, then call process.exit(0) ourselves — bypassing the stuck
 * event loop in the expo process.
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const appDir = path.join(__dirname, '..', 'apps', 'mobile');
const isWin = process.platform === 'win32';

const child = spawn(isWin ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web'], {
  cwd: appDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,
});

let exportDone = false;
let childExitCode = null;

function onData(chunk, isStderr) {
  const text = chunk.toString();
  if (isStderr) process.stderr.write(text);
  else process.stdout.write(text);

  // Expo SDK ≥50 prints "Exported: <dir>" on success.
  // Older versions printed "App exported to: <dir>".
  if (!exportDone && /Exported:|App exported/i.test(text)) {
    exportDone = true;
    // 3-second grace period covers any final file writes before we exit.
    setTimeout(() => process.exit(0), 3000);
  }
}

child.stdout.on('data', (d) => onData(d, false));
child.stderr.on('data', (d) => onData(d, true));

child.on('exit', (code) => {
  childExitCode = code ?? 0;
  if (!exportDone) {
    // Child exited without a success marker — propagate the failure.
    process.exit(childExitCode);
  }
  // If exportDone is already true the setTimeout above will handle exit.
});

child.on('error', (err) => {
  console.error('Failed to start expo export:', err.message);
  process.exit(1);
});

// Hard ceiling: if the export itself takes more than 20 minutes, something is
// genuinely broken — fail the build rather than letting Vercel time out silently.
setTimeout(() => {
  console.error('build-web: expo export exceeded 20-minute limit, aborting.');
  process.exit(1);
}, 20 * 60 * 1000).unref();
