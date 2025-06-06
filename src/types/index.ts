import { Decimal } from 'decimal.js';

export type BalancesResponse = Record<string, Record<string, Decimal>>;
export type BalanceByWalletResponse = Record<string, Record<string, [Decimal, Decimal]>>;
export type TotalResponse = Record<string, Decimal>;

export type BlockDetail = {
  mined_block_hash: string;
  miner_id: string;
  pool_address: string;
  reward_block_hash: string;
  wallet: string;
  daa_score: number;
  miner_reward: number;
  timestamp: Date;
};

export type Payment = {
  wallet_address: string[];
  amount: number;
  timestamp: Date;
  transaction_hash: string;
};

export type NachoPayment = {
  wallet_address: string;
  nacho_amount: number;
  timestamp: Date;
  transaction_hash: string;
};

export type KASPayout48H = {
  wallet_address: string;
  amount: number;
  timeStamp: Date;
};

export type NachoPaymentGrouped = {
  wallet_address: string;
  total_nacho_payment_amount: number;
};
