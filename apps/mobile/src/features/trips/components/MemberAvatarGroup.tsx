import { View, Text } from 'react-native';
import { MemberAvatar } from './MemberAvatar';

interface MemberInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface MemberAvatarGroupProps {
  members: MemberInfo[];
  max?: number;
}

export function MemberAvatarGroup({ members, max = 4 }: MemberAvatarGroupProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <View className="flex-row items-center">
      {visible.map((member, index) => (
        <View
          key={member.id}
          className={index > 0 ? '-ml-[8px]' : ''}
          style={{ zIndex: visible.length - index }}
        >
          <View className="rounded-full border-2 border-background">
            <MemberAvatar name={member.name} avatarUrl={member.avatar_url} size="sm" colorSeed={member.id} />
          </View>
        </View>
      ))}
      {overflow > 0 && (
        <View className="-ml-[8px] w-[32px] h-[32px] rounded-full bg-surface-elevated items-center justify-center border-2 border-background">
          <Text className="text-[11px] font-semibold text-text-secondary">
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}
