import type { Stage } from '@prisma/client';
import type {
  CommandPaletteDestinationResult,
  CommandPaletteTicketMatchType,
  CommandPaletteTicketResult,
  ProjectNavigationDestination,
} from '@/lib/types';

export interface TicketSearchCandidate {
  id: number;
  projectId: number;
  ticketKey: string;
  title: string;
  stage: Stage;
}

interface MatchDetails {
  score: number;
  rank: number;
  matchType: CommandPaletteTicketMatchType;
}

interface RankedDestinationResult extends CommandPaletteDestinationResult {
  sortRank: number;
}

interface RankedTicketResult extends CommandPaletteTicketResult {
  sortRank: number;
}

const DEFAULT_DESTINATION_SCORE = 100;
const DEFAULT_TICKET_SCORE = 50;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function isSubsequence(query: string, value: string): boolean {
  let queryIndex = 0;

  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
    }

    if (queryIndex === query.length) {
      return true;
    }
  }

  return false;
}

function getTicketMatchDetails(
  query: string,
  ticket: Pick<TicketSearchCandidate, 'ticketKey' | 'title'>
): MatchDetails | null {
  if (!query) {
    return {
      score: DEFAULT_TICKET_SCORE,
      rank: 0,
      matchType: 'substring',
    };
  }

  const key = ticket.ticketKey.toLowerCase();
  const title = ticket.title.toLowerCase();
  const combined = `${key} ${title}`;

  if (key === query) {
    return { score: 1000, rank: 0, matchType: 'exact-key' };
  }

  if (key.startsWith(query) || title.startsWith(query)) {
    return { score: 800, rank: 1, matchType: 'prefix' };
  }

  if (combined.includes(query)) {
    return { score: 600 - combined.indexOf(query), rank: 2, matchType: 'substring' };
  }

  if (isSubsequence(query, combined)) {
    return { score: 400, rank: 3, matchType: 'subsequence' };
  }

  return null;
}

function getDestinationScore(
  query: string,
  destination: Pick<ProjectNavigationDestination, 'label' | 'keywords'>
): number | null {
  if (!query) {
    return DEFAULT_DESTINATION_SCORE;
  }

  const label = destination.label.toLowerCase();
  const keywords = destination.keywords.map((keyword) => keyword.toLowerCase());
  const haystacks = [label, ...keywords];

  if (haystacks.some((value) => value === query)) {
    return 900;
  }

  if (haystacks.some((value) => value.startsWith(query))) {
    return 700;
  }

  if (haystacks.some((value) => value.includes(query))) {
    return 500;
  }

  if (haystacks.some((value) => isSubsequence(query, value))) {
    return 300;
  }

  return null;
}

export function getRankedDestinations(
  destinations: ProjectNavigationDestination[],
  query: string
): CommandPaletteDestinationResult[] {
  const normalizedQuery = normalizeQuery(query);
  const ranked: RankedDestinationResult[] = [];

  destinations.forEach((destination, index) => {
    const score = getDestinationScore(normalizedQuery, destination);

    if (score !== null) {
      ranked.push({
        id: `destination:${destination.id}`,
        type: 'destination',
        label: destination.label,
        description: destination.description,
        href: destination.href,
        matchScore: score,
        sortRank: index,
      });
    }
  });

  return ranked
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      return left.sortRank - right.sortRank;
    })
    .map(({ sortRank, ...result }) => result);
}

export function getRankedTickets(
  tickets: TicketSearchCandidate[],
  query: string,
  limit: number
): CommandPaletteTicketResult[] {
  const normalizedQuery = normalizeQuery(query);
  const ranked: RankedTicketResult[] = [];

  tickets.forEach((ticket) => {
    const match = getTicketMatchDetails(normalizedQuery, ticket);

    if (match) {
      ranked.push({
        id: `ticket:${ticket.id}`,
        type: 'ticket',
        label: ticket.title,
        description: `${ticket.ticketKey} • ${ticket.stage}`,
        href: `/projects/${ticket.projectId}/board?ticket=${ticket.ticketKey}&modal=open`,
        ticketKey: ticket.ticketKey,
        stage: ticket.stage,
        matchType: match.matchType,
        matchScore: match.score,
        sortRank: match.rank,
      });
    }
  });

  return ranked
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      if (left.sortRank !== right.sortRank) {
        return left.sortRank - right.sortRank;
      }

      return left.ticketKey.localeCompare(right.ticketKey);
    })
    .slice(0, limit)
    .map(({ sortRank, ...result }) => result);
}
