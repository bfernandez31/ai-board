import Image from 'next/image';
import { Agent } from '@prisma/client';
import { getAgentIconPath } from '@/app/lib/utils/agent-icons';

interface AgentIconProps {
  agent: Agent;
  size?: number;
  className?: string;
}

export function AgentIcon({ agent, size = 16, className }: AgentIconProps) {
  return (
    <Image
      src={getAgentIconPath(agent)}
      alt={agent}
      width={size}
      height={size}
      className={`inline-block shrink-0${className ? ` ${className}` : ''}`}
    />
  );
}
