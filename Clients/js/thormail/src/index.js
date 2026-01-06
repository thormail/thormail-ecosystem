/**
 * ThorMail JavaScript Client
 * Official lightweight client for ThorMail API
 * 
 * @module @thormail/client
 * @version 1.0.0
 * @license MIT
 * @author ThorMail Team
 * 
 * SERVER-SIDE USE ONLY (Node.js)
 * WARNING: Do not use in browser-based applications to prevent API key exposure.
 */

'use strict';

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} ThorMailConfig
 * @property {string} baseUrl - Base URL of the ThorMail API (e.g., 'https://api.thormail.io')
 * @property {string|number} workspaceId - Your workspace identifier
 * @property {string} apiKey - Your workspace API key
 * @property {number} [timeout=30000] - Request timeout in milliseconds
 * @property {RetryConfig} [retry] - Retry configuration
 * @property {boolean} [debug=false] - Enable debug logging
 */

/**
 * @typedef {Object} RetryConfig
 * @property {number} [maxRetries=3] - Maximum number of retry attempts
 * @property {number} [baseDelay=1000] - Base delay in milliseconds for exponential backoff
 * @property {number} [maxDelay=30000] - Maximum delay between retries in milliseconds
 * @property {number[]} [retryOn=[429, 500, 502, 503, 504]] - HTTP status codes to retry on
 * @property {boolean} [retryOnTimeout=true] - Whether to retry on timeout errors
 * @property {boolean} [retryOnNetwork=true] - Whether to retry on network errors
 */

/**
 * @typedef {Object} MessagePayload
 * @property {string} to - Recipient identifier (email, phone, device token, etc.)
 * @property {'EMAIL'|'SMS'|'PUSH'|'WEBHOOK'} [type='EMAIL'] - Message type
 * @property {string} [subject] - Message subject/title
 * @property {string} [body] - Message body content (HTML, text, or JSON)
 * @property {Object} [data] - Template variables and adapter-specific options
 * @property {string} [templateId] - ID of a stored template to use
 * @property {string} [scheduledAt] - ISO 8601 timestamp for scheduled delivery (max 3 days)
 * @property {string} [adapterId] - Specific adapter to route to (bypasses rule engine)
 */

/**
 * @typedef {Object} RecipientObject
 * @property {string} to - Recipient identifier
 * @property {Object} [data] - Per-recipient variables/data
 */

/**
 * @typedef {Object} BatchPayload
 * @property {RecipientObject[]} emails - List of recipient objects (max 500)
 * @property {'EMAIL'|'SMS'|'PUSH'|'WEBHOOK'} [type='EMAIL'] - Shared message type
 * @property {string} [subject] - Shared subject/title
 * @property {string} [body] - Shared body content
 * @property {string} [templateId] - Shared template ID
 * @property {string} [scheduledAt] - Shared ISO 8601 schedule time (max 30 days)
 * @property {string} [adapterId] - Shared adapter identifier
 */

/**
 * @typedef {Object} SendResponse
 * @property {number} id - Queue ID of the message
 * @property {'accepted'} status - Status of the request
 */

/**
 * @typedef {Object} BatchResponse
 * @property {'accepted'} status - Status of the request
 * @property {number} count - Number of messages queued
 * @property {number[]} ids - Array of queue IDs for each message
 */

/**
 * @typedef {Object} RateLimitInfo
 * @property {number} limit - Maximum requests allowed per window
 * @property {number} remaining - Requests remaining in current window
 * @property {number} reset - Unix timestamp when the limit resets
 */

// ============================================================================
// Error Class
// ============================================================================

/**
 * Custom error class for ThorMail API errors
 * @extends Error
 */
class ThorMailError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code (0 for network/timeout errors)
     * @param {string} [code] - Error code from API
     * @param {number} [retryAfter] - Seconds to wait before retry (for 429 errors)
     * @param {Object} [details] - Additional error details
     */
    constructor(message, statusCode, code = null, retryAfter = null, details = null) {
        super(message);
        this.name = 'ThorMailError';
        this.statusCode = statusCode;
        this.code = code;
        this.retryAfter = retryAfter;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ThorMailError);
        }
    }

    /** @returns {boolean} True if rate limited (429) */
    isRateLimited() {
        return this.statusCode === 429;
    }

    /** @returns {boolean} True if validation error (400) */
    isValidationError() {
        return this.statusCode === 400;
    }

    /** @returns {boolean} True if authentication error (401) */
    isAuthError() {
        return this.statusCode === 401;
    }

    /** @returns {boolean} True if forbidden (403) */
    isForbidden() {
        return this.statusCode === 403;
    }

    /** @returns {boolean} True if recipient is suppressed */
    isSuppressed() {
        return this.statusCode === 403 && this.code === 'suppression_list';
    }

    /** @returns {boolean} True if not found (404) */
    isNotFound() {
        return this.statusCode === 404;
    }

    /** @returns {boolean} True if server error (5xx) */
    isServerError() {
        return this.statusCode >= 500 && this.statusCode < 600;
    }

    /** @returns {boolean} True if timeout error */
    isTimeout() {
        return this.code === 'TIMEOUT';
    }

    /** @returns {boolean} True if network error */
    isNetworkError() {
        return this.code === 'NETWORK_ERROR';
    }

    /** @returns {boolean} True if error can be retried */
    isRetryable() {
        const retryableCodes = [429, 500, 502, 503, 504];
        return retryableCodes.includes(this.statusCode) ||
            this.code === 'TIMEOUT' ||
            this.code === 'NETWORK_ERROR';
    }

    /** @returns {Object} JSON representation of the error */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            code: this.code,
            retryAfter: this.retryAfter,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

// ============================================================================
// Main Client Class
// ============================================================================

/**
 * ThorMail API Client - Professional, resilient, and lightweight
 * 
 * @example
 * ```javascript
 * import { ThorMailClient } from '@thormail/client';
 * 
 * const client = new ThorMailClient({
 *   baseUrl: 'https://api.thormail.io',
 *   workspaceId: 'your-workspace-id',
 *   apiKey: 'your-api-key'
 * });
 * 
 * // Send a single message
 * const result = await client.send({
 *   to: 'user@example.com',
 *   templateId: 'welcome',
 *   data: { name: 'John' }
 * });
 * console.log('Queued:', result.id);
 * ```
 */
class ThorMailClient {
    /** @type {string} */
    #apiKey;

    /** @type {RateLimitInfo|null} */
    #lastRateLimit = null;

    /**
     * Creates a new ThorMail client instance
     * @param {ThorMailConfig} config - Client configuration
     * @throws {Error} If required config options are missing
     */
    constructor(config) {
        // Validate required fields
        if (!config) {
            throw new Error('ThorMailClient: Configuration object is required');
        }
        if (!config.baseUrl) {
            throw new Error('ThorMailClient: baseUrl is required');
        }
        if (!config.workspaceId) {
            throw new Error('ThorMailClient: workspaceId is required');
        }
        if (!config.apiKey) {
            throw new Error('ThorMailClient: apiKey is required');
        }

        // Normalize and store config
        this.baseUrl = config.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
        this.workspaceId = String(config.workspaceId);
        this.#apiKey = config.apiKey;
        this.timeout = config.timeout ?? 30000;
        this.debug = config.debug ?? false;

        /** @type {Required<RetryConfig>} */
        this.retryConfig = Object.freeze({
            maxRetries: config.retry?.maxRetries ?? 3,
            baseDelay: config.retry?.baseDelay ?? 1000,
            maxDelay: config.retry?.maxDelay ?? 30000,
            retryOn: config.retry?.retryOn ?? [429, 500, 502, 503, 504],
            retryOnTimeout: config.retry?.retryOnTimeout ?? true,
            retryOnNetwork: config.retry?.retryOnNetwork ?? true
        });

        this._log('Client initialized', { baseUrl: this.baseUrl, workspaceId: this.workspaceId });
    }

    /**
     * Internal debug logger
     * @param {string} msg - Message to log
     * @param {Object} [data] - Optional data to log
     * @private
     */
    _log(msg, data = null) {
        if (this.debug) {
            const timestamp = new Date().toISOString();
            console.log(`[ThorMail ${timestamp}] ${msg}`, data ? JSON.stringify(data) : '');
        }
    }

    /**
     * Builds request headers
     * @returns {Object} Headers object
     * @private
     */
    _buildHeaders() {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Workspace-ID': this.workspaceId,
            'X-API-Key': this.#apiKey,
            'X-Client-SDK': '@thormail/client/1.0.0'
        };
    }

    /**
     * Calculates exponential backoff delay with jitter
     * @param {number} attempt - Current attempt (0-indexed)
     * @param {number} [serverRetryAfter] - Server-suggested delay in seconds
     * @returns {number} Delay in milliseconds
     * @private
     */
    _calculateBackoff(attempt, serverRetryAfter = null) {
        // Respect server's Retry-After header if provided
        if (serverRetryAfter && serverRetryAfter > 0) {
            return Math.min(serverRetryAfter * 1000, this.retryConfig.maxDelay);
        }

        // Exponential backoff: baseDelay * 2^attempt
        const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt);

        // Add jitter (±25%) to prevent thundering herd
        const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = exponentialDelay + jitter;

        return Math.min(Math.max(delay, 0), this.retryConfig.maxDelay);
    }

    /**
     * Promise-based delay
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Parses rate limit headers from response
     * @param {Response} response - Fetch response
     * @returns {RateLimitInfo|null}
     * @private
     */
    _parseRateLimitHeaders(response) {
        const limit = response.headers.get('X-RateLimit-Limit');
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');

        if (limit && remaining && reset) {
            return {
                limit: parseInt(limit, 10),
                remaining: parseInt(remaining, 10),
                reset: parseInt(reset, 10)
            };
        }
        return null;
    }

    /**
     * Determines if an error should trigger a retry
     * @param {ThorMailError} error - The error to check
     * @param {number} attempt - Current attempt number
     * @returns {boolean}
     * @private
     */
    _shouldRetry(error, attempt) {
        if (attempt >= this.retryConfig.maxRetries) {
            return false;
        }

        // Check timeout
        if (error.isTimeout() && this.retryConfig.retryOnTimeout) {
            return true;
        }

        // Check network errors
        if (error.isNetworkError() && this.retryConfig.retryOnNetwork) {
            return true;
        }

        // Check status codes
        return this.retryConfig.retryOn.includes(error.statusCode);
    }

    /**
     * Makes an HTTP request with retry logic and resilience
     * @param {string} endpoint - API endpoint (e.g., '/v1/send')
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Response data
     * @throws {ThorMailError} If request fails after all retries
     * @private
     */
    async _request(endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = this._buildHeaders();
        let lastError = null;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            this._log(`Request attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}`, { endpoint });

            try {
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

                // Parse rate limit info
                const rateLimit = this._parseRateLimitHeaders(response);
                if (rateLimit) {
                    this.#lastRateLimit = rateLimit;
                }

                // Parse response body (handle empty responses)
                let data = {};
                const contentType = response.headers.get('Content-Type');
                if (contentType && contentType.includes('application/json')) {
                    try {
                        data = await response.json();
                    } catch {
                        // Empty or invalid JSON response
                    }
                }

                // Success - return data
                if (response.ok) {
                    this._log('Request successful', { status: response.status });
                    return data;
                }

                // Parse Retry-After header
                const retryAfterHeader = response.headers.get('Retry-After');
                const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

                // Create error from response
                const error = new ThorMailError(
                    data.error || `Request failed with status ${response.status}`,
                    response.status,
                    data.code || null,
                    retryAfterSeconds || data.retryAfter || null,
                    data.details || null
                );

                this._log('Request failed', { status: response.status, error: error.message });

                // Check if we should retry
                if (this._shouldRetry(error, attempt)) {
                    lastError = error;
                    const delay = this._calculateBackoff(attempt, error.retryAfter);
                    this._log(`Retrying in ${delay}ms...`);
                    await this._delay(delay);
                    continue;
                }

                // No retry - throw error
                throw error;

            } catch (err) {
                // Handle AbortError (timeout)
                if (err.name === 'AbortError') {
                    const timeoutError = new ThorMailError(
                        `Request timeout after ${this.timeout}ms`,
                        0,
                        'TIMEOUT'
                    );

                    if (this._shouldRetry(timeoutError, attempt)) {
                        lastError = timeoutError;
                        const delay = this._calculateBackoff(attempt);
                        this._log(`Timeout, retrying in ${delay}ms...`);
                        await this._delay(delay);
                        continue;
                    }
                    throw timeoutError;
                }

                // Handle network errors (fetch failures)
                if (err instanceof TypeError) {
                    const networkError = new ThorMailError(
                        'Network error: Unable to connect to ThorMail API',
                        0,
                        'NETWORK_ERROR',
                        null,
                        { originalError: err.message }
                    );

                    if (this._shouldRetry(networkError, attempt)) {
                        lastError = networkError;
                        const delay = this._calculateBackoff(attempt);
                        this._log(`Network error, retrying in ${delay}ms...`);
                        await this._delay(delay);
                        continue;
                    }
                    throw networkError;
                }

                // Re-throw ThorMailError as-is
                if (err instanceof ThorMailError) {
                    throw err;
                }

                // Wrap unknown errors
                throw new ThorMailError(
                    err.message || 'An unexpected error occurred',
                    0,
                    'UNKNOWN_ERROR',
                    null,
                    { originalError: String(err) }
                );
            }
        }

        // All retries exhausted
        if (lastError) {
            lastError.message = `${lastError.message} (after ${this.retryConfig.maxRetries} retries)`;
            throw lastError;
        }

        throw new ThorMailError(
            `Request failed after ${this.retryConfig.maxRetries} retries`,
            0,
            'MAX_RETRIES_EXCEEDED'
        );
    }

    // ==========================================================================
    // Public API Methods
    // ==========================================================================

    /**
     * Send a single message
     * 
     * @param {MessagePayload} payload - Message payload
     * @returns {Promise<SendResponse>} Response with queue ID
     * @throws {ThorMailError} If the request fails
     * 
     * @example
     * ```javascript
     * // Send with template
     * const result = await client.send({
     *   to: 'user@example.com',
     *   templateId: 'welcome',
     *   data: { name: 'John', code: 'ABC123' }
     * });
     * 
     * // Send with inline content
     * const result = await client.send({
     *   to: 'user@example.com',
     *   subject: 'Hello!',
     *   body: '<h1>Welcome {{name}}!</h1>',
     *   data: { name: 'John' }
     * });
     * 
     * // Schedule for later
     * const result = await client.send({
     *   to: 'user@example.com',
     *   templateId: 'reminder',
     *   scheduledAt: new Date(Date.now() + 86400000).toISOString() // 24h later
     * });
     * 
     * // Send SMS
     * const result = await client.send({
     *   to: '+1234567890',
     *   type: 'SMS',
     *   body: 'Your verification code is: 123456'
     * });
     * 
     * // Route to specific adapter
     * const result = await client.send({
     *   to: 'user@example.com',
     *   templateId: 'transactional',
     *   adapterId: 'sendgrid-priority'
     * });
     * ```
     */
    async send(payload) {
        // Validate required field
        if (!payload || typeof payload !== 'object') {
            throw new ThorMailError('Payload must be an object', 400, 'VALIDATION_ERROR');
        }
        if (!payload.to || typeof payload.to !== 'string' || payload.to.trim() === '') {
            throw new ThorMailError('Missing or invalid "to" field', 400, 'VALIDATION_ERROR');
        }

        // Validate scheduledAt if provided
        if (payload.scheduledAt) {
            const scheduled = new Date(payload.scheduledAt);
            if (isNaN(scheduled.getTime())) {
                throw new ThorMailError('Invalid "scheduledAt" date format', 400, 'VALIDATION_ERROR');
            }
        }

        return this._request('/v1/send', payload);
    }

    /**
     * Send multiple messages in a single batch (more efficient than multiple send() calls)
     * 
     * @param {BatchPayload} payload - Batch payload
     * @returns {Promise<BatchResponse>} Response with queue IDs
     * @throws {ThorMailError} If the request fails
     * 
     * @example
     * ```javascript
     * const result = await client.sendBatch({
     *   templateId: 'newsletter',
     *   emails: [
     *     { to: 'alice@example.com', data: { name: 'Alice' } },
     *     { to: 'bob@example.com', data: { name: 'Bob' } },
     *     { to: 'charlie@example.com', data: { name: 'Charlie' } }
     *   ]
     * });
     * 
     * console.log(`Queued ${result.count} messages`);
     * console.log('Queue IDs:', result.ids);
     * ```
     */
    async sendBatch(payload) {
        // Validate payload
        if (!payload || typeof payload !== 'object') {
            throw new ThorMailError('Payload must be an object', 400, 'VALIDATION_ERROR');
        }

        // Validate emails array
        if (!payload.emails || !Array.isArray(payload.emails)) {
            throw new ThorMailError('Missing or invalid "emails" array', 400, 'VALIDATION_ERROR');
        }
        if (payload.emails.length === 0) {
            throw new ThorMailError('The "emails" array cannot be empty', 400, 'VALIDATION_ERROR');
        }
        if (payload.emails.length > 500) {
            throw new ThorMailError(
                `Batch size ${payload.emails.length} exceeds maximum of 500`,
                400,
                'BATCH_SIZE_EXCEEDED'
            );
        }

        // Validate each recipient
        for (let i = 0; i < payload.emails.length; i++) {
            const recipient = payload.emails[i];
            if (!recipient || typeof recipient !== 'object') {
                throw new ThorMailError(
                    `Invalid recipient at index ${i}`,
                    400,
                    'VALIDATION_ERROR'
                );
            }
            if (!recipient.to || typeof recipient.to !== 'string' || recipient.to.trim() === '') {
                throw new ThorMailError(
                    `Missing or invalid "to" field at index ${i}`,
                    400,
                    'VALIDATION_ERROR'
                );
            }
        }

        return this._request('/v1/send-batch', payload);
    }

    // ==========================================================================
    // Configuration & Utility Methods
    // ==========================================================================

    /**
     * Update client configuration dynamically
     * 
     * @param {Partial<ThorMailConfig>} config - Configuration to update
     * @returns {ThorMailClient} Returns this for chaining
     * 
     * @example
     * ```javascript
     * client.configure({ timeout: 60000 });
     * client.configure({ apiKey: 'new-api-key' });
     * ```
     */
    configure(config) {
        if (config.baseUrl) {
            this.baseUrl = config.baseUrl.replace(/\/+$/, '');
        }
        if (config.workspaceId) {
            this.workspaceId = String(config.workspaceId);
        }
        if (config.apiKey) {
            this.#apiKey = config.apiKey;
        }
        if (typeof config.timeout === 'number') {
            this.timeout = config.timeout;
        }
        if (typeof config.debug === 'boolean') {
            this.debug = config.debug;
        }
        if (config.retry) {
            this.retryConfig = Object.freeze({
                ...this.retryConfig,
                ...config.retry
            });
        }
        return this;
    }

    /**
     * Get the last known rate limit information
     * @returns {RateLimitInfo|null}
     */
    getRateLimitInfo() {
        return this.#lastRateLimit;
    }

    /**
     * Check if the client is likely to be rate limited
     * @returns {boolean}
     */
    isNearRateLimit() {
        if (!this.#lastRateLimit) return false;
        return this.#lastRateLimit.remaining <= 10;
    }

    /**
     * Get client configuration (without sensitive data)
     * @returns {Object}
     */
    getConfig() {
        return {
            baseUrl: this.baseUrl,
            workspaceId: this.workspaceId,
            timeout: this.timeout,
            debug: this.debug,
            retry: { ...this.retryConfig }
        };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create a ThorMail client
 * 
 * @param {ThorMailConfig} config - Client configuration
 * @returns {ThorMailClient} ThorMail client instance
 * 
 * @example
 * ```javascript
 * import { createClient } from '@thormail/client';
 * 
 * const client = createClient({
 *   baseUrl: 'https://api.thormail.io',
 *   workspaceId: 'your-workspace-id',
 *   apiKey: 'your-api-key',
 *   retry: { maxRetries: 5 }
 * });
 * ```
 */
function createClient(config) {
    return new ThorMailClient(config);
}

// ============================================================================
// Exports
// ============================================================================

// CommonJS exports
module.exports = {
    ThorMailClient,
    ThorMailError,
    createClient
};

// ES Module default export
module.exports.default = {
    ThorMailClient,
    ThorMailError,
    createClient
};
