/** @deprecated Use NUDGE_KEYS instead and look up translations via i18n */
export interface NudgeMessage {
  key: string;
  title: string;
  body: string;
}

export const NUDGE_KEYS = [
  'democracy',
  'nearby',
  'waiting',
  'fomo',
  'quick',
  'captain',
  'team',
  'nudge',
] as const;

export type NudgeKey = typeof NUDGE_KEYS[number];

/** @deprecated Use NUDGE_KEYS with i18n translations instead */
export const NUDGE_MESSAGES: NudgeMessage[] = [
  {
    key: 'democracy',
    title: 'Democracy calls!',
    body: "Are you in favor of dictatorships? If not, vote now!",
  },
  {
    key: 'nearby',
    title: 'Votes nearby!',
    body: "Three members already voted. Now it's your turn!",
  },
  {
    key: 'waiting',
    title: "We're waiting on you...",
    body: 'The group is ready to move forward — just needs your vote!',
  },
  {
    key: 'fomo',
    title: "Don't miss out!",
    body: 'Big trip decisions are being made. Have your say before it\'s too late.',
  },
  {
    key: 'quick',
    title: 'Quick reminder!',
    body: 'There are still open votes on the trip. Takes 10 seconds, promise.',
  },
  {
    key: 'captain',
    title: 'Captain speaking ✈️',
    body: 'This is your reminder that votes are still open. Over and out.',
  },
  {
    key: 'team',
    title: 'Team effort needed!',
    body: "This trip plans itself — except for the voting part. That's on you.",
  },
  {
    key: 'nudge',
    title: 'Friendly nudge 👋',
    body: "Hey! There's still stuff to vote on. We believe in you.",
  },
];
