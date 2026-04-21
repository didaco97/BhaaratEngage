export const WORKER_QUEUE_NAMES = {
  dialer: "dialer-queue",
  journey: "journey-queue",
} as const;

export type WorkerQueueName = (typeof WORKER_QUEUE_NAMES)[keyof typeof WORKER_QUEUE_NAMES];

export function buildWorkerQueueKey(prefix: string, queueName: WorkerQueueName) {
  const normalizedPrefix = prefix.trim();
  return normalizedPrefix ? `${normalizedPrefix}-${queueName}` : queueName;
}
