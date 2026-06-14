import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/bookstore.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function runQuery(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getQuery<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

function allQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

async function initializeDatabase(): Promise<void> {
  try {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('clerk', 'member', 'warehouse')),
        name TEXT NOT NULL,
        phone TEXT,
        member_level TEXT DEFAULT 'normal' CHECK (member_level IN ('normal', 'silver', 'gold', 'diamond')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS presales (
        id TEXT PRIMARY KEY,
        book_title TEXT NOT NULL,
        book_author TEXT NOT NULL,
        book_cover TEXT,
        book_isbn TEXT,
        price DECIMAL(10,2) NOT NULL,
        deposit DECIMAL(10,2) NOT NULL,
        total_stock INTEGER NOT NULL DEFAULT 0,
        locked_stock INTEGER NOT NULL DEFAULT 0,
        sold_stock INTEGER NOT NULL DEFAULT 0,
        waitlisted_stock INTEGER NOT NULL DEFAULT 0,
        presale_start_time DATETIME NOT NULL,
        presale_end_time DATETIME NOT NULL,
        balance_deadline DATETIME NOT NULL,
        pickup_deadline DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'ended', 'partial_arrived', 'arrived')),
        description TEXT,
        member_level_limit TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        presale_id TEXT NOT NULL REFERENCES presales(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        user_name TEXT NOT NULL,
        member_level TEXT DEFAULT 'normal' CHECK (member_level IN ('normal', 'silver', 'gold', 'diamond')),
        quantity INTEGER NOT NULL DEFAULT 1,
        total_amount DECIMAL(10,2) NOT NULL,
        deposit_amount DECIMAL(10,2) NOT NULL,
        balance_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial_refunded')),
        pickup_status TEXT NOT NULL DEFAULT 'pending' CHECK (pickup_status IN ('pending', 'ready', 'picked', 'expired', 'waitlisted', 'transferred')),
        pickup_code TEXT UNIQUE,
        batch_no INTEGER,
        paid_at DATETIME,
        pickup_at DATETIME,
        transferred_from TEXT,
        transferred_to TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS arrivals (
        id TEXT PRIMARY KEY,
        presale_id TEXT NOT NULL REFERENCES presales(id),
        batch_id TEXT REFERENCES presale_batches(id),
        batch_no INTEGER NOT NULL DEFAULT 1,
        quantity INTEGER NOT NULL,
        arrived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        operator_id TEXT NOT NULL REFERENCES users(id),
        remark TEXT
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS presale_batches (
        id TEXT PRIMARY KEY,
        presale_id TEXT NOT NULL REFERENCES presales(id),
        batch_no INTEGER NOT NULL,
        expected_arrival_date DATE NOT NULL,
        quantity INTEGER NOT NULL,
        arrived_quantity INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'cancelled')),
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        arrived_at DATETIME
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS order_transfers (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        from_user_id TEXT NOT NULL REFERENCES users(id),
        from_user_name TEXT NOT NULL,
        to_user_id TEXT NOT NULL REFERENCES users(id),
        to_user_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS waitlist_entries (
        id TEXT PRIMARY KEY,
        presale_id TEXT NOT NULL REFERENCES presales(id),
        order_id TEXT NOT NULL REFERENCES orders(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        user_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        deposit_amount DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'confirmed', 'refunded', 'expired')),
        priority INTEGER NOT NULL,
        member_level TEXT NOT NULL CHECK (member_level IN ('normal', 'silver', 'gold', 'diamond')),
        deposit_time DATETIME NOT NULL,
        notified_at DATETIME,
        confirmed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS refund_records (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        presale_id TEXT NOT NULL REFERENCES presales(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        user_name TEXT NOT NULL,
        refund_type TEXT NOT NULL CHECK (refund_type IN ('deposit', 'full', 'partial')),
        refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed')),
        refund_reason TEXT NOT NULL CHECK (refund_reason IN ('out_of_stock', 'user_cancel', 'expired', 'transfer', 'other')),
        refund_amount DECIMAL(10,2) NOT NULL,
        deposit_amount DECIMAL(10,2) NOT NULL,
        remark TEXT,
        operator_id TEXT REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS stock_release_records (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        presale_id TEXT NOT NULL REFERENCES presales(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        user_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        deposit_amount DECIMAL(10,2) NOT NULL,
        deposit_retained BOOLEAN NOT NULL DEFAULT 0,
        reason TEXT NOT NULL CHECK (reason IN ('expired', 'refunded', 'transfer', 'waitlist_refund')),
        remark TEXT,
        operator_id TEXT REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL CHECK (type IN ('pickup_ready', 'expiry_warning', 'order_cancelled', 'waitlist_notify', 'transfer_request', 'transfer_completed', 'batch_arrived', 'refund_completed', 'balance_due')),
        content TEXT NOT NULL,
        related_id TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME
      )
    `);

    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_presale_id ON orders(presale_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON orders(pickup_code)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_presales_status ON presales(status)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_presale_batches_presale_id ON presale_batches(presale_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_order_transfers_order_id ON order_transfers(order_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_order_transfers_to_user_id ON order_transfers(to_user_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_waitlist_entries_presale_id ON waitlist_entries(presale_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_waitlist_entries_user_id ON waitlist_entries(user_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_refund_records_order_id ON refund_records(order_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_stock_release_records_order_id ON stock_release_records(order_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_stock_release_records_presale_id ON stock_release_records(presale_id)');

    await migrateDatabase();

    await seedInitialData();

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const rows = await allQuery(`PRAGMA table_info(${tableName})`);
    return rows.some((row: any) => row.name === columnName);
  } catch {
    return false;
  }
}

async function addColumnIfNotExists(
  tableName: string,
  columnName: string,
  columnDefinition: string
): Promise<void> {
  const exists = await columnExists(tableName, columnName);
  if (!exists) {
    console.log(`Adding column ${columnName} to table ${tableName}...`);
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function migrateDatabase(): Promise<void> {
  console.log('Running database migrations...');

  await addColumnIfNotExists('users', 'member_level', "TEXT DEFAULT 'normal'");

  await addColumnIfNotExists('presales', 'waitlisted_stock', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfNotExists('presales', 'balance_deadline', 'DATETIME');
  await addColumnIfNotExists('presales', 'member_level_limit', 'TEXT');

  await addColumnIfNotExists('orders', 'member_level', "TEXT DEFAULT 'normal'");
  await addColumnIfNotExists('orders', 'balance_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0');
  await addColumnIfNotExists('orders', 'batch_no', 'INTEGER');
  await addColumnIfNotExists('orders', 'transferred_from', 'TEXT');
  await addColumnIfNotExists('orders', 'transferred_to', 'TEXT');

  await addColumnIfNotExists('arrivals', 'batch_no', 'INTEGER NOT NULL DEFAULT 1');

  await addColumnIfNotExists('notifications', 'related_id', 'TEXT');

  console.log('Database migrations completed');
}

async function seedInitialData(): Promise<void> {
  const passwordHash = await bcrypt.hash('password', 10);
  
  // 用户表
  const userCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    const users = [
      { id: 'u_clerk', username: 'clerk001', role: 'clerk', name: '李店员', phone: '13800138001', memberLevel: 'normal' },
      { id: 'u_member', username: 'member001', role: 'member', name: '王会员', phone: '13800138002', memberLevel: 'gold' },
      { id: 'u_warehouse', username: 'warehouse001', role: 'warehouse', name: '张仓管', phone: '13800138003', memberLevel: 'normal' },
      { id: 'u_member2', username: 'member002', role: 'member', name: '赵会员', phone: '13800138004', memberLevel: 'silver' },
      { id: 'u_member3', username: 'member003', role: 'member', name: '孙钻石', phone: '13800138005', memberLevel: 'diamond' },
      { id: 'u_member4', username: 'member004', role: 'member', name: '周会员', phone: '13800138006', memberLevel: 'normal' },
    ];

    for (const user of users) {
      await runQuery(
        'INSERT INTO users (id, username, password_hash, role, name, phone, member_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, user.username, passwordHash, user.role, user.name, user.phone, user.memberLevel]
      );
    }
    console.log('Users seeded');
  }

  // 预售表
  const presaleCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM presales');
  if (!presaleCount || presaleCount.count === 0) {
    const presales = [
      {
        id: 'p_001',
        bookTitle: '百年孤独',
        bookAuthor: '加西亚·马尔克斯',
        bookCover: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=book%20cover%20of%20One%20Hundred%20Years%20of%20Solitude&image_size=portrait_4_3',
        bookIsbn: '9787544253994',
        price: 59.80,
        deposit: 20.00,
        totalStock: 100,
        presaleStartTime: dayjs().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        presaleEndTime: dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
        balanceDeadline: dayjs().add(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        pickupDeadline: dayjs().add(14, 'day').format('YYYY-MM-DD HH:mm:ss'),
        status: 'upcoming',
        description: '诺贝尔文学奖代表作，魔幻现实主义经典',
      },
      {
        id: 'p_002',
        bookTitle: '活着',
        bookAuthor: '余华',
        bookCover: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=book%20cover%20of%20To%20Live%20by%20Yu%20Hua&image_size=portrait_4_3',
        bookIsbn: '9787506365437',
        price: 39.00,
        deposit: 15.00,
        totalStock: 50,
        presaleStartTime: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        presaleEndTime: dayjs().add(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
        balanceDeadline: dayjs().add(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
        pickupDeadline: dayjs().add(12, 'day').format('YYYY-MM-DD HH:mm:ss'),
        status: 'active',
        description: '余华代表作，讲述一个人和他的命运之间的友情',
      },
      {
        id: 'p_003',
        bookTitle: '三体',
        bookAuthor: '刘慈欣',
        bookCover: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=book%20cover%20of%20The%20Three%20Body%20Problem%20sci-fi&image_size=portrait_4_3',
        bookIsbn: '9787536692930',
        price: 68.00,
        deposit: 25.00,
        totalStock: 80,
        lockedStock: 2,
        waitlistedStock: 3,
        presaleStartTime: dayjs().subtract(20, 'day').format('YYYY-MM-DD HH:mm:ss'),
        presaleEndTime: dayjs().subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss'),
        balanceDeadline: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        pickupDeadline: dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        status: 'partial_arrived',
        description: '中国科幻里程碑之作，雨果奖获奖作品。因出版社延期，分两批到货。',
      },
    ];

    for (const p of presales) {
      await runQuery(
        `INSERT INTO presales (id, book_title, book_author, book_cover, book_isbn, price, deposit, 
          total_stock, locked_stock, sold_stock, waitlisted_stock, presale_start_time, presale_end_time, 
          balance_deadline, pickup_deadline, status, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.bookTitle, p.bookAuthor, p.bookCover, p.bookIsbn, p.price, p.deposit,
         p.totalStock, (p as any).lockedStock || 0, (p as any).soldStock || 0, (p as any).waitlistedStock || 0, 
         p.presaleStartTime, p.presaleEndTime, p.balanceDeadline, p.pickupDeadline, p.status, p.description]
      );
    }
    console.log('Presales seeded');
  }

  // 订单表
  const orderCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM orders');
  if (!orderCount || orderCount.count === 0) {
    const orders = [
        {
          id: 'o_001',
          orderNo: 'BS20260610001',
          presaleId: 'p_003',
          userId: 'u_member',
          userName: '王会员',
          memberLevel: 'gold',
          quantity: 2,
          totalAmount: 136.00,
          depositAmount: 50.00,
          balanceAmount: 86.00,
          paymentStatus: 'paid',
          pickupStatus: 'ready',
          pickupCode: '3T7K9P',
          batchNo: 1,
          paidAt: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        },
        {
          id: 'o_002',
          orderNo: 'BS20260610002',
          presaleId: 'p_003',
          userId: 'u_member2',
          userName: '赵会员',
          memberLevel: 'silver',
          quantity: 1,
          totalAmount: 68.00,
          depositAmount: 25.00,
          balanceAmount: 43.00,
          paymentStatus: 'paid',
          pickupStatus: 'waitlisted',
          pickupCode: '9X2M4N',
          paidAt: dayjs().subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'),
        },
        {
          id: 'o_003',
          orderNo: 'BS20260610003',
          presaleId: 'p_003',
          userId: 'u_member3',
          userName: '孙钻石',
          memberLevel: 'diamond',
          quantity: 1,
          totalAmount: 68.00,
          depositAmount: 25.00,
          balanceAmount: 43.00,
          paymentStatus: 'paid',
          pickupStatus: 'waitlisted',
          pickupCode: '5Q8L2W',
          paidAt: dayjs().subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
        },
        {
          id: 'o_004',
          orderNo: 'BS20260610004',
          presaleId: 'p_003',
          userId: 'u_member4',
          userName: '周会员',
          memberLevel: 'normal',
          quantity: 1,
          totalAmount: 68.00,
          depositAmount: 25.00,
          balanceAmount: 43.00,
          paymentStatus: 'refunded',
          pickupStatus: 'expired',
          pickupCode: '7P9S3V',
          batchNo: 1,
          paidAt: dayjs().subtract(12, 'day').format('YYYY-MM-DD HH:mm:ss'),
        },
      ];

      for (const o of orders) {
        await runQuery(
          `INSERT INTO orders (id, order_no, presale_id, user_id, user_name, member_level, quantity, 
            total_amount, deposit_amount, balance_amount, payment_status, pickup_status, pickup_code, batch_no, paid_at, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.id, o.orderNo, o.presaleId, o.userId, o.userName, o.memberLevel, o.quantity,
           o.totalAmount, o.depositAmount, o.balanceAmount, o.paymentStatus, o.pickupStatus, o.pickupCode, o.batchNo || null, o.paidAt,
           dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss')]
        );
      }
      console.log('Orders seeded');
    }

    // 预售批次表
    const batchCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM presale_batches');
    if (!batchCount || batchCount.count === 0) {
      const batches = [
        {
          id: 'b_001',
          presaleId: 'p_003',
          batchNo: 1,
          expectedArrivalDate: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
          quantity: 50,
          arrivedQuantity: 50,
          status: 'arrived',
          remark: '第一批到货',
          arrivedAt: dayjs().subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
        },
        {
          id: 'b_002',
          presaleId: 'p_003',
          batchNo: 2,
          expectedArrivalDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
          quantity: 30,
          arrivedQuantity: 0,
          status: 'pending',
          remark: '第二批因出版社延期，预计推迟到货',
        },
      ];

      for (const b of batches) {
        await runQuery(
          `INSERT INTO presale_batches (id, presale_id, batch_no, expected_arrival_date, quantity, 
            arrived_quantity, status, remark, arrived_at, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.presaleId, b.batchNo, b.expectedArrivalDate, b.quantity,
           b.arrivedQuantity, b.status, b.remark, b.arrivedAt || null,
           dayjs().subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss')]
        );
      }
      console.log('Batches seeded');
    }

  // 候补贴
  const waitlistCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM waitlist_entries');
  if (!waitlistCount || waitlistCount.count === 0) {
    const waitlistEntries = [
      {
        id: 'w_001',
        presaleId: 'p_003',
        orderId: 'o_002',
        userId: 'u_member2',
        userName: '赵会员',
        quantity: 1,
        depositAmount: 25.00,
        status: 'waiting',
        priority: 2,
        memberLevel: 'silver',
        depositTime: dayjs().subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        id: 'w_002',
        presaleId: 'p_003',
        orderId: 'o_003',
        userId: 'u_member3',
        userName: '孙钻石',
        quantity: 1,
        depositAmount: 25.00,
        status: 'waiting',
        priority: 1,
        memberLevel: 'diamond',
        depositTime: dayjs().subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
    ];

    for (const w of waitlistEntries) {
      await runQuery(
        `INSERT INTO waitlist_entries (id, presale_id, order_id, user_id, user_name, quantity, 
          deposit_amount, status, priority, member_level, deposit_time, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.id, w.presaleId, w.orderId, w.userId, w.userName, w.quantity,
         w.depositAmount, w.status, w.priority, w.memberLevel, w.depositTime,
         dayjs().subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss')]
      );
    }
    console.log('Waitlist entries seeded');
  }

  // 到货表
  const arrivalCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM arrivals');
  if (!arrivalCount || arrivalCount.count === 0) {
    const arrivals = [
      {
        id: 'a_001',
        presaleId: 'p_003',
        batchNo: 1,
        quantity: 50,
        operatorId: 'u_warehouse',
        remark: '第一批到货，共50册',
        arrivedAt: dayjs().subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
    ];

    for (const a of arrivals) {
      await runQuery(
        `INSERT INTO arrivals (id, presale_id, batch_no, quantity, arrived_at, operator_id, remark) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.presaleId, a.batchNo, a.quantity, a.arrivedAt, a.operatorId, a.remark]
      );
    }
    console.log('Arrivals seeded');
  }

  // 退款记录表
  const refundCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM refund_records');
  if (!refundCount || refundCount.count === 0) {
    const refundRecords = [
      {
        id: 'r_001',
        orderId: 'o_004',
        presaleId: 'p_003',
        userId: 'u_member4',
        userName: '周会员',
        refundType: 'full',
        refundStatus: 'completed',
        refundReason: 'expired',
        refundAmount: 25.00,
        depositAmount: 25.00,
        remark: '逾期未取书，退还订金',
        operatorId: 'u_clerk',
        createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        completedAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
    ];

    for (const r of refundRecords) {
      await runQuery(
        `INSERT INTO refund_records (id, order_id, presale_id, user_id, user_name, refund_type, 
          refund_status, refund_reason, refund_amount, deposit_amount, remark, operator_id, 
          created_at, completed_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.orderId, r.presaleId, r.userId, r.userName, r.refundType,
         r.refundStatus, r.refundReason, r.refundAmount, r.depositAmount,
         r.remark, r.operatorId, r.createdAt, r.completedAt]
      );
    }
    console.log('Refund records seeded');
  }

  // 库存释放记录表
  const releaseCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM stock_release_records');
  if (!releaseCount || releaseCount.count === 0) {
    const releaseRecords = [
      {
        id: 's_001',
        orderId: 'o_004',
        presaleId: 'p_003',
        userId: 'u_member4',
        userName: '周会员',
        quantity: 1,
        depositAmount: 25.00,
        depositRetained: false,
        reason: 'expired',
        remark: '逾期未取书，释放库存，订金已退还',
        operatorId: 'u_clerk',
        createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
    ];

    for (const s of releaseRecords) {
      await runQuery(
        `INSERT INTO stock_release_records (id, order_id, presale_id, user_id, user_name, quantity, 
          deposit_amount, deposit_retained, reason, remark, operator_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.orderId, s.presaleId, s.userId, s.userName, s.quantity,
         s.depositAmount, s.depositRetained ? 1 : 0, s.reason, s.remark,
         s.operatorId, s.createdAt]
      );
    }
    console.log('Stock release records seeded');
  }

  // 通知表
  const notificationCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM notifications');
  if (!notificationCount || notificationCount.count === 0) {
    const notifications = [
      {
        id: 'n_001',
        orderId: 'o_001',
        userId: 'u_member',
        type: 'pickup_ready',
        content: '您预订的《三体》第1批次已到货，请在取书截止日前凭取书码到店取书。',
        sentAt: dayjs().subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        id: 'n_002',
        orderId: 'o_004',
        userId: 'u_member4',
        type: 'expiry_warning',
        content: '您预订的《三体》取书期限将至，请尽快到店取书，逾期订单将自动取消。',
        sentAt: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        id: 'n_003',
        orderId: 'o_004',
        userId: 'u_member4',
        type: 'order_cancelled',
        content: '您预订的《三体》已逾期未取，订单已自动取消，订金已退还。',
        sentAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        id: 'n_004',
        orderId: 'o_004',
        userId: 'u_member4',
        type: 'refund_completed',
        content: '您的退款申请已处理，退款金额25.00元将在3个工作日内到账。',
        sentAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        id: 'n_005',
        orderId: 'o_001',
        userId: 'u_member',
        type: 'batch_arrived',
        content: '《三体》第1批次已到货50册，您的订单已分配到该批次。',
        sentAt: dayjs().subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
      },
    ];

    for (const n of notifications) {
      await runQuery(
        `INSERT INTO notifications (id, order_id, user_id, type, content, sent_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [n.id, n.orderId, n.userId, n.type, n.content, n.sentAt]
      );
    }
    console.log('Notifications seeded');
  }

  console.log('Initial data seeded successfully');
}

export { db, runQuery, getQuery, allQuery };
