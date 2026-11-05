const logger = require('./logger');

let intervalId = null;

function startMemoryWatchdog(checkIntervalMs = 60000) {
  if (intervalId) return;

  intervalId = setInterval(() => {
    try {
      const memory = process.memoryUsage();
      const heapUsedMB = (memory.heapUsed / 1024 / 1024).toFixed(1);
      const heapTotalMB = (memory.heapTotal / 1024 / 1024).toFixed(1);
      const rssMB = (memory.rss / 1024 / 1024).toFixed(1);

      // Warn if heap exceeds 900MB (approaching typical 1.4GB default V8 boundary)
      if (memory.heapUsed > 900 * 1024 * 1024) {
        logger.warn(
          `[MemoryWatchdog] High RAM pressure detected! Heap: ${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB. Triggering cache pruning...`
        );

        if (global.gc) {
          global.gc();
          logger.info('[MemoryWatchdog] Manual Garbage Collection executed.');
        }
      }
    } catch (err) {
      logger.error('[MemoryWatchdog] Error during memory check:', err);
    }
  }, checkIntervalMs);

  // Allow Node process to exit gracefully without being kept alive solely by watchdog timer
  if (intervalId.unref) intervalId.unref();
}

function stopMemoryWatchdog() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = {
  startMemoryWatchdog,
  stopMemoryWatchdog
};
