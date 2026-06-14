export type UserRole = 'clerk' | 'member' | 'warehouse';

export type MemberLevel = 'normal' | 'silver' | 'gold' | 'diamond';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  phone: string;
  memberLevel?: MemberLevel;
}

export const memberLevelConfig: Record<MemberLevel, { name: string; priority: number; discount: number; color: string }> = {
  normal: { name: '普通会员', priority: 4, discount: 1, color: 'text-gray-600' },
  silver: { name: '白银会员', priority: 3, discount: 0.95, color: 'text-slate-500' },
  gold: { name: '黄金会员', priority: 2, discount: 0.9, color: 'text-amber-600' },
  diamond: { name: '钻石会员', priority: 1, discount: 0.85, color: 'text-cyan-600' },
};

export type PresaleStatus = 'draft' | 'upcoming' | 'active' | 'ended' | 'partial_arrived' | 'arrived';

export interface Presale {
  id: string;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookIsbn: string;
  price: number;
  deposit: number;
  totalStock: number;
  lockedStock: number;
  soldStock: number;
  waitlistedStock: number;
  presaleStartTime: string;
  presaleEndTime: string;
  balanceDeadline: string;
  pickupDeadline: string;
  status: PresaleStatus;
  description: string;
  memberLevelLimit?: Record<MemberLevel, number>;
  createdAt: string;
  updatedAt: string;
}

export type PresaleBatchStatus = 'pending' | 'arrived' | 'cancelled';

export interface PresaleBatch {
  id: string;
  presaleId: string;
  batchNo: number;
  expectedArrivalDate: string;
  quantity: number;
  arrivedQuantity: number;
  status: PresaleBatchStatus;
  remark: string;
  createdAt: string;
  arrivedAt?: string;
}

export type OrderTransferStatus = 'pending' | 'completed' | 'cancelled';

export interface OrderTransfer {
  id: string;
  orderId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: OrderTransferStatus;
  createdAt: string;
  completedAt?: string;
  remark?: string;
}

export type WaitlistStatus = 'waiting' | 'notified' | 'confirmed' | 'refunded' | 'expired';

export interface WaitlistEntry {
  id: string;
  presaleId: string;
  orderId: string;
  userId: string;
  userName: string;
  quantity: number;
  depositAmount: number;
  status: WaitlistStatus;
  priority: number;
  memberLevel: MemberLevel;
  depositTime: string;
  notifiedAt?: string;
  confirmedAt?: string;
  createdAt: string;
}

export type RefundType = 'deposit' | 'full' | 'partial';
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type RefundReason = 'out_of_stock' | 'user_cancel' | 'expired' | 'transfer' | 'other';

export interface RefundRecord {
  id: string;
  orderId: string;
  presaleId: string;
  userId: string;
  userName: string;
  refundType: RefundType;
  refundStatus: RefundStatus;
  refundReason: RefundReason;
  refundAmount: number;
  depositAmount: number;
  remark?: string;
  operatorId?: string;
  createdAt: string;
  completedAt?: string;
}

export type StockReleaseReason = 'expired' | 'refunded' | 'transfer' | 'waitlist_refund';

export interface StockReleaseRecord {
  id: string;
  orderId: string;
  presaleId: string;
  userId: string;
  userName: string;
  quantity: number;
  depositAmount: number;
  depositRetained: boolean;
  reason: StockReleaseReason;
  remark?: string;
  operatorId?: string;
  createdAt: string;
}

export type ArrivalAllocationResult = {
  notifiedOrders: Order[];
  waitlistEntries: WaitlistEntry[];
  insufficientCount: number;
};

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'partial_refunded';
export type PickupStatus = 'pending' | 'ready' | 'picked' | 'expired' | 'waitlisted' | 'transferred';

export interface Order {
  id: string;
  orderNo: string;
  presaleId: string;
  userId: string;
  userName: string;
  memberLevel?: MemberLevel;
  quantity: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  pickupStatus: PickupStatus;
  pickupCode: string;
  batchNo?: number;
  paidAt: string | null;
  pickupAt: string | null;
  createdAt: string;
  transferredFrom?: string;
  transferredTo?: string;
}

export interface Arrival {
  id: string;
  presaleId: string;
  batchNo: number;
  quantity: number;
  arrivedAt: string;
  operatorId: string;
  remark: string;
}

export type NotificationType = 'pickup_ready' | 'expiry_warning' | 'order_cancelled' | 'waitlist_notify' | 'transfer_request' | 'transfer_completed' | 'batch_arrived' | 'refund_completed' | 'balance_due';

export interface Notification {
  id: string;
  orderId: string;
  userId: string;
  type: NotificationType;
  content: string;
  sentAt: string;
  readAt: string | null;
  relatedId?: string;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface LoginRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateOrderRequest {
  presaleId: string;
  quantity: number;
}

export interface CreatePresaleRequest {
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookIsbn: string;
  price: number;
  deposit: number;
  totalStock: number;
  presaleStartTime: string;
  presaleEndTime: string;
  balanceDeadline: string;
  pickupDeadline: string;
  description: string;
  batches?: Array<{
    expectedArrivalDate: string;
    quantity: number;
    remark?: string;
  }>;
  memberLevelLimit?: Record<MemberLevel, number>;
}

export interface ArrivalRequest {
  presaleId: string;
  batchNo?: number;
  quantity: number;
  remark: string;
}

export interface TransferOrderRequest {
  orderId: string;
  toUserId: string;
  remark?: string;
}

export interface AcceptTransferRequest {
  transferId: string;
  accept: boolean;
}

export interface WaitlistConfirmRequest {
  waitlistId: string;
  confirm: boolean;
}

export interface ProcessRefundRequest {
  orderId: string;
  refundType: RefundType;
  refundReason: RefundReason;
  refundAmount: number;
  remark?: string;
}

export interface PresaleDetailWithRelations extends Presale {
  batches: PresaleBatch[];
  arrivals: Arrival[];
  refunds: RefundRecord[];
  stockReleases: StockReleaseRecord[];
  waitlistCount: number;
  orderCount: number;
}

export interface OrderDetailWithRelations extends Order {
  presale?: Presale;
  transfers: OrderTransfer[];
  refunds: RefundRecord[];
  waitlist?: WaitlistEntry;
  stockReleases: StockReleaseRecord[];
  notifications: Notification[];
}
