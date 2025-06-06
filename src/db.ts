import { Pool } from 'pg';
import { Decimal } from 'decimal.js';
import dotenv from 'dotenv';
import logger from './logger/index';
import {
  BlockDetail,
  TotalResponse,
  Payment,
  NachoPayment,
  KASPayout48H,
  BalanceByWalletResponse,
  NachoPaymentGrouped,
  BalancesResponse,
} from './types';

dotenv.config();

// Check if DATABASE_URL is configured
if (!process.env.DATABASE_URL) {
  logger.error('DB: Error - DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

logger.info('DB: Connecting DB');

export async function getBalances(column: string): Promise<BalancesResponse> {
  const client = await pool.connect();
  logger.info('DB: getting balances');
  try {
    const res = await client.query(
      `SELECT miner_id, wallet, ${column} as balance FROM miners_balance`
    );
    const balances: Record<string, Record<string, Decimal>> = {};

    res.rows.forEach((row) => {
      const wallet = row.wallet;
      const miner_id = row.miner_id;
      const balance = new Decimal(row.balance);
      if (!balances[wallet]) {
        balances[wallet] = {};
      }
      balances[wallet][miner_id] = balance;
    });

    return balances;
  } finally {
    client.release();
  }
}

export async function getBlockDetails(
  currentPage?: number | null,
  perPage?: number | null
): Promise<BlockDetail[]> {
  const client = await pool.connect();
  logger.info('DB: getting block details');

  try {
    let query = `
      SELECT mined_block_hash, miner_id, pool_address, reward_block_hash, wallet, daa_score, miner_reward, timestamp
      FROM block_details
      ORDER BY timestamp DESC
    `;
    let values: any[] = [];

    // Apply pagination only if both values are provided and are valid numbers
    if (currentPage != null && perPage != null && currentPage > 0 && perPage > 0) {
      const offset = (currentPage - 1) * perPage;
      query += ' LIMIT $1 OFFSET $2';
      values = [perPage, offset];
    }

    const res = await client.query(query, values);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function getBlockCount(): Promise<number> {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT COUNT(*) FROM block_details');
    return res.rows[0]?.count;
  } finally {
    client.release();
  }
}

export async function getTotals(): Promise<TotalResponse> {
  const client = await pool.connect();
  logger.info('DB: getting totals');
  try {
    const res = await client.query('SELECT address, total FROM wallet_total');
    const totals: Record<string, Decimal> = {};

    res.rows.forEach((row) => {
      const address = row.address;
      const total = new Decimal(row.total);
      totals[address] = total;
    });

    return totals;
  } finally {
    client.release();
  }
}

export async function getPayments(tableName: string): Promise<Payment[] | NachoPayment[]> {
  const client = await pool.connect();
  const amount = tableName == 'nacho_payments' ? 'nacho_amount' : 'amount';
  try {
    let res;
    if (tableName == 'payments') {
      res = await client.query(
        `SELECT ARRAY['']::text[] AS wallet_address, SUM(${amount}) AS ${amount}, MAX(timestamp) AS timestamp, transaction_hash FROM ${tableName} GROUP BY transaction_hash ORDER BY timestamp DESC LIMIT 500`
      );
    } else {
      res = await client.query(
        `SELECT wallet_address, ${amount}, timestamp, transaction_hash FROM ${tableName} ORDER BY timestamp DESC LIMIT 500`
      );
    }

    return res.rows;
  } finally {
    client.release();
  }
}

// New function to retrieve payments by wallet_address
export async function getPaymentsByWallet(walletAddress: string, tableName: string) {
  const client = await pool.connect();
  logger.info(`DB: getting payments for wallet_address: ${walletAddress}`);
  try {
    const res = await client.query(
      `SELECT * FROM ${tableName} WHERE $1 = ANY(wallet_address) ORDER BY timestamp DESC`,
      [walletAddress]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

// New function to retrieve KAS payments by wallet_address for 48H
export async function getKASPayoutForLast48H(): Promise<KASPayout48H[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT wallet_address, SUM(amount) AS amount, MIN(timeStamp) as timeStamp FROM payments WHERE timestamp >= NOW() - INTERVAL '48 hours' GROUP BY wallet_address ORDER BY amount DESC;`
    );
    return res.rows;
  } finally {
    client.release();
  }
}

// Function to retrieve total KAS payouts for all wallets in the last 24 hours
export async function getTotalKASPayoutForLast24H(): Promise<number> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        SUM(amount) AS total_amount 
      FROM payments 
      WHERE timestamp >= NOW() - INTERVAL '24 hours';
    `);
    return res.rows[0]?.total_amount || 0;
  } finally {
    client.release();
  }
}

// Retrieve nacho payments grouped by wallet_address
export async function getNachoPaymentsGroupedByWallet(): Promise<NachoPaymentGrouped[]> {
  const client = await pool.connect();
  logger.info('DB: getting top miners');
  try {
    // Query SQL for payments and nacho totals
    const result = await client.query(`
      SELECT 
        n.wallet_address,
        SUM(n.nacho_amount) AS total_nacho_payment_amount
      FROM public.nacho_payments n
      WHERE n.timestamp >= NOW() - INTERVAL '48 hours'
      GROUP BY n.wallet_address
      ORDER BY total_nacho_payment_amount DESC;
    `);

    return result.rows;
  } finally {
    client.release();
  }
}

// New function to retrieve Balance by wallet_address
export async function getBalanceByWallet(
  wallet: string,
  tableName: string
): Promise<BalanceByWalletResponse> {
  const client = await pool.connect();
  logger.info(`DB: getting Balance for wallet_address: ${wallet}`);
  try {
    const res = await client.query(`SELECT * FROM ${tableName} WHERE wallet = $1`, [wallet]);
    const balances: BalanceByWalletResponse = {};

    res.rows.forEach((row) => {
      const wallet = row.wallet;
      const miner_id = row.miner_id;
      const balance = new Decimal(row.balance);
      const nacho_rebate_kas = new Decimal(row.nacho_rebate_kas);

      if (!balances[wallet]) {
        balances[wallet] = {};
      }

      // Store balance as an array with 2 elements
      balances[wallet][miner_id] = [balance, nacho_rebate_kas];
    });

    return balances;
  } finally {
    client.release();
  }
}
