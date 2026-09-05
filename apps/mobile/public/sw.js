// v1.34.0 item 1 — Phase 12: Web Push Notifications.
//
// Plain ES5-compatible JavaScript, no imports — this file is served as a static asset and is
// NOT processed by Metro/any bundler. `Cache-Control: no-store` is set on it in vercel.json so
// browsers never serve a stale copy of this worker.
//
// resolvePath() below is a hand-ported mirror of resolveNotificationPath.ts (native) — a service
// worker can't import a TypeScript module, so this must be kept in sync by hand whenever a
// notification type/route changes there. Every branch below matches that file as of v1.34.0.

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var payload = { title: 'Vacationist', body: '', data: {} };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    // Malformed push payload — still show a generic notification rather than silently dropping it.
  }

  var data = payload.data || {};
  var options = {
    body: payload.body || '',
    icon: '/notification-icon.png',
    badge: '/notification-icon.png',
    tag: data.notificationId || undefined,
    requireInteraction: false,
    data: data,
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Vacationist', options));
});

function resolvePath(data) {
  var type = data.type;
  var tripId = data.tripId;
  var relatedType = data.relatedType;
  var relatedId = data.relatedId;

  if (type === 'trip_deleted') return '/';

  if (!tripId) return '/';

  var highlight = relatedId ? '&highlightId=' + relatedId : '';

  switch (type) {
    case 'new_activity':
    case 'schedule_change':
    case 'activity_note':
      return '/trip/' + tripId + '?tab=Activities' + highlight;
    case 'vote_finalized':
    case 'vote_update':
      if (relatedType === 'accommodation') return '/trip/' + tripId + '?tab=Base' + highlight;
      if (relatedType === 'transfer_flight') return '/trip/' + tripId + '?tab=Transfer' + highlight;
      return '/trip/' + tripId + '?tab=Activities' + highlight;
    case 'expense_change':
      return '/trip/' + tripId + '?tab=Expenses' + highlight;
    case 'expense_settlement':
      return relatedId
        ? '/trip/' + tripId + '/settlement-receipt?receiptId=' + relatedId
        : '/trip/' + tripId + '?tab=Expenses';
    case 'new_member':
    case 'member_left':
      return '/trip/' + tripId + '?tab=Settings';
    case 'reminder':
      if (relatedType === 'expense_reminder') return '/trip/' + tripId + '?tab=Expenses';
      if (relatedType === 'activity_reminder') return '/trip/' + tripId + '?tab=Activities' + highlight;
      return '/trip/' + tripId;
    case 'document_access_request':
      return '/profile';
    case 'document_access_granted':
      return '/trip/' + tripId + '?tab=Settings';
    case 'lost_found':
      return '/trip/' + tripId + '?tab=Stuff' + highlight;
    case 'shared_packing':
      return '/trip/' + tripId + '?tab=Stuff&stuffSegment=shared' + (relatedId ? '&sharedItemId=' + relatedId : '');
    case 'new_chat_message':
      return '/trip/' + tripId + '?tab=Chat';
    default:
      return '/trip/' + tripId;
  }
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var path = resolvePath(event.notification.data || {});

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(path);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(path);
      }
    }),
  );
});
