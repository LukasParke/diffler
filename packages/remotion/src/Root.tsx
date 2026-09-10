import {CalculateMetadataFunction, Composition} from 'remotion';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import './style.css';

import {Config} from './config';
import {Card} from './components/effects/Card';
import {cards} from './cards';
import {
	compositionSchema,
	resolveRenderProps,
	type CompositionInputProps,
} from './render/input';

const {FPS, DurationInFrames} = Config;

export const calculateCardMetadata: CalculateMetadataFunction<
	CompositionInputProps
> = async ({props}) => ({
	// These are Remotion's actual merged/Studio-edited props, not getInputProps().
	// Invalid or unavailable data rejects metadata rather than rendering a fixture.
	props: await resolveRenderProps(props),
});

export const RemotionRoot = () => (
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
					component={(props: CompositionInputProps) => {
						if (!props.userStats) {
							throw new Error(
								'Supply normalized userStats or a real stats source in the composition props.',
							);
						}
						return (
							<Card userStats={props.userStats}>
								<Component userStats={props.userStats} />
							</Card>
						);
					}}
					durationInFrames={durationInFrames}
					fps={FPS}
					width={width}
					height={height}
					schema={compositionSchema}
					calculateMetadata={calculateCardMetadata}
					defaultProps={{}}
				/>
			),
		)}
	</>
);
