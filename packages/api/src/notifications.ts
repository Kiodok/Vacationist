import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Notification, NotificationPreference, UpdateNotificationPreferencesInput } from '@vacationist/types';

export async function getNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as Notification[];
}

export async function getTripNotifications(tripId: string, limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as Notification[];
}

export async function getUnreadCount(tripId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_notification_count', {
    p_trip_id: tripId,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });

  if (error) throw error;
}

export async function markAllNotificationsRead(tripId?: string): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_trip_id: tripId,
  });

  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

export async function getNotificationPreferences(tripId: string): Promise<NotificationPreference> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('trip_id', tripId)
    .single();

  if (error) throw error;
  return data as unknown as NotificationPreference;
}

export async function updateNotificationPreferences(
  tripId: string,
  prefs: UpdateNotificationPreferencesInput,
): Promise<NotificationPreference> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notification_preferences')
    .update(prefs)
    .eq('trip_id', tripId)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as NotificationPreference;
}

export async function sendOrganizerNudge(tripId: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('send_organizer_nudge', {
    p_trip_id: tripId,
    p_title: title,
    p_body: body,
  });

  if (error) throw error;
}

export interface NotificationRealtimeCallbacks {
  onInsert: (notification: Notification) => void;
  onUpdate: (notification: Notification) => void;
  onDelete: (id: string) => void;
}

export function subscribeToNotificationsRealtime(
  userId: string,
  callbacks: NotificationRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => callbacks.onInsert(payload.new as unknown as Notification),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => callbacks.onUpdate(payload.new as unknown as Notification),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => callbacks.onDelete((payload.old as { id: string }).id),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromNotifications(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
