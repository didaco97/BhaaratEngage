export interface WorkerLogMetadata {
  readonly [key: string]: unknown;
}

export interface WorkerLogger {
  info(metadata: WorkerLogMetadata, message: string): void;
  warn(metadata: WorkerLogMetadata, message: string): void;
  error(metadata: WorkerLogMetadata, message: string): void;
}

export interface QueuePublishRequest<TPayload> {
  readonly name: string;
  readonly payload: TPayload;
  readonly runAt?: string;
  readonly dedupeKey?: string;
  readonly attempts?: number;
}

export interface PublishedQueueJob<TPayload> extends QueuePublishRequest<TPayload> {
  readonly id: string;
}

export interface QueueMessage<TPayload> extends PublishedQueueJob<TPayload> {
  readonly attemptsMade: number;
  readonly enqueuedAt: string;
}

export type QueueHandler<TPayload, TResult> = (job: QueueMessage<TPayload>) => Promise<TResult>;

export interface QueuePublisher<TPayload> {
  readonly queueName: string;
  publish(request: QueuePublishRequest<TPayload>): Promise<PublishedQueueJob<TPayload>>;
}

export interface QueueConsumer<TPayload, TResult> {
  readonly queueName: string;
  start(handler: QueueHandler<TPayload, TResult>): Promise<void>;
  stop(): Promise<void>;
}

export interface WorkerModule {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const noopWorkerLogger: WorkerLogger = {
  info() {},
  warn() {},
  error() {},
};
