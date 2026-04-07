import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { colors, SCENES } from './theme';
import { Intro } from './scenes/Intro';
import { Dashboard } from './scenes/Dashboard';
import { KanbanBoard } from './scenes/KanbanBoard';
import { TicketDetail } from './scenes/TicketDetail';
import { WorkflowFlow } from './scenes/WorkflowFlow';
import { Analytics } from './scenes/Analytics';

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
      <Sequence from={SCENES.TICKET.from} durationInFrames={SCENES.TICKET.duration}>
        <TicketDetail />
      </Sequence>
      <Sequence from={SCENES.WORKFLOW.from} durationInFrames={SCENES.WORKFLOW.duration}>
        <WorkflowFlow />
      </Sequence>
      <Sequence from={SCENES.ANALYTICS.from} durationInFrames={SCENES.ANALYTICS.duration}>
        <Analytics />
      </Sequence>
    </AbsoluteFill>
  );
};
