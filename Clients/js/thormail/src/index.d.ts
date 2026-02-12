/**
 * ThorMail JavaScript Client - TypeScript Definitions
 * @module @thormail/client
 */

export interface RetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in milliseconds for exponential backoff (default: 1000) */
    baseDelay?: number;
    /** Maximum delay between retries in milliseconds (default: 30000) */
    maxDelay?: number;
    /** HTTP status codes to retry on (default: [429, 500, 502, 503, 504]) */
    retryOn?: number[];
    /** Whether to retry on timeout errors (default: true) */
    retryOnTimeout?: boolean;
    /** Whether to retry on network errors (default: true) */
    retryOnNetwork?: boolean;
}

export interface ThorMailConfig {
    /** Base URL of the ThorMail API (e.g., 'https://api.thormail.io') */
    baseUrl: string;
    /** Your workspace identifier */
    workspaceId: string | number;
    /** Your workspace API key */
    apiKey: string;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Enable debug logging (default: false) */
    debug?: boolean;
    /** Retry configuration */
    retry?: RetryConfig;
}

export interface RateLimitInfo {
    /** Maximum requests allowed per window */
    limit: number;
    /** Requests remaining in current window */
    remaining: number;
    /** Unix timestamp when the limit resets */
    reset: number;
}

export type MessageType = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';

export interface MessagePayload {
    /** Recipient identifier (email, phone, device token, etc.) */
    to: string;
    /** Message type (default: 'EMAIL') */
    type?: MessageType;
    /** Message subject/title */
    subject?: string;
    /** Message body content (HTML, text, or JSON) */
    body?: string;
    /** Template variables and adapter-specific options */
    data?: Record<string, unknown>;
    /** ID of a stored template to use */
    templateId?: string;
    /** ISO 8601 timestamp for scheduled delivery */
    scheduledAt?: string;
    /** Specific adapter to route to (bypasses rule engine) */
    adapterId?: string;
    /** Idempotency key for safe retries */
    idempotencyKey?: string;
}

export interface RecipientObject {
    /** Recipient identifier (email, phone, etc.) */
    to: string;
    /** Per-recipient variables/data */
    data?: Record<string, unknown>;
}

export interface BatchPayload {
    /** List of recipient objects (max 500) */
    emails: RecipientObject[];
    /** Shared message type (default: 'EMAIL') */
    type?: MessageType;
    /** Shared subject/title */
    subject?: string;
    /** Shared body content */
    body?: string;
    /** Shared template ID */
    templateId?: string;
    /** Shared ISO 8601 schedule time */
    scheduledAt?: string;
    /** Shared adapter identifier */
    adapterId?: string;
}

export interface SendResponse {
    /** Queue ID of the message */
    id: number;
    /** Status of the request */
    status: 'accepted';
}

export interface BatchResponse {
    /** Status of the request */
    status: 'accepted';
    /** Number of messages queued */
    count: number;
    /** Array of queue IDs for each message */
    ids: number[];
}

/**
 * Custom error class for ThorMail API errors
 */
export class ThorMailError extends Error {
    /** Error name */
    name: 'ThorMailError';
    /** HTTP status code */
    statusCode: number;
    /** Error code from API */
    code: string | null;
    /** Seconds to wait before retry (for 429 errors) */
    retryAfter: number | null;
    /** Additional error details */
    details: any | null;
    /** Timestamp of the error */
    timestamp: string;

    constructor(
        message: string,
        statusCode: number,
        code?: string | null,
        retryAfter?: number | null,
        details?: any | null
    );

    /** Check if the error is a rate limit error (429) */
    isRateLimited(): boolean;
    /** Check if the error is a validation error (400) */
    isValidationError(): boolean;
    /** Check if the error is an authentication error (401) */
    isAuthError(): boolean;
    /** Check if the error is forbidden (403) */
    isForbidden(): boolean;
    /** Check if the error indicates suppression */
    isSuppressed(): boolean;
    /** Check if the resource was not found (404) */
    isNotFound(): boolean;
    /** Check if the error is a server error (5xx) */
    isServerError(): boolean;
    /** Check if the error is due to a timeout */
    isTimeout(): boolean;
    /** Check if the error is due to network failure */
    isNetworkError(): boolean;
    /** Check if the error is retryable */
    isRetryable(): boolean;
    /** Returns JSON representation of the error */
    toJSON(): object;
}

/**
 * ThorMail API Client
 */
export class ThorMailClient {
    /** Base URL of the API */
    readonly baseUrl: string;
    /** Workspace ID */
    readonly workspaceId: string;
    /** Request timeout in milliseconds */
    timeout: number;
    /** Debug mode enabled */
    debug: boolean;
    /** Retry configuration */
    readonly retryConfig: Required<RetryConfig>;

    /**
     * Creates a new ThorMail client instance
     * @param config - Client configuration
     */
    constructor(config: ThorMailConfig);

    /**
     * Send a single message
     * @param payload - Message payload
     * @returns Response with queue ID
     * @throws ThorMailError If the request fails
     */
    send(payload: MessagePayload): Promise<SendResponse>;

    /**
     * Send multiple messages in a single batch
     * @param payload - Batch payload
     * @returns Response with queue IDs
     * @throws ThorMailError If the request fails
     */
    sendBatch(payload: BatchPayload): Promise<BatchResponse>;

    /**
     * Updates the client configuration
     * @param config - Configuration to update
     */
    configure(config: Partial<ThorMailConfig>): this;

    /**
     * Get the last known rate limit information
     */
    getRateLimitInfo(): RateLimitInfo | null;

    /**
     * Check if the client is likely to be rate limited (remaining <= 10)
     */
    isNearRateLimit(): boolean;

    /**
     * Get client configuration (without sensitive data)
     */
    getConfig(): Omit<ThorMailConfig, 'apiKey'>;
}

/**
 * Factory function to create a ThorMail client
 * @param config - Client configuration
 * @returns ThorMail client instance
 */
export function createClient(config: ThorMailConfig): ThorMailClient;

declare const _default: {
    ThorMailClient: typeof ThorMailClient;
    ThorMailError: typeof ThorMailError;
    createClient: typeof createClient;
};

export default _default;
