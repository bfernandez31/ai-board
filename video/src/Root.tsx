import { Composition } from 'remotion';
import { Video } from './Video';
import { VIDEO } from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AiBoardDemo"
      component={Video}
      durationInFrames={VIDEO.TOTAL_FRAMES}
      fps={VIDEO.FPS}
      width={VIDEO.WIDTH}
      height={VIDEO.HEIGHT}
    />
  );
};
