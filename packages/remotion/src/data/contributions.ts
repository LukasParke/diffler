import type {UserStats} from './schemas';

type Calendar = UserStats['contributions']['calendar'];
type Timeline = UserStats['contributions']['timeline'];
const DAY_MS = 86_400_000;

function aggregateCalendar(
	days: Calendar,
	combine: (previous: number, next: number) => number,
): Calendar {
	const byDate = new Map<string, number>();
	for (const day of days) {
		byDate.set(
			day.date,
			combine(byDate.get(day.date) ?? 0, day.contributionCount),
		);
	}
	return [...byDate]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, contributionCount]) => ({date, contributionCount}));
}

/** Repeated days at contribution-year boundaries describe one profile/day. */
export function normalizeCalendar(days: Calendar): Calendar {
	return aggregateCalendar(days, Math.max);
}

/** Distinct profiles' observed contribution counts are additive on a shared day. */
export function mergeCalendars(calendars: Calendar[]): Calendar {
	return aggregateCalendar(
		calendars.flatMap(normalizeCalendar),
		(a, b) => a + b,
	);
}

export function mergeTimelines(timelines: Timeline[]): Timeline {
	const byPeriod = new Map<string, number>();
	for (const item of timelines.flat()) {
		byPeriod.set(
			item.period,
			(byPeriod.get(item.period) ?? 0) + item.contributions,
		);
	}
	return [...byPeriod]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([period, contributions]) => ({period, contributions}));
}

export function calendarTimeline(calendar: Calendar): Timeline {
	return mergeTimelines([
		calendar.map((day) => ({
			period: day.date.slice(0, 4),
			contributions: day.contributionCount,
		})),
	]);
}

export function hasCompleteCalendar(
	contributions: Pick<
		UserStats['contributions'],
		'calendar' | 'totalContributions'
	>,
): boolean {
	return (
		normalizeCalendar(contributions.calendar).reduce(
			(sum, day) => sum + day.contributionCount,
			0,
		) === contributions.totalContributions
	);
}

export function mostProductiveMonth(
	months: NonNullable<UserStats['contributions']['mostProductiveMonth']>[],
): UserStats['contributions']['mostProductiveMonth'] {
	return (
		[...months].sort(
			(a, b) =>
				b.contributions - a.contributions || a.month.localeCompare(b.month),
		)[0] ?? null
	);
}

/** Streaks are consecutive UTC dates, as of the data timestamp, never wall time. */
export function calendarStats(
	calendar: Calendar,
	generatedAt: string,
): Pick<
	UserStats['contributions'],
	'currentStreak' | 'longestStreak' | 'peakDay' | 'mostProductiveMonth'
> {
	const days = normalizeCalendar(calendar);
	const byDate = new Map(days.map((day) => [day.date, day.contributionCount]));
	const byMonth = new Map<string, number>();
	let longestStreak = 0;
	let streak = 0;
	let previousTime = 0;
	let peakDay: UserStats['contributions']['peakDay'] = null;

	for (const day of days) {
		const time = Date.parse(`${day.date}T00:00:00.000Z`);
		streak =
			day.contributionCount > 0
				? time - previousTime === DAY_MS
					? streak + 1
					: 1
				: 0;
		longestStreak = Math.max(longestStreak, streak);
		previousTime = time;
		const month = day.date.slice(0, 7);
		byMonth.set(month, (byMonth.get(month) ?? 0) + day.contributionCount);
		if (!peakDay || day.contributionCount > peakDay.contributions) {
			peakDay = {date: day.date, contributions: day.contributionCount};
		}
	}

	const referenceDate = new Date(generatedAt).toISOString().slice(0, 10);
	let cursor = Date.parse(`${referenceDate}T00:00:00.000Z`);
	if ((byDate.get(referenceDate) ?? 0) === 0) {
		cursor -= DAY_MS;
	}
	let currentStreak = 0;
	while ((byDate.get(new Date(cursor).toISOString().slice(0, 10)) ?? 0) > 0) {
		currentStreak += 1;
		cursor -= DAY_MS;
	}

	return {
		currentStreak,
		longestStreak,
		peakDay,
		mostProductiveMonth: mostProductiveMonth(
			[...byMonth].map(([month, contributions]) => ({month, contributions})),
		),
	};
}
