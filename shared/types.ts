export type UserRole = 'clerk' | 'member' | 'warehouse';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  phone: string;
}

export type PresaleStatus = 'draft' | 'upcoming' | 'active' | 'ended' | 'arrived';

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
  presaleStartTime: string;
  presaleEndTime: string;
  pickupDeadline: string;
  status: PresaleStatus;
  description: string;
  createdAt: string;
}

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PickupStatus = 'pending' | 'ready' | 'picked' | 'expired';

export interface Order {
  id: string;
  orderNo: string;
  presaleId: string;
  userId: string;
  userName: string;
  quantity: number;
  totalAmount: number;
  depositAmount: number;
  paymentStatus: PaymentStatus;
  pickupStatus: PickupStatus;
  pickupCode: string;
  paidAt: string | null;
  pickupAt: string | null;
  createdAt: string;
}

export interface Arrival {
  id: string;
  presaleId: string;
  quantity: number;
  arrivedAt: string;
  operatorId: string;
  remark: string;
}

export type NotificationType = 'pickup_ready' | 'expiry_warning' | 'order_cancelled';

export interface Notification {
  id: string;
  orderId: string;
  userId: string;
  type: NotificationType;
  content: string;
  sentAt: string;
  readAt: string | null;
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
  pickupDeadline: string;
  description: string;
}

export interface ArrivalRequest {
  presaleId: string;
  quantity: number;
  remark: string;
}
