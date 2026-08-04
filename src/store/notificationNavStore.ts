import { create } from 'zustand';

type NotificationNavState = {
  openSupport: boolean;
  ticketId: string | null;
  requestOpenSupport: (ticketId?: string | null) => void;
  clearOpenSupport: () => void;
};

export const useNotificationNavStore = create<NotificationNavState>(set => ({
  openSupport: false,
  ticketId: null,
  requestOpenSupport: ticketId =>
    set({ openSupport: true, ticketId: ticketId || null }),
  clearOpenSupport: () => set({ openSupport: false, ticketId: null }),
}));
