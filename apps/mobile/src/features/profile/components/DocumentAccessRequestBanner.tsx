import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DocumentAccessRequest } from '@vacationist/types';
import { colors } from '@vacationist/ui';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface DocumentAccessRequestBannerProps {
  requests: DocumentAccessRequest[];
  onGrant: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  isPending: boolean;
}

export function DocumentAccessRequestBanner({
  requests,
  onGrant,
  onDeny,
  isPending,
}: DocumentAccessRequestBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (requests.length === 0) return null;

  return (
    <View className="bg-warning/10 border border-warning/30 rounded-md overflow-hidden">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center justify-between px-md py-sm"
      >
        <View className="flex-row items-center gap-sm">
          <Ionicons name="shield-outline" size={18} color={colors.warning} />
          <Text className="text-body-small text-warning font-semibold">
            {requests.length === 1
              ? '1 document access request'
              : `${requests.length} document access requests`}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.warning}
        />
      </Pressable>

      {expanded && (
        <View className="border-t border-warning/20">
          {requests.map((req, index) => (
            <View
              key={req.request_id}
              className={`px-md py-sm gap-sm ${
                index > 0 ? 'border-t border-warning/10' : ''
              }`}
            >
              <View className="flex-row items-start justify-between gap-sm">
                <View className="flex-1 gap-xs">
                  <Text className="text-body-small text-text-primary font-medium">
                    {req.requester_name}
                  </Text>
                  <Text className="text-label text-text-secondary">
                    Trip: {req.trip_title}
                  </Text>
                  <Text className="text-label text-text-muted">
                    Access for {req.duration_minutes} min · {dayjs(req.created_at).fromNow()}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => onDeny(req.request_id)}
                  disabled={isPending}
                  className="flex-1 min-h-[40px] rounded-sm border border-border items-center justify-center"
                >
                  <Text className="text-body-small text-text-secondary font-medium">Deny</Text>
                </Pressable>
                <Pressable
                  onPress={() => onGrant(req.request_id)}
                  disabled={isPending}
                  className="flex-1 min-h-[40px] rounded-sm bg-warning items-center justify-center"
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-body-small text-white font-semibold">Grant</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
