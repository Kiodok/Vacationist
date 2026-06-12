// With networkMode 'offlineFirst', a mutation that fails while offline is
// PAUSED (isPending stays true until reconnect). UI must not treat a paused
// mutation as in-flight: the change is queued and will sync later.
// Busy = actively talking to the network. Paused (queued offline) is NOT busy.
export function isMutationBusy(m: { isPending: boolean; isPaused: boolean }): boolean {
  return m.isPending && !m.isPaused;
}
