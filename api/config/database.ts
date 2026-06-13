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
        presale_start_time DATETIME NOT NULL,
        presale_end_time DATETIME NOT NULL,
        pickup_deadline DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'ended', 'arrived')),
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        presale_id TEXT NOT NULL REFERENCES presales(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        user_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        total_amount DECIMAL(10,2) NOT NULL,
        deposit_amount DECIMAL(10,2) NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
        pickup_status TEXT NOT NULL DEFAULT 'pending' CHECK (pickup_status IN ('pending', 'ready', 'picked', 'expired')),
        pickup_code TEXT UNIQUE,
        paid_at DATETIME,
        pickup_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS arrivals (
        id TEXT PRIMARY KEY,
        presale_id TEXT NOT NULL REFERENCES presales(id),
        quantity INTEGER NOT NULL,
        arrived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        operator_id TEXT NOT NULL REFERENCES users(id),
        remark TEXT
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL CHECK (type IN ('pickup_ready', 'expiry_warning', 'order_cancelled')),
        content TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME
      )
    `);

    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_presale_id ON orders(presale_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON orders(pickup_code)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_presales_status ON presales(status)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');

    await seedInitialData();

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

async function seedInitialData(): Promise<void> {
  const userCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM users');
  
  if (userCount && userCount.count === 0) {
    const passwordHash = await bcrypt.hash('password', 10);
    
    const users = [
      { id: 'u_clerk', username: 'clerk001', role: 'clerk', name: '李店员', phone: '13800138001' },
      { id: 'u_member', username: 'member001', role: 'member', name: '王会员', phone: '13800138002' },
      { id: 'u_warehouse', username: 'warehouse001', role: 'warehouse', name: '张仓管', phone: '13800138003' },
    ];

    for (const user of users) {
      await runQuery(
        'INSERT INTO users (id, username, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.username, passwordHash, user.role, user.name, user.phone]
      );
    }

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
        presaleStartTime: dayjs().subtract(20, 'day').format('YYYY-MM-DD HH:mm:ss'),
        presaleEndTime: dayjs().subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss'),
        pickupDeadline: dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        status: 'arrived',
        description: '中国科幻里程碑之作，雨果奖获奖作品',
      },
    ];

    for (const p of presales) {
      await runQuery(
        `INSERT INTO presales (id, book_title, book_author, book_cover, book_isbn, price, deposit, 
          total_stock, locked_stock, presale_start_time, presale_end_time, pickup_deadline, status, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.bookTitle, p.bookAuthor, p.bookCover, p.bookIsbn, p.price, p.deposit,
         p.totalStock, (p as any).lockedStock || 0, p.presaleStartTime, p.presaleEndTime, p.pickupDeadline, p.status, p.description]
      );
    }

    const orderCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM orders');
    if (orderCount && orderCount.count === 0) {
      const orders = [
        {
          id: 'o_001',
          orderNo: 'BS20260610001',
          presaleId: 'p_003',
          userId: 'u_member',
          userName: '王会员',
          quantity: 2,
          totalAmount: 136.00,
          depositAmount: 50.00,
          paymentStatus: 'paid',
          pickupStatus: 'ready',
          pickupCode: '3T7K9P',
          paidAt: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        },
      ];

      for (const o of orders) {
        await runQuery(
          `INSERT INTO orders (id, order_no, presale_id, user_id, user_name, quantity, 
            total_amount, deposit_amount, payment_status, pickup_status, pickup_code, paid_at, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.id, o.orderNo, o.presaleId, o.userId, o.userName, o.quantity,
           o.totalAmount, o.depositAmount, o.paymentStatus, o.pickupStatus, o.pickupCode, o.paidAt,
           dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss')]
        );
      }
    }

    console.log('Initial data seeded successfully');
  }
}

export { db, runQuery, getQuery, allQuery };
