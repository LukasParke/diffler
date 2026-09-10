export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION_SECONDS = 10;

export const cardDefinitions = [
  {
    id: "readme",
    title: "Signature",
    width: 560,
    height: 390,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "loop",
  },
  {
    id: "readme-classic",
    title: "Classic · 2024",
    width: 500,
    height: 350,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "readme-spotlight",
    title: "Spotlight",
    width: 560,
    height: 440,
    durationInSeconds: 12,
    playback: "loop",
  },
  {
    id: "stats",
    title: "GitHub stats",
    width: 500,
    height: 360,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "languages",
    title: "Language mix",
    width: 500,
    height: 270,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "main-stats",
    title: "At a glance",
    width: 500,
    height: 300,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "repo-impact",
    title: "Repository impact",
    width: 500,
    height: 280,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "issue-tracking",
    title: "Issues & collaboration",
    width: 500,
    height: 280,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "code-metrics",
    title: "Code footprint",
    width: 500,
    height: 280,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "activity-overview",
    title: "Contribution history",
    width: 500,
    height: 360,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "commit-streak",
    title: "Contribution rhythm",
    width: 500,
    height: 230,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "top-languages",
    title: "Language details",
    width: 500,
    height: 300,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
  {
    id: "package-impact",
    title: "Package impact",
    width: 500,
    height: 300,
    durationInSeconds: DEFAULT_DURATION_SECONDS,
    playback: "once",
  },
] as const;

export type CardId = (typeof cardDefinitions)[number]["id"];
export type CardPlayback = (typeof cardDefinitions)[number]["playback"];
export const cardIds = cardDefinitions.map((card) => card.id);

export function isCardId(value: string): value is CardId {
  return cardIds.some((id) => id === value);
}
