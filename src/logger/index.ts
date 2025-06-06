import axios from 'axios';
import dotenv from 'dotenv';
import rTracer from 'cls-rtracer';

dotenv.config();

const { DATADOG_SECRET, DATADOG_LOG_URL } = process.env;

interface LogContext {
  [key: string]: any;
  requestId?: string;
}

const sendLog = async (level: string, message: string, context: LogContext = {}) => {
  // backgroud servers startMetricsServer, updateMetrics does not have requestId
  // not all logs will be sent to Datadog, only logs with requestId will be sent
  const requestId: string = String(context.requestId || rTracer.id());
  if (requestId && requestId !== 'undefined') {
    const logData = {
      ddsource: 'nodejs',
      service: 'katpool-monitor',
      level,
      message,
      requestId: requestId.toString(),
      ...context,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(DATADOG_LOG_URL!, logData, {
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': DATADOG_SECRET!,
        },
      });
    } catch (error) {
      throw new Error(`Failed to send log to Datadog: ${error}`);
    }
  } else {
    console.log(message, context);
  }
};

const logger = {
  info: (message: string, context?: LogContext) => sendLog('info', message, context),
  error: (message: string, context?: LogContext) => sendLog('error', message, context),
  warn: (message: string, context?: LogContext) => sendLog('warn', message, context),
};

export default logger;
