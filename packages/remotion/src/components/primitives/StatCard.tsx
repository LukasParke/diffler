import {MetricTile} from './MetricTile';

type StatCardProps = {
	title: string;
	value: number;
	detail?: string;
	accent?: string;
	delay?: number;
	compact?: boolean;
};

export const StatCard = ({
	title,
	value,
	detail,
	accent,
	delay = 0,
	compact = false,
}: StatCardProps) => (
	<MetricTile
		label={title}
		value={value}
		detail={detail}
		accent={accent}
		delay={delay}
		large={!compact}
	/>
);
