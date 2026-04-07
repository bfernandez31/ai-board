import { AbsoluteFill, Sequence } from 'remotion';
import { colors, SCENES } from './theme';

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.base }}>
      <Sequence from={SCENES.INTRO.from} durationInFrames={SCENES.INTRO.duration}>
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: colors.text, fontSize: 48, fontFamily: 'Righteous' }}>
            Intro placeholder
          </span>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
