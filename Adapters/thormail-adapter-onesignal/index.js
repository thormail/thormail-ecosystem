import crypto from 'crypto';

export default class OneSignalAdapter {
    /**
     * Defines the configuration form schema for the frontend.
     */
    static getConfigSchema() {
        return [
            {
                name: 'appId',
                label: 'App ID',
                type: 'text',
                required: true,
                placeholder: 'e.g., 00000000-0000-0000-0000-000000000000',
                hint: 'Your OneSignal App ID found in Settings > Keys & IDs.',
                group: 'main'
            },
            {
                name: 'apiKey',
                label: 'REST API Key',
                type: 'password',
                required: true,
                placeholder: 'e.g., ZT...kY',
                hint: 'Your OneSignal REST API Key found in Settings > Keys & IDs.',
                group: 'main'
            },
            {
                name: 'fromEmail',
                label: 'From Email',
                type: 'text',
                required: true,
                placeholder: 'sender@domain.com',
                hint: 'The email address that will appear as the sender. Must be verified in OneSignal.',
                group: 'defaults'
            },
            {
                name: 'fromName',
                label: 'From Name',
                type: 'text',
                required: false,
                placeholder: 'My Company',
                hint: 'Friendly name for the sender.',
                group: 'defaults'
            },
            {
                name: 'custom_name',
                label: 'Adapter Name',
                type: 'text',
                required: false,
                placeholder: 'Marketing OneSignal',
                hint: 'Internal name for this adapter instance.',
                group: 'settings'
            },
            {
                name: 'webhookHeaderKey',
                label: 'Webhook Header Key',
                type: 'text',
                required: false,
                placeholder: 'e.g., X-Webhook-Token',
                hint: 'The name of the header OneSignal will send for authentication (e.g., X-Webhook-Token).',
                group: 'security'
            },
            {
                name: 'webhookHeaderValue',
                label: 'Webhook Header Value',
                type: 'password',
                required: false,
                placeholder: 'e.g., my-secret-value',
                hint: 'The value that the header must contain to authorize the request.',
                group: 'security'
            }
        ];
    }

    /**
     * Defines adapter metadata for the registry.
     */
    static getMetadata() {
        return {
            name: 'OneSignal',
            description: 'Send transactional and marketing emails via OneSignal.',
            group: 'marketing'
        };
    }

    /**
     * @param {Object} config - { appId, apiKey, fromEmail, fromName }
     */
    constructor(config) {
        this.config = config;
        this.baseUrl = 'https://onesignal.com/api/v1';
    }

    /**
     * Helper to make HTTP requests
     */
    async _request(method, endpoint, body = null) {
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Basic ${this.config.apiKey}`
        };

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);

        let responseData;
        try {
            responseData = await response.json();
        } catch (e) {
            responseData = { raw: await response.text() };
        }

        if (!response.ok) {
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const error = new Error(`OneSignal Rate Limit Exceeded.`);
                error.isRateLimit = true;
                error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : 60; // Default to 60s if missing
                throw error;
            }

            const errorMsg = responseData.errors
                ? (Array.isArray(responseData.errors) ? responseData.errors.join(', ') : JSON.stringify(responseData.errors))
                : response.statusText;
            throw new Error(`OneSignal API Error: ${errorMsg}`);
        }

        return responseData;
    }

    /**
     * Validates the configuration by attempting to fetch app details.
     */
    async validateConfig() {
        try {
            await this._request('GET', `/apps/${this.config.appId}`);
            return {
                success: true,
                message: 'Successfully connected to OneSignal.',
                canValidate: true
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                canValidate: true
            };
        }
    }

    /**
     * Sends an email via OneSignal.
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            // Prepare payload
            const payload = {
                app_id: this.config.appId,
                include_email_tokens: [to],
                email_from_address: this.config.fromEmail
            };

            if (this.config.fromName) {
                payload.email_from_name = this.config.fromName;
            }

            if (idempotencyKey) {
                // OneSignal requires a valid UUID. If idempotencyKey is not a UUID (e.g. integer ID),
                // we hash it to generate a deterministic UUID-like string.
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

                if (uuidRegex.test(idempotencyKey)) {
                    payload.idempotency_key = idempotencyKey;
                } else {
                    // Generate a deterministic UUID from the key using SHA-1 (UUID v5 simplified approach)
                    // We treat the hash as the UUID bytes.
                    const hash = crypto.createHash('sha1').update(String(idempotencyKey)).digest('hex');
                    // Format as UUID: 8-4-4-4-12
                    payload.idempotency_key = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
                }
            }

            // Handle Provider Template vs Standard Content
            if (data && data._useProviderTemplate && data._templateId) {
                // Use OneSignal Template
                payload.template_id = data._templateId;

                // Map remaining data as custom data/substitutions
                const { _useProviderTemplate, _templateId, ...rest } = data;
                Object.assign(payload, rest);

            } else {
                // Standard Content
                payload.email_subject = subject;

                // Use body directly as the source of HTML content
                let htmlContent = body;

                // OneSignal email_body expects HTML. Handle plain text if necessary.
                if (htmlContent && !htmlContent.trim().startsWith('<')) {
                    htmlContent = `<div>${htmlContent.replace(/\n/g, '<br>')}</div>`;
                }
                payload.email_body = htmlContent;

                // Pass extra data if it's an object and not just a string
                if (typeof data === 'object' && data !== null) {
                    const { html, ...rest } = data;
                    Object.assign(payload, rest);
                }
            }

            const result = await this._request('POST', '/notifications', payload);

            return {
                success: true,
                id: result.id,
                response: result,
                isTemporary: false
            };

        } catch (error) {
            if (error.isRateLimit) {
                return {
                    success: false,
                    error: error.message,
                    isTemporary: true,
                    pauseDuration: error.retryAfter ? error.retryAfter : 60 // Return seconds directly
                };
            }

            const isTemporary = error.message.includes('timeout') || error.message.includes('Network');

            return {
                success: false,
                error: error.message,
                isTemporary
            };
        }
    }

    /**
     * Checks if the service is reachable.
     */
    async healthCheck() {
        try {
            await this._request('GET', `/apps/${this.config.appId}`);
            return 'HEALTHY';
        } catch (error) {
            return 'UNHEALTHY';
        }
    }

    /**
     * Processes webhooks.
     */
    async webhook(event, headers) {
        // 1. Security Check: Validate Authentication
        const { webhookHeaderKey, webhookHeaderValue } = this.config;

        if (webhookHeaderKey && webhookHeaderValue) {
            // Find the header (case-insensitive)
            const headerName = Object.keys(headers).find(h => h.toLowerCase() === webhookHeaderKey.toLowerCase());
            const value = headerName ? headers[headerName] : null;

            if (value !== webhookHeaderValue) {
                throw new Error('Invalid Webhook Header Value');
            }
        }

        // 2. Parse Event Data
        // The event structure depends on the custom JSON payload configured in OneSignal.
        // We expect the structure defined in README: { "event": { ... }, "message": { ... } }
        // For robustness, we'll try to detect the structure.

        const eventData = event.event || {};
        const messageData = event.message || {};

        // 3. Map Event Type
        // OneSignal "kind" -> ThorMail "type"
        const EVENT_MAP = {
            'sent': 'DELIVERED',
            'received': 'DELIVERED',
            'delivered': 'DELIVERED',
            'opened': 'OPENED',
            'clicked': 'CLICKED',
            'bounced': 'BOUNCED',
            'hardbounced': 'BOUNCED',
            'failed': 'FAILED',
            'errored': 'FAILED',
            'spam_report': 'COMPLAINT',
            'reported_as_spam': 'COMPLAINT',
            'unsubscribed': 'UNSUBSCRIBED',
            'supressed': 'BOUNCED',
            'suppressed': 'BOUNCED'
        };

        const kind = eventData.kind;
        let type = EVENT_MAP[kind] || 'UNKNOWN';

        if (type === 'UNKNOWN' && kind && typeof kind === 'string') {
            // Fuzzy matching fallback
            if (kind.includes('opened')) type = 'OPENED';
            else if (kind.includes('clicked')) type = 'CLICKED';
            else if (kind.includes('sent') || kind.includes('delivered') || kind.includes('received')) type = 'DELIVERED';
            else if (kind.includes('unsubscribed')) type = 'UNSUBSCRIBED';
            else if (kind.includes('spam')) type = 'COMPLAINT';
            else if (kind.includes('boun')) type = 'BOUNCED';
            else if (kind.includes('fail')) type = 'FAILED';
        }
        if (type === 'UNKNOWN') {
            return null; // Ignore unknown events
        }

        // 4. Construct ThorMail Event
        // We need 'message_id' to correlate.
        const externalId = eventData.external_id || messageData.id;


        // 5. Map Type to Status String - This mapping is strictly accepted by ThorMail
        const STATUS_MAP = {
            'DELIVERED': 'ACCEPTED',
            'OPENED': 'OPENED',
            'CLICKED': 'CLICKED',
            'BOUNCED': 'HARD-REJECT',
            'FAILED': 'SOFT-REJECT', // Assuming temporary failure
            'COMPLAINT': 'COMPLAINED',
            'UNSUBSCRIBED': 'HARD-REJECT' // Treat unsubscribe as a hard rejection for future sends
        };

        const status = STATUS_MAP[type];
        if (!status) {
            return null; // Should not happen if mapping is exhaustive
        }

        // Note: ThorMail typically expects the adapter to return a recognized Event structure
        // or for the system to handle normalization. 
        // Based on request: return valid status and messageId, allow system to pick up 'events'
        return {
            status: status,
            messageId: externalId
        };
    }
}
