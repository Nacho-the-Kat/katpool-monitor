import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const PROMETHEUS_URL = process.env.MONITORING || 'http://kas.katpool.xyz:8080';

// Centralized rate limiter for all routes
export const apiLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export function stringifyHashrate(ghs: number): string {
  const unitStrings = ['M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  let unit = unitStrings[0];
  let hr = ghs * 1000; // Default to MH/s

  for (const u of unitStrings) {
    if (hr < 1000) {
      unit = u;
      break;
    }
    hr /= 1000;
  }

  return `${hr.toFixed(2)}${unit}H/s`;
}

export async function getCurrentPoolHashRate() {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query`;
    const query = `pool_hash_rate_GHps`;
    const response = await axios.get(url, {
      params: { query },
    });
    const data = response.data;
    const results = data.data?.result;
    if (results && results.length > 0) {
      let hashRate;
      results.forEach((result: any) => {
        hashRate = stringifyHashrate(result?.value[1]);
      });
      return hashRate;
    } else {
      console.log(`No results found for the query - ${query}.`);
    }
  } catch (err) {
    console.error('Error querying pool hash rate:', err);
  }
}
