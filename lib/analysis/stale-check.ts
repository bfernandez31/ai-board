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
  return (
    normalize(ticket.title) !== normalize(snapshot.titleSnapshot) ||
    normalize(ticket.description) !== normalize(snapshot.descriptionSnapshot)
  );
}
