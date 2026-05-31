import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { AVATAR_COLORS } from '@vacationist/ui';

type AvatarSize = 'sm' | 'md' | 'lg';

const sizeConfig: Record<AvatarSize, { sizePx: number; text: string }> = {
  sm: { sizePx: 32, text: 'text-[12px]' },
  md: { sizePx: 40, text: 'text-[14px]' },
  lg: { sizePx: 56, text: 'text-[18px]' },
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

interface MemberAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: AvatarSize;
  colorSeed?: string;
}

export function MemberAvatar({ name, avatarUrl, size = 'md', colorSeed }: MemberAvatarProps) {
  const config = sizeConfig[size];
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: config.sizePx, height: config.sizePx, borderRadius: config.sizePx / 2 }}
        onError={() => setImgError(true)}
      />
    );
  }

  const seed = colorSeed ?? name;
  const color = AVATAR_COLORS[hashCode(seed) % AVATAR_COLORS.length];

  return (
    <View
      style={{
        width: config.sizePx,
        height: config.sizePx,
        borderRadius: config.sizePx / 2,
        backgroundColor: color + '26',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text className={`${config.text} font-semibold`} style={{ color }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
