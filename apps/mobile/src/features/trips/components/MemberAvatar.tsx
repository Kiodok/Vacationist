import { View, Text, Image } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg';

const sizeConfig: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: 'w-[32px] h-[32px]', text: 'text-[12px]' },
  md: { container: 'w-[40px] h-[40px]', text: 'text-[14px]' },
  lg: { container: 'w-[56px] h-[56px]', text: 'text-[18px]' },
};

interface MemberAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: AvatarSize;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function MemberAvatar({ name, avatarUrl, size = 'md' }: MemberAvatarProps) {
  const config = sizeConfig[size];

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        className={`${config.container} rounded-full`}
      />
    );
  }

  return (
    <View className={`${config.container} rounded-full bg-primary-muted items-center justify-center`}>
      <Text className={`${config.text} font-semibold text-primary`}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
