import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { colors, SCENES } from './theme';
import { Intro } from './scenes/Intro';
import { Dashboard } from './scenes/Dashboard';
import { KanbanBoard } from './scenes/KanbanBoard';
import { ResultsHealth } from './scenes/ResultsHealth';
import { Outro } from './scenes/Outro';

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.base }}>
      <Sequence from={SCENES.INTRO.from} durationInFrames={SCENES.INTRO.duration}>
        <Intro />
      </Sequence>
      <Sequence from={SCENES.DASHBOARD.from} durationInFrames={SCENES.DASHBOARD.duration}>
        <Dashboard />
      </Sequence>
      <Sequence from={SCENES.KANBAN.from} durationInFrames={SCENES.KANBAN.duration}>
        <KanbanBoard />
      </Sequence>
      <Sequence from={SCENES.RESULTS.from} durationInFrames={SCENES.RESULTS.duration}>
        <ResultsHealth />
      </Sequence>
      <Sequence from={SCENES.OUTRO.from} durationInFrames={SCENES.OUTRO.duration}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
