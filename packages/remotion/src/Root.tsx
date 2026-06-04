import {CalculateMetadataFunction, Composition, getInputProps} from 'remotion';
import './style.css';

import {Config} from './config';
import {fetchUserStats, MainProps, SourceProps, mainSchema} from './data';
import {defaultStats} from './data/defaultStats';
import {Card} from './components/effects/Card';
import {cards} from './cards';

const {FPS, DurationInFrames} = Config;

export const RemotionRoot = () => {
	const calculateMetadata: CalculateMetadataFunction<MainProps> = async (
		props,
	) => {
		const inputProps = getInputProps() as SourceProps;
		const userStats = await fetchUserStats(inputProps);

		return {
			props: {
				...props,
				userStats,
			},
		};
	};

	return (
		<>
			{cards.map(
				({
					id,
					component: Component,
					height,
					width = 500,
					durationInFrames = DurationInFrames,
				}) => (
					<Composition
						key={id}
						id={id}
						component={(props: MainProps) => (
							<Card userStats={props.userStats}>
								<Component userStats={props.userStats} />
							</Card>
						)}
						durationInFrames={durationInFrames}
						fps={FPS}
						width={width}
						height={height}
						schema={mainSchema}
						calculateMetadata={calculateMetadata}
						defaultProps={{
							userStats: defaultStats,
						}}
					/>
				),
			)}
		</>
	);
};
