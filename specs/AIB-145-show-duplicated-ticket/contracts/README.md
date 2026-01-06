# API Contracts: Show Duplicated Ticket

**No new API contracts required.**

This feature is a client-side cache management fix. The existing duplicate endpoint contract (from AIB-106) remains unchanged.

## Existing Endpoint Reference

**POST** `/api/projects/{projectId}/tickets/{ticketId}/duplicate`

**Response** (201 Created):
```typescript
interface DuplicateTicketResponse {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: 'INBOX';
  version: 1;
  projectId: number;
  branch: null;
  previewUrl: null;
  autoMode: false;
  workflowType: 'FULL';
  attachments: Attachment[];
  clarificationPolicy: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The client-side fix uses this existing response to populate the optimistic cache update.
