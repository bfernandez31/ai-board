import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TicketWithVersion } from '@/lib/types';
import { useTicketByKey } from '@/app/lib/hooks/queries/useTickets';

type ModalTab = 'details' | 'comments' | 'files';

interface UseUrlTicketModalArgs {
  projectId: number;
  allTickets: TicketWithVersion[];
}

interface UseUrlTicketModalResult {
  selectedTicketId: number | null;
  setSelectedTicketId: (id: number | null) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  modalInitialTab: ModalTab;
  setModalInitialTab: (tab: ModalTab) => void;
  pendingTicketKey: string | null;
  setPendingTicketKey: (key: string | null) => void;
  fetchedTicket: TicketWithVersion | null | undefined;
  handleModalClose: (open: boolean) => void;
  handleTicketClick: (ticket: TicketWithVersion) => void;
  lastProcessedTicketRef: React.MutableRefObject<string | null>;
}

/**
 * Synchronizes the ticket detail modal with URL params and handles closed-ticket
 * lookup via useTicketByKey (AIB-80 + AIB-156). The URL drives modal open/close
 * and tab selection; the modal owns its own open/close state otherwise.
 */
export function useUrlTicketModal({
  projectId,
  allTickets,
}: UseUrlTicketModalArgs): UseUrlTicketModalResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<ModalTab>('details');
  const [pendingTicketKey, setPendingTicketKey] = useState<string | null>(null);
  const lastProcessedTicketRef = useRef<string | null>(null);

  // AIB-156: Fetch ticket by key for closed tickets not in board state
  const {
    data: fetchedTicket,
    isSuccess: fetchedTicketSuccess,
    isError: fetchedTicketError,
  } = useTicketByKey(projectId, pendingTicketKey, !!pendingTicketKey);

  // AIB-80 + AIB-156: Parse URL params to auto-open modal with specific tab
  // Format: ?ticket=AIB-123&modal=open&tab=comments#comment-123
  useEffect(() => {
    if (!searchParams) return;

    const shouldOpenModal = searchParams.get('modal') === 'open';
    const tabParam = searchParams.get('tab');
    const ticketKey = searchParams.get('ticket');

    if (!shouldOpenModal || !ticketKey) return;
    if (lastProcessedTicketRef.current === ticketKey) return;

    const initialTab =
      tabParam === 'comments' || tabParam === 'files' ? tabParam : 'details';

    const ticket = allTickets.find(t => t.ticketKey === ticketKey);

    if (ticket) {
      lastProcessedTicketRef.current = ticketKey;
      router.replace(pathname, { scroll: false });
      setSelectedTicketId(ticket.id);
      setModalInitialTab(initialTab);
      setIsModalOpen(true);
    } else {
      lastProcessedTicketRef.current = ticketKey;
      router.replace(pathname, { scroll: false });
      setPendingTicketKey(ticketKey);
      setModalInitialTab(initialTab);
    }
  }, [searchParams, allTickets, router, pathname]);

  // AIB-156: Handle fetched ticket for closed tickets not in board state
  useEffect(() => {
    if (!pendingTicketKey) return;
    if (isModalOpen && selectedTicketId === fetchedTicket?.id) return;
    if (!fetchedTicketSuccess && !fetchedTicketError) return;

    if (fetchedTicketSuccess && fetchedTicket) {
      // Note: Don't clear pendingTicketKey here - selectedTicket needs fetchedTicket
      // It will be cleared when modal closes via handleModalClose
      setSelectedTicketId(fetchedTicket.id);
      setIsModalOpen(true);
    } else if (fetchedTicketSuccess && fetchedTicket === null) {
      setPendingTicketKey(null);
    } else if (fetchedTicketError) {
      console.error('Failed to fetch ticket by key:', pendingTicketKey);
      setPendingTicketKey(null);
    }
  }, [fetchedTicket, fetchedTicketSuccess, fetchedTicketError, pendingTicketKey, isModalOpen, selectedTicketId]);

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTicketId(null);
      lastProcessedTicketRef.current = null;
      setPendingTicketKey(null);
    }
  };

  const handleTicketClick = (ticket: TicketWithVersion) => {
    setSelectedTicketId(ticket.id);
    setIsModalOpen(true);
    setModalInitialTab(ticket.stage === 'VERIFY' ? 'comments' : 'details');
  };

  return {
    selectedTicketId,
    setSelectedTicketId,
    isModalOpen,
    setIsModalOpen,
    modalInitialTab,
    setModalInitialTab,
    pendingTicketKey,
    setPendingTicketKey,
    fetchedTicket,
    handleModalClose,
    handleTicketClick,
    lastProcessedTicketRef,
  };
}
