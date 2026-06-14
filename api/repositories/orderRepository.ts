import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { Order, PaymentStatus, PickupStatus, MemberLevel } from '../../shared/types.js';
import { toCamelCase, generateOrderNo, generatePickupCode, generateId } from '../utils/helpers.js';

interface OrderRow {
  id: string;
  order_no: string;
  presale_id: string;
  user_id: string;
  user_name: string;
  member_level?: MemberLevel;
  quantity: number;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  payment_status: PaymentStatus;
  pickup_status: PickupStatus;
  pickup_code: string;
  batch_no?: number;
  paid_at: string | null;
  pickup_at: string | null;
  transferred_from?: string;
  transferred_to?: string;
  created_at: string;
}

export async function findAll(): Promise<Order[]> {
  const rows = await allQuery<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
  return rows.map(row => toCamelCase<Order>(row as unknown as Record<string, unknown>));
}

export async function findByUserId(userId: string): Promise<Order[]> {
  const rows = await allQuery<OrderRow>(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => toCamelCase<Order>(row as unknown as Record<string, unknown>));
}

export async function findByPresaleId(presaleId: string): Promise<Order[]> {
  const rows = await allQuery<OrderRow>(
    'SELECT * FROM orders WHERE presale_id = ? ORDER BY created_at DESC',
    [presaleId]
  );
  return rows.map(row => toCamelCase<Order>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<Order | null> {
  const row = await getQuery<OrderRow>('SELECT * FROM orders WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<Order>(row as unknown as Record<string, unknown>);
}

export async function findByPickupCode(pickupCode: string): Promise<Order | null> {
  const row = await getQuery<OrderRow>(
    'SELECT * FROM orders WHERE pickup_code = ?',
    [pickupCode.toUpperCase()]
  );
  if (!row) return null;
  return toCamelCase<Order>(row as unknown as Record<string, unknown>);
}

export async function create(orderData: {
  presaleId: string;
  userId: string;
  userName: string;
  memberLevel?: MemberLevel;
  quantity: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
}): Promise<Order> {
  const id = generateId('o_');
  const orderNo = generateOrderNo();
  const pickupCode = generatePickupCode();

  await runQuery(
    `INSERT INTO orders (
      id, order_no, presale_id, user_id, user_name, member_level, quantity, 
      total_amount, deposit_amount, balance_amount, payment_status, pickup_status, pickup_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'pending', ?)`,
    [
      id,
      orderNo,
      orderData.presaleId,
      orderData.userId,
      orderData.userName,
      orderData.memberLevel || 'normal',
      orderData.quantity,
      orderData.totalAmount,
      orderData.depositAmount,
      orderData.balanceAmount,
      pickupCode,
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create order');
  return created;
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  paidAt?: string
): Promise<Order | null> {
  if (paidAt) {
    await runQuery(
      'UPDATE orders SET payment_status = ?, paid_at = ? WHERE id = ?',
      [paymentStatus, paidAt, orderId]
    );
  } else {
    await runQuery(
      'UPDATE orders SET payment_status = ? WHERE id = ?',
      [paymentStatus, orderId]
    );
  }
  return findById(orderId);
}

export async function expireOrder(
  orderId: string
): Promise<Order | null> {
  await runQuery(
    `UPDATE orders 
     SET pickup_status = 'expired', payment_status = 'refunded'
     WHERE id = ?`,
    [orderId]
  );
  return findById(orderId);
}

export async function updatePickupStatus(
  orderId: string,
  pickupStatus: PickupStatus,
  pickupAt?: string
): Promise<Order | null> {
  if (pickupAt) {
    await runQuery(
      'UPDATE orders SET pickup_status = ?, pickup_at = ? WHERE id = ?',
      [pickupStatus, pickupAt, orderId]
    );
  } else {
    await runQuery(
      'UPDATE orders SET pickup_status = ? WHERE id = ?',
      [pickupStatus, orderId]
    );
  }
  return findById(orderId);
}

export async function findExpiredOrders(deadline: string): Promise<Order[]> {
  const rows = await allQuery<OrderRow>(
    `SELECT o.* FROM orders o
     JOIN presales p ON o.presale_id = p.id
     WHERE o.payment_status = 'paid' 
       AND o.pickup_status IN ('pending', 'ready')
       AND p.pickup_deadline < ?`,
    [deadline]
  );
  return rows.map(row => toCamelCase<Order>(row as unknown as Record<string, unknown>));
}

export async function findReadyForPickupOrders(presaleId: string): Promise<Order[]> {
  const rows = await allQuery<OrderRow>(
    `SELECT * FROM orders 
     WHERE presale_id = ? 
       AND payment_status = 'paid' 
       AND pickup_status = 'pending'`,
    [presaleId]
  );
  return rows.map(row => toCamelCase<Order>(row as unknown as Record<string, unknown>));
}

export async function findPaidOrdersByPresaleIdSorted(presaleId: string): Promise<Order[]> {
  const rows = await allQuery<OrderRow>(
    `SELECT o.* FROM orders o
     JOIN users u ON o.user_id = u.id
     WHERE o.presale_id = ? 
       AND o.payment_status = 'paid' 
       AND o.pickup_status = 'pending'
     ORDER BY 
       CASE u.member_level 
         WHEN 'diamond' THEN 1 
         WHEN 'gold' THEN 2 
         WHEN 'silver' THEN 3 
         ELSE 4 
       END ASC,
       o.paid_at ASC`,
    [presaleId]
  );
  return rows.map(row => toCamelCase<Order>(row as unknown as Record<string, unknown>));
}

export async function transferOrder(
  orderId: string,
  toUserId: string,
  toUserName: string,
  fromUserId: string
): Promise<Order | null> {
  await runQuery(
    `UPDATE orders 
     SET user_id = ?, user_name = ?, transferred_from = ?, transferred_to = ?, pickup_status = 'transferred'
     WHERE id = ?`,
    [toUserId, toUserName, fromUserId, toUserId, orderId]
  );
  return findById(orderId);
}

export async function updateBatchNo(
  orderId: string,
  batchNo: number
): Promise<Order | null> {
  await runQuery('UPDATE orders SET batch_no = ? WHERE id = ?', [batchNo, orderId]);
  return findById(orderId);
}

export async function updatePickupStatusAndBatch(
  orderId: string,
  pickupStatus: PickupStatus,
  batchNo: number
): Promise<Order | null> {
  await runQuery(
    'UPDATE orders SET pickup_status = ?, batch_no = ? WHERE id = ?',
    [pickupStatus, batchNo, orderId]
  );
  return findById(orderId);
}
