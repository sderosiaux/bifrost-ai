const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: any[]) => {
    // Only show debug logs in development
    if (isDevelopment) {
      console.log(...args);
    }
  },
  // Special logger for model/token debugging that shows even in production
  model: (...args: any[]) => {
    console.log(...args);
  },
  log: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};