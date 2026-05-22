import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActiveGrant } from '@vacationist/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ActiveGrantsBannerProps {
  grants: ActiveGrant[];
  onRevoke: (requestId: string) => void;
  isRevoking: boolean;
}

export function ActiveGrantsBanner({ grants, onRevoke, isRevoking }: ActiveGrantsBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (grants.length === 0) return null;

  return (
    <View className="bg-primary/10 border border-primary/30 rounded-md overflow-hidden">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center justify-between px-md py-sm"
      >
        <View className="flex-row items-center gap-sm">
          <Ionicons name="eye-outline" size={18} color="#6C63FF" />
          <Text className="text-body-small text-primary font-semibold">
            {grants.length === 1
              ? '1 active document share'
              : `${grants.length} active document shares`}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#6C63FF"
        />
      </Pressable>

      {expanded && (
        <View className="border-t border-primary/20">
          {grants.map((grant, index) => (
            <View
              key={grant.grant_id}
              className={`px-md py-sm flex-row items-center justify-between gap-sm ${
                index > 0 ? 'border-t border-primary/10' : ''
              }`}
            >
              <View className="flex-1 gap-xs">
                <Text className="text-body-small text-text-primary font-medium">
                  {grant.requester_name}
                </Text>
                <Text className="text-label text-text-secondary">Trip: {grant.trip_title}</Text>
                <Text className="text-label text-text-muted">
                  Expires {dayjs(grant.expires_at).fromNow()}
                </Text>
              </View>
              <Pressable
                onPress={() => onRevoke(grant.request_id)}
                disabled={isRevoking}
                className="min-h-[36px] px-sm rounded-sm border border-danger items-center justify-center"
              >
                {isRevoking ? (
                  <ActivityIndicator size="small" color="#FF5C5C" />
                ) : (
                  <Text className="text-body-small text-danger font-medium">Revoke</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
