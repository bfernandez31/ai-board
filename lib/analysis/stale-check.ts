interface TicketTextLike {
  title: string;
  description: string;
}

interface SnapshotLike {
  titleSnapshot: string;
  descriptionSnapshot: string;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function isStale(ticket: TicketTextLike, snapshot: SnapshotLike): boolean {
  const current = normalize(`${ticket.title}\n${ticket.description}`);
  const snap = normalize(`${snapshot.titleSnapshot}\n${snapshot.descriptionSnapshot}`);
  return current !== snap;
}
