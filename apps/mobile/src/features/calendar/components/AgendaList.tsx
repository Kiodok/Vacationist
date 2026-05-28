import { SectionList, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Activity, SupportedTimezone } from '@vacationist/types';
import { splitDayActivities } from '@vacationist/utils';
import { AgendaItem } from './AgendaItem';
import { EmptyCalendarDay } from './EmptyCalendarDay';

interface AgendaListProps {
  activities: Activity[];
  timezone: SupportedTimezone;
  selectedDate: string;
  onActivityPress: (activity: Activity) => void;
  attendeesByActivity?: Record<string, string[]>;
}

interface AgendaSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  data: Activity[];
}

export function AgendaList({ activities, timezone, selectedDate, onActivityPress, attendeesByActivity }: AgendaListProps) {
  const { t } = useTranslation('calendar');

  if (activities.length === 0) {
    return <EmptyCalendarDay date={selectedDate} timezone={timezone} />;
  }

  const { allDay, timed } = splitDayActivities(activities);

  const sections: AgendaSection[] = [];
  if (timed.length > 0) {
    sections.push({ title: t('scheduled'), icon: 'time-outline', data: timed });
  }
  if (allDay.length > 0) {
    sections.push({ title: t('allDay'), icon: 'sunny-outline', data: allDay });
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <AgendaItem
          activity={item}
          timezone={timezone}
          onPress={onActivityPress}
          attendees={attendeesByActivity?.[item.id]}
        />
      )}
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-center gap-sm px-md pt-md pb-sm">
          <Ionicons name={section.icon} size={16} color="#A0A0A0" />
          <Text className="text-body-small text-text-secondary font-semibold">
            {section.title}
          </Text>
          <Text className="text-body-small text-text-muted">
            ({section.data.length})
          </Text>
        </View>
      )}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
      stickySectionHeadersEnabled={false}
    />
  );
}
