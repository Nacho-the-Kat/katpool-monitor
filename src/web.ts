import express from 'express';
import fs from 'fs';
import path from 'path';
import { getBalances, getTotals, getPaymentsByWallet, getPayments, getBlockDetails, getBalanceByWallet, getKASPayoutForLast48H, getNachoPaymentsGroupedByWallet, getTotalKASPayoutForLast24H } from './db'; // Import the new function
import { getCurrentPoolHashRate, getBlocks, getLastBlockDetails } from './prom';
import *  as constants from './constants';

const app = express();
const port = 9301;

// Existing API endpoints
app.get('/balance', async (req, res) => {
  const balances = await getBalances('balance');
  res.json({ balance: balances });
});

// New API endpoint to retrieve balances by wallet_address
app.get('/balance/:wallet_address', async (req, res) => {
  const walletAddress = req.params.wallet_address;
  try {
    const balances = await getBalanceByWallet(walletAddress, 'miners_balance'); // Use the function from db.ts
    res.json({ balance: balances });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving payments');
  }
});

app.get('/total', async (req, res) => {
  const totals = await getTotals();
  res.json({ total: totals });
});

app.get('/config', (req, res) => {
  const configPath = path.resolve('./config/received_config.json');
  if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, 'utf-8');
    res.status(200).json(JSON.parse(configData));
  } else {
    res.status(404).send('Config file not found.');
  }
});

app.get('/api/miningPoolStats', async (req, res) => {
  try {
    const configPath = path.resolve('./config/received_config.json');
    let poolFee, url, advertise_image, minPay, blocks, lastBlockDetails, lastblock, lastblocktime;
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const configJson = JSON.parse(configData)
      poolFee = configJson?.treasury?.fee;
      url = configJson?.hostname;
      advertise_image = configJson?.advertise_image_link;
      minPay = configJson?.thresholdAmount! / constants.KAStoSompi;
    }

    const current_hashRate = await getCurrentPoolHashRate();
    blocks = await getBlocks();
    lastBlockDetails = await getLastBlockDetails()

    if (lastBlockDetails) {
      lastblock = lastBlockDetails.lastblock
      lastblocktime = lastBlockDetails.lastblocktime
    }
    url = url || constants.pool_url;
    poolFee = poolFee || constants.pool_fee;
    advertise_image = advertise_image || constants.advertise_image_link; 

    // Add miner_reward to each block
    const blockdetails = await getBlockDetails();
    const blocksWithRewards = (blocks || []).flatMap(block => {
      const matchingDetail = blockdetails.find(
        (detail: { mined_block_hash: string; miner_reward: string }) =>
          detail.mined_block_hash === block.block_hash
      );

      if(matchingDetail?.reward_block_hash) {
        return {
          ...block,
          reward_block_hash: matchingDetail.reward_block_hash,
          miner_reward: matchingDetail.miner_reward || '0',
        };
      }

      return []; // don't include, if reward_block_hash is not found
    });
    
    const poolLevelData = {
      coin_mined : constants.coin_mined,
      pool_name : constants.pool_name,
      url,
      poolFee,
      current_hashRate,
      blocks: blocksWithRewards,
      advertise_image_link : constants.advertise_image_link,
      minPay,
      country : constants.country,
      feeType : constants.feeType,
      lastblock,
      lastblocktime
    } 
    res.status(200).send(poolLevelData)
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving mining pool stats')
  }
})

app.get('/api/pool/payouts', async (req, res) => {
  try{
    const payments = await getPayments('payments');
    res.status(200).json(payments)
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving payments')
  }
})

app.get('/api/pool/48hKASpayouts', async (req, res) => {
  try{
    const payments = await getKASPayoutForLast48H();
    res.status(200).json(payments)
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving 48H KAS payments for Top miners')
  }
})

// New API endpoint to retrieve payments by wallet_address
app.get('/api/payments/:wallet_address', async (req, res) => {
  const walletAddress = req.params.wallet_address;
  try {
    const payments = await getPaymentsByWallet(walletAddress, 'payments'); // Use the function from db.ts
    res.status(200).json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving payments');
  }
});

app.get('/api/pool/nacho_payouts', async (req, res) => {
  try{
    const payments = await getPayments('nacho_payments');
    res.status(200).json(payments)
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving payments')
  }
})

// New API endpoint to retrieve payments by wallet_address
app.get('/api/nacho_payments/:wallet_address', async (req, res) => {
  const walletAddress = req.params.wallet_address;
  try {
    const payments = await getPaymentsByWallet(walletAddress, 'nacho_payments'); // Use the function from db.ts
    res.status(200).json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving payments');
  }
});

app.get('/api/blockdetails', async (req, res) => {
  try{
    const blockdetails = await getBlockDetails();
    res.status(200).json(blockdetails)
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving blockdetails')
  }
})

app.get('/api/pool/48hNACHOPayouts', async (req, res) => {
  try {
    const nacho_payments = await getNachoPaymentsGroupedByWallet();
    const formatted = nacho_payments.reduce((acc: { [key: string]: number }, item: { wallet_address: string, total_nacho_payment_amount: string }) => {
      acc[item.wallet_address] = Number(item.total_nacho_payment_amount);
      return acc;
    }, {});
    res.status(200).json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving 48hNACHOPayouts');
  }
});

app.get('/api/pool/24hTotalKASPayouts', async (req, res) => {
  try{
    const payments = await getTotalKASPayoutForLast24H();
    res.status(200).json(payments)
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving getTotalKASPayoutForLast24H')
  }
})

// Start the server
export function startServer() {
  app.listen(port, () => {
    console.log(`API Server running at http://localhost:${port}`);
  });
}
