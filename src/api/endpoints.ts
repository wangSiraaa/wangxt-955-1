import { apiGet, apiPost, apiPut } from './client.js';
import type {
  LoginRequest,
  LoginResponse,
  User,
  Presale,
  Order,
  Notification,
  Arrival,
  PresaleDetailWithRelations,
  OrderDetailWithRelations,
  OrderTransfer,
  WaitlistEntry,
  RefundRecord,
  CreatePresaleRequest,
  CreateOrderRequest,
  ArrivalRequest,
  TransferOrderRequest,
  WaitlistConfirmRequest,
  ProcessRefundRequest,
} from '../../shared/types.js';

export const authApi = {
  login: (data: LoginRequest) => apiPost<LoginResponse>('/auth/login', data),
  getCurrentUser: () => apiGet<{ user: User }>('/auth/me'),
};

export const presaleApi = {
  getAll: () => apiGet<Presale[]>('/presales'),
  getById: (id: string) => apiGet<Presale>(`/presales/${id}`),
  getDetail: (id: string) => apiGet<PresaleDetailWithRelations>(`/presales/${id}/detail`),
  create: (data: CreatePresaleRequest) => apiPost<Presale>('/presales', data),
  update: (id: string, data: Partial<Presale>) => apiPut<Presale>(`/presales/${id}`, data),
  checkAvailability: (presaleId: string, quantity: number) =>
    apiGet<{ available: boolean; message: string; presale: Presale | null; canWaitlist: boolean }>(
      '/presales/check-availability',
      { presaleId, quantity }
    ),
  markAsArrived: (id: string) => apiPut<Presale>(`/presales/${id}/arrived`),
};

export const orderApi = {
  getAll: () => apiGet<Order[]>('/orders'),
  getById: (id: string) => apiGet<Order>(`/orders/${id}`),
  getDetail: (id: string) => apiGet<OrderDetailWithRelations>(`/orders/${id}/detail`),
  getByPickupCode: (code: string) => apiGet<Order>(`/orders/pickup-code/${code}`),
  getByPresaleId: (presaleId: string) => apiGet<Order[]>(`/orders/presale/${presaleId}`),
  create: (data: CreateOrderRequest) => apiPost<Order>('/orders', data),
  pay: (id: string) => apiPut<Order>(`/orders/${id}/pay`),
  payWithWaitlist: (id: string) =>
    apiPut<{ order: Order; waitlisted: boolean }>(`/orders/${id}/pay-waitlist`),
  pickup: (pickupCode: string) => apiPost<Order>('/orders/pickup', { pickupCode }),
  releaseExpired: () => apiPost<{ count: number; orders: Order[] }>('/orders/release-expired'),
  expireOrder: (id: string) => apiPut<Order>(`/orders/${id}/expire`),

  requestTransfer: (orderId: string, data: { toUserId: string; remark?: string }) =>
    apiPost<OrderTransfer>(`/orders/${orderId}/transfer`, data),
  acceptTransfer: (transferId: string) =>
    apiPost<{ transfer: OrderTransfer; order: Order | null }>('/orders/transfer/accept', {
      transferId,
    }),
  rejectTransfer: (transferId: string, remark?: string) =>
    apiPost<OrderTransfer | null>('/orders/transfer/reject', { transferId, remark }),
  cancelTransfer: (transferId: string) =>
    apiPost<OrderTransfer | null>('/orders/transfer/cancel', { transferId }),
  getPendingTransfers: () => apiGet<OrderTransfer[]>('/orders/transfers/pending'),

  getWaitlist: () => apiGet<WaitlistEntry[]>('/orders/waitlist'),
  confirmWaitlist: (waitlistId: string, confirm: boolean) =>
    apiPost<{ entry: WaitlistEntry | null; order?: Order | null }>('/orders/waitlist/confirm', {
      waitlistId,
      confirm,
    }),

  createRefund: (orderId: string, data: Omit<ProcessRefundRequest, 'orderId'>) =>
    apiPost<RefundRecord>(`/orders/${orderId}/refund`, data),
};

export const arrivalApi = {
  getAll: () => apiGet<Arrival[]>('/arrivals'),
  getById: (id: string) => apiGet<Arrival>(`/arrivals/${id}`),
  getByPresaleId: (presaleId: string) => apiGet<Arrival[]>(`/arrivals/presale/${presaleId}`),
  create: (data: ArrivalRequest) =>
    apiPost<{
      arrival: Arrival;
      allocatedOrders: Order[];
      waitlistNotifications: WaitlistEntry[];
      batchNo: number;
    }>('/arrivals', data),
};

export const notificationApi = {
  getAll: () => apiGet<Notification[]>('/notifications'),
  getMy: () => apiGet<Notification[]>('/notifications/my'),
  getUnreadCount: () => apiGet<{ unreadCount: number }>('/notifications/unread-count'),
  markAsRead: (id: string) => apiPut<Notification>(`/notifications/${id}/read`),
  markAllAsRead: () => apiPost<{ message: string }>('/notifications/mark-all-read'),
};
