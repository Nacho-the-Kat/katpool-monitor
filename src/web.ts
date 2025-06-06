import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  getBalances,
  getTotals,
  getPaymentsByWallet,
  getPayments,
  getBlockDetails,
  getBalanceByWallet,
  getKASPayoutForLast48H,
  getNachoPaymentsGroupedByWallet,
  getTotalKASPayoutForLast24H,
  getBlockCount,
} from './db';
import { getCurrentPoolHashRate } from './utils';
import * as constants from './constants';
import { apiLimiter } from './utils';
import { errorHandler, asyncHandler } from './middleware/errorHandler';
import { DatabaseError, NotFoundError, ConfigError } from './errors/customErrors';
import logger from './logger';
import rTracer from 'cls-rtracer';
import { requestContextMiddleware } from './middleware/requestContext';

const app = express();
const port = 9301;

// Apply request context middleware first
app.use(rTracer.expressMiddleware());
// This middleware check header x-request-id from frontend and rewrite requestId in rTracer
app.use(requestContextMiddleware);

// Apply rate limiting to all routes
app.use(apiLimiter);

// Add basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Add response logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  let responseBody: unknown;

  res.send = function (body: unknown) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  const requestId = String(rTracer.id());
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
      ms: duration,
      statusCode: res.statusCode,
      response: responseBody,
      requestId,
    });
  });
  next();
});

// Existing API endpoints
app.get(
  '/balance',
  asyncHandler(async (req, res) => {
    const balances = await getBalances('balance');
    if (!balances) {
      throw new DatabaseError('Failed to retrieve balances');
    }
    res.json({ balance: balances });
  })
);

// New API endpoint to retrieve balances by wallet_address
app.get(
  '/balance/:wallet_address',
  asyncHandler(async (req, res) => {
    const walletAddress = req.params.wallet_address;
    const balances = await getBalanceByWallet(walletAddress, 'miners_balance');
    if (!balances) {
      throw new NotFoundError(`No balance found for wallet: ${walletAddress}`);
    }
    res.json({ balance: balances });
  })
);

app.get(
  '/total',
  asyncHandler(async (req, res) => {
    const totals = await getTotals();
    if (!totals) {
      throw new DatabaseError('Failed to retrieve totals');
    }
    res.json({ total: totals });
  })
);

app.get(
  '/config',
  asyncHandler(async (req, res) => {
    const configPath = path.resolve('./config/received_config.json');
    if (!fs.existsSync(configPath)) {
      throw new ConfigError('Config file not found');
    }
    const configData = fs.readFileSync(configPath, 'utf-8');
    res.status(200).json(JSON.parse(configData));
  })
);

app.get(
  '/api/miningPoolStats',
  asyncHandler(async (req, res) => {
    const configPath = path.resolve('./config/received_config.json');
    let poolFee, url, minPay, lastblock, lastblocktime;

    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const configJson = JSON.parse(configData);
      poolFee = configJson?.treasury?.fee;
      url = configJson?.hostname;
      minPay = configJson?.thresholdAmount
        ? configJson.thresholdAmount / constants.KAStoSompi
        : undefined;
    }

    const current_hashRate = await getCurrentPoolHashRate();
    const blocks = await getBlockDetails();
    const [lastBlockDetails] = await getBlockDetails(1, 1);

    if (lastBlockDetails) {
      lastblock = lastBlockDetails.mined_block_hash;
      lastblocktime = lastBlockDetails.timestamp;
    }
    url = url || constants.pool_url;
    poolFee = poolFee || constants.pool_fee;

    const poolLevelData = {
      coin_mined: constants.coin_mined,
      pool_name: constants.pool_name,
      url,
      poolFee,
      current_hashRate,
      blocks,
      advertise_image_link: constants.advertise_image_link,
      minPay,
      country: constants.country,
      feeType: constants.feeType,
      lastblock,
      lastblocktime,
    };
    res.status(200).send(poolLevelData);
  })
);

app.get(
  '/api/pool/payouts',
  asyncHandler(async (req, res) => {
    const payments = await getPayments('payments');
    if (!payments) {
      throw new DatabaseError('Failed to retrieve payments');
    }
    res.status(200).json(payments);
  })
);

app.get(
  '/api/pool/48hKASpayouts',
  asyncHandler(async (req, res) => {
    const payments = await getKASPayoutForLast48H();
    if (!payments) {
      throw new DatabaseError('Failed to retrieve 48H KAS payments');
    }
    res.status(200).json(payments);
  })
);

app.get(
  '/api/payments/:wallet_address',
  asyncHandler(async (req, res) => {
    const walletAddress = req.params.wallet_address;
    const payments = await getPaymentsByWallet(walletAddress, 'payments');
    if (!payments) {
      throw new NotFoundError(`No payments found for wallet: ${walletAddress}`);
    }
    res.status(200).json(payments);
  })
);

app.get(
  '/api/pool/nacho_payouts',
  asyncHandler(async (req, res) => {
    const payments = await getPayments('nacho_payments');
    if (!payments) {
      throw new DatabaseError('Failed to retrieve nacho payments');
    }
    res.status(200).json(payments);
  })
);

app.get(
  '/api/nacho_payments/:wallet_address',
  asyncHandler(async (req, res) => {
    const walletAddress = req.params.wallet_address;
    const payments = await getPaymentsByWallet(walletAddress, 'nacho_payments');
    if (!payments) {
      throw new NotFoundError(`No nacho payments found for wallet: ${walletAddress}`);
    }
    res.status(200).json(payments);
  })
);

// TODO: need to change nginx config for this route
app.get(
  '/api/pool/blockdetails',
  asyncHandler(async (req, res) => {
    const currentPage = req.query.currentPage ? parseInt(req.query.currentPage as string) : 1;
    const perPage = req.query.perPage ? parseInt(req.query.perPage as string) : 100;

    const blockdetails = await getBlockDetails(currentPage, perPage);
    if (!blockdetails) {
      throw new DatabaseError('Failed to retrieve block details');
    }

    const totalCount = await getBlockCount();
    res.status(200).json({
      data: blockdetails,
      pagination: {
        currentPage,
        perPage,
        totalCount,
        totalPages: totalCount ? Math.ceil(totalCount / perPage) : undefined,
      },
    });
  })
);

app.get(
  '/api/pool/48hNACHOPayouts',
  asyncHandler(async (req, res) => {
    const nacho_payments = await getNachoPaymentsGroupedByWallet();
    if (!nacho_payments) {
      throw new DatabaseError('Failed to retrieve 48h NACHO payouts');
    }
    const formatted = nacho_payments.reduce<{ [key: string]: number }>((acc, item) => {
      acc[item.wallet_address] = item.total_nacho_payment_amount;
      return acc;
    }, {});
    res.status(200).json(formatted);
  })
);

app.get(
  '/api/pool/24hTotalKASPayouts',
  asyncHandler(async (req, res) => {
    const payments = await getTotalKASPayoutForLast24H();
    if (!payments) {
      throw new DatabaseError('Failed to retrieve 24h total KAS payouts');
    }
    res.status(200).json(payments);
  })
);

// Add error handling middleware at the end of all routes
app.use(errorHandler);

// Start the server
export function startServer() {
  const server = app.listen(port, () => {
    logger.info(`API Server running at http://localhost:${port}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err: Error) => {
    logger.error('Unhandled Promise Rejection:', err);
    // Close server & exit process
    server.close(() => process.exit(1));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception:', err);
    // Close server & exit process
    server.close(() => process.exit(1));
  });

  return server;
}
