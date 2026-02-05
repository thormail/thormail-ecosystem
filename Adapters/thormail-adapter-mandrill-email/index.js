import crypto from 'crypto';

/**
 * Mandrill Email Adapter for ThorMail
 * 
 * Sends transactional emails via Mailchimp's Mandrill Transactional API.
 * 
 * API Reference: https://mailchimp.com/developer/transactional/api/messages/send-new-message/
 * Webhooks: https://mailchimp.com/developer/transactional/docs/webhooks/
 */
export default class MandrillEmailAdapter {
    /**
     * Defines the configuration form schema for the frontend.
     * Ref: https://mailchimp.com/developer/transactional/docs/authentication/
     */
    static getConfigSchema() {
        return [
            {
                name: 'apiKey',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                hint: 'Your Mandrill API Key. Get it from Settings > SMTP & API Info in your Mandrill dashboard.',
                group: 'authentication'
            },
            {
                name: 'fromEmail',
                label: 'From Email',
                type: 'text',
                required: true,
                placeholder: 'noreply@example.com',
                hint: 'The default sender email address. Must be a verified domain in Mandrill.',
                group: 'defaults'
            },
            {
                name: 'fromName',
                label: 'From Name',
                type: 'text',
                required: false,
                placeholder: 'My App',
                hint: 'The default friendly name for the sender.',
                group: 'defaults'
            },
            {
                name: 'subaccount',
                label: 'Subaccount ID',
                type: 'text',
                required: false,
                placeholder: 'my-subaccount',
                hint: 'Optional default subaccount to use for sending. Can be overridden per message via data.subaccount.',
                group: 'settings'
            },
            {
                name: 'webhookKey',
                label: 'Webhook Authentication Key',
                type: 'password',
                required: false,
                placeholder: '',
                hint: 'The authentication key for verifying webhook signatures. Found in your Mandrill webhook settings.',
                group: 'security'
            },
            {
                name: 'webhookUrl',
                label: 'Webhook URL',
                type: 'text',
                required: false,
                placeholder: 'https://your-thormail-instance.com/webhook/mandrill',
                hint: 'The exact URL configured in Mandrill for webhooks. Required for signature verification.',
                group: 'security'
            },
            {
                name: 'custom_name',
                label: 'Adapter Name',
                type: 'text',
                required: false,
                placeholder: 'Production Mandrill',
                hint: 'Internal name for this adapter instance.',
                group: 'settings'
            }
        ];
    }

    /**
     * Defines adapter metadata for the registry.
     */
    static getMetadata() {
        return {
            name: 'Mandrill Email',
            description: 'Send transactional emails via Mailchimp Mandrill API.',
            group: 'transactional'
        };
    }

    /**
     * @param {Object} config - Configuration from getConfigSchema
     */
    constructor(config) {
        this.config = config;
        this.baseUrl = 'https://mandrillapp.com/api/1.0';
    }

    /**
     * Internal helper to make HTTP requests to Mandrill API.
     * Mandrill uses POST for all endpoints with the API key in the body.
     * Ref: https://mailchimp.com/developer/transactional/docs/fundamentals/
     */
    async _request(endpoint, body = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        // Mandrill requires API key in the request body
        const payload = {
            key: this.config.apiKey,
            ...body
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        };

        let response;
        try {
            response = await fetch(url, fetchOptions);
        } catch (error) {
            // Network level errors
            return {
                success: false,
                error: `Network Error: ${error.message}`,
                isTemporary: true
            };
        }

        let responseData;
        const text = await response.text();
        try {
            responseData = text ? JSON.parse(text) : {};
        } catch (e) {
            responseData = { message: text };
        }

        if (!response.ok || responseData.status === 'error') {
            return this._handleMandrillError(responseData, response.status);
        }

        return { success: true, data: responseData };
    }

    /**
     * Centralized error handler for Mandrill API errors.
     * Ref: https://mailchimp.com/developer/transactional/docs/error-glossary/
     * @param {Object} errorBody - Response body from Mandrill
     * @param {number} httpStatus - HTTP status code
     */
    _handleMandrillError(errorBody, httpStatus) {
        const errorName = errorBody.name || 'Unknown';
        const message = errorBody.message || 'An unknown error occurred.';
        const code = errorBody.code || httpStatus;

        // Permanent errors (should NOT be retried)
        // Ref: https://mailchimp.com/developer/transactional/docs/error-glossary/
        const permanentErrors = [
            'ValidationError',
            'Invalid_Key',
            'Invalid_Reject',
            'Unknown_Message',
            'Unknown_Template',
            'Unknown_Subaccount',
            'Unknown_Sender',
            'Unknown_Url',
            'Unknown_TrackingDomain',
            'Unknown_Webhook',
            'Unknown_InboundDomain',
            'Unknown_InboundRoute',
            'Unknown_Export',
            'Invalid_CustomDNS',
            'Invalid_CustomDNSPending',
            'Invalid_Sender',
            'Invalid_Template',
            'Invalid_Tag_Name'
        ];

        // Temporary errors (CAN be retried)
        const temporaryErrors = [
            'GeneralError',
            'ServiceUnavailable',
            'PaymentRequired'
        ];

        let isTemporary = false;

        // Check against known temporary errors or 5xx/429 status
        if (temporaryErrors.includes(errorName) || [429, 500, 502, 503, 504].includes(httpStatus)) {
            isTemporary = true;
        }

        // Explicitly force to permanent if known permanent error
        if (permanentErrors.includes(errorName)) {
            isTemporary = false;
        }

        const result = {
            success: false,
            error: `${errorName}: ${message}`,
            isTemporary,
            errorCode: code
        };

        // Handle rate limiting
        if (httpStatus === 429) {
            result.pauseDuration = 60; // Default 60s pause
        }

        return result;
    }

    /**
     * Validates the configuration by pinging Mandrill.
     * Ref: https://mailchimp.com/developer/transactional/api/users/ping-2/
     */
    async validateConfig() {
        try {
            const result = await this._request('/users/ping2.json');

            if (!result.success) {
                return {
                    success: false,
                    message: `Connection failed: ${result.error}`,
                    canValidate: true
                };
            }

            // ping2 returns "PING" on success with the username
            if (result.data && result.data.PING === 'PONG!') {
                return {
                    success: true,
                    message: `Successfully connected to Mandrill.`,
                    canValidate: true
                };
            }

            return {
                success: true,
                message: 'Connected to Mandrill API.',
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
     * Checks if the service is reachable.
     * Ref: https://mailchimp.com/developer/transactional/api/users/ping/
     */
    async healthCheck() {
        try {
            const result = await this._request('/users/ping.json');
            if (!result.success) {
                return 'UNHEALTHY';
            }
            return 'HEALTHY';
        } catch (error) {
            return 'UNHEALTHY';
        }
    }

    /**
     * Downloads a remote file and returns its base64 content.
     * Uses streaming for efficient memory usage.
     * @param {string} url - Remote URL to download
     * @returns {Promise<{content: string, type: string}>}
     */
    async _downloadAttachment(url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download attachment: ${response.statusText}`);
        }

        // Get content type from response headers
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Stream to buffer efficiently
        const buffer = await response.arrayBuffer();
        const base64Content = Buffer.from(buffer).toString('base64');

        return {
            content: base64Content,
            type: contentType
        };
    }

    /**
     * Validates that a URL is a remote HTTP/HTTPS URL (security check).
     * @param {string} url - URL to validate
     * @throws {Error} If URL is not a valid remote URL
     */
    _validateAttachmentUrl(url) {
        if (typeof url !== 'string') {
            const error = new Error('Security Error: Attachment URL must be a string.');
            error.code = 'E_SECURITY';
            error.responseCode = 553;
            throw error;
        }

        const lowerUrl = url.toLowerCase();
        if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
            const error = new Error('Security Error: Local file paths are not allowed. Use a valid HTTP/HTTPS URL.');
            error.code = 'E_SECURITY';
            error.responseCode = 553;
            throw error;
        }
    }

    /**
     * Sends an email via Mandrill.
     * Ref: https://mailchimp.com/developer/transactional/api/messages/send-new-message/
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data = {}, idempotencyKey }) {
        try {
            // Build sender
            const fromEmail = this.config.fromEmail;
            const fromName = this.config.fromName || '';

            // Ensure 'to' is an array
            const recipients = Array.isArray(to) ? to.flat() : [to];

            // Build message object per Mandrill API spec
            const message = {
                html: body,
                subject: subject,
                from_email: fromEmail,
                from_name: fromName,
                to: recipients.map(email => ({
                    email: email,
                    type: 'to'
                })),
                headers: {},
                important: false,
                track_opens: true,
                track_clicks: true,
                auto_text: true,
                auto_html: false,
                inline_css: false,
                url_strip_qs: false,
                preserve_recipients: false,
                view_content_link: false
            };

            // Handle CC recipients
            if (data.cc) {
                const ccList = Array.isArray(data.cc) ? data.cc.flat() : [data.cc];
                ccList.forEach(email => {
                    message.to.push({ email, type: 'cc' });
                });
            }

            // Handle BCC recipients
            if (data.bcc) {
                const bccList = Array.isArray(data.bcc) ? data.bcc.flat() : [data.bcc];
                bccList.forEach(email => {
                    message.to.push({ email, type: 'bcc' });
                });
            }

            // Handle Reply-To
            if (data.replyTo) {
                message.headers['Reply-To'] = data.replyTo;
            }

            // Handle custom headers
            if (data.headers && typeof data.headers === 'object') {
                Object.assign(message.headers, data.headers);
            }

            // Handle text version
            if (data.text) {
                message.text = data.text;
                message.auto_text = false;
            }

            // Handle subaccount (from config or data)
            const subaccount = data.subaccount || this.config.subaccount;
            if (subaccount) {
                message.subaccount = subaccount;
            }

            // Handle tags
            if (data.tags && Array.isArray(data.tags)) {
                message.tags = data.tags.map(t => {
                    if (typeof t === 'string') return t;
                    return t.name || t.Name || String(t);
                });
            }

            // Handle metadata (global and per-recipient)
            if (data.metadata && typeof data.metadata === 'object') {
                message.metadata = data.metadata;
            }

            // Handle tracking options
            if (typeof data.trackOpens === 'boolean') {
                message.track_opens = data.trackOpens;
            }
            if (typeof data.trackClicks === 'boolean') {
                message.track_clicks = data.trackClicks;
            }

            // Handle merge variables (global)
            if (data.global_merge_vars && Array.isArray(data.global_merge_vars)) {
                message.global_merge_vars = data.global_merge_vars;
            }

            // Handle merge variables (per-recipient)
            if (data.merge_vars && Array.isArray(data.merge_vars)) {
                message.merge_vars = data.merge_vars;
            }

            // Handle Google Analytics
            if (data.google_analytics_domains) {
                message.google_analytics_domains = data.google_analytics_domains;
            }
            if (data.google_analytics_campaign) {
                message.google_analytics_campaign = data.google_analytics_campaign;
            }

            // Handle attachments (unified: with CID → inline images, without CID → regular attachments)
            // Ref: https://mailchimp.com/developer/transactional/api/messages/send-new-message/#body-message-attachments
            // Ref: https://mailchimp.com/developer/transactional/api/messages/send-new-message/#body-message-images
            if (data.attachments && Array.isArray(data.attachments)) {
                message.attachments = [];
                message.images = [];

                for (const att of data.attachments) {
                    let content = att.content;
                    let type = att.type || att.contentType || 'application/octet-stream';

                    // If path/href is provided, download the file
                    const url = att.path || att.href || att.url;
                    if (url) {
                        // Security: Validate URL is remote
                        this._validateAttachmentUrl(url);

                        // Download and encode
                        const downloaded = await this._downloadAttachment(url);
                        content = downloaded.content;
                        type = att.type || downloaded.type;
                    } else if (content && !this._isBase64(content)) {
                        // If content is not base64, encode it
                        content = Buffer.from(content).toString('base64');
                    }

                    // Check if this is an inline image (has CID)
                    const cid = att.cid || att.content_id || att.contentId;

                    if (cid) {
                        // Inline image - goes to message.images
                        message.images.push({
                            type: type,
                            name: cid,
                            content: content
                        });
                    } else {
                        // Regular attachment - goes to message.attachments
                        message.attachments.push({
                            type: type,
                            name: att.filename || att.name || 'attachment',
                            content: content
                        });
                    }
                }

                // Clean up empty arrays
                if (message.attachments.length === 0) delete message.attachments;
                if (message.images.length === 0) delete message.images;
            }

            // Build request payload
            const payload = {
                message: message,
                async: false // Send synchronously to get immediate result
            };

            // Handle IP pool
            if (data.ip_pool) {
                payload.ip_pool = data.ip_pool;
            }

            // Handle scheduled sending
            if (data.send_at) {
                payload.send_at = data.send_at;
            }

            const result = await this._request('/messages/send.json', payload);

            if (!result.success) {
                return result;
            }

            // Mandrill returns an array of results (one per recipient)
            // For ThorMail, we return the first result
            const sendResult = Array.isArray(result.data) ? result.data[0] : result.data;

            // Check status
            // Possible statuses: sent, queued, scheduled, rejected, invalid
            if (sendResult.status === 'rejected' || sendResult.status === 'invalid') {
                return {
                    success: false,
                    error: `Message ${sendResult.status}: ${sendResult.reject_reason || 'Unknown reason'}`,
                    isTemporary: false,
                    id: sendResult._id
                };
            }

            return {
                success: true,
                id: sendResult._id,
                response: sendResult,
                isTemporary: false
            };

        } catch (error) {
            // Handle security errors
            if (error.code === 'E_SECURITY') {
                return {
                    success: false,
                    error: error.message,
                    isTemporary: false,
                    isLocalError: true,
                    code: error.code
                };
            }

            return {
                success: false,
                error: `Unexpected Error: ${error.message}`,
                isTemporary: true
            };
        }
    }

    /**
     * Checks if a string is valid base64.
     * @param {string} str
     * @returns {boolean}
     */
    _isBase64(str) {
        if (typeof str !== 'string') return false;
        try {
            return Buffer.from(str, 'base64').toString('base64') === str;
        } catch (e) {
            return false;
        }
    }

    /**
     * Processes webhooks from Mandrill.
     * 
     * Mandrill sends webhooks as HTTP POST with Content-Type: application/x-www-form-urlencoded
     * The body contains a single parameter `mandrill_events` which is a JSON string array.
     * 
     * Ref: https://mailchimp.com/developer/transactional/docs/webhooks/
     * 
     * @param {Object} body - The parsed request body object containing mandrill_events
     * @param {Object} headers - The webhook request headers
     * @returns {Object[]|null} Array of processed events or null if validation fails
     */
    async webhook(body, headers) {
        // Extract mandrill_events from the body object
        // Mandrill sends: { mandrill_events: '[{...}, {...}]' } (JSON string)
        const mandrillEventsRaw = body?.mandrill_events;

        if (!mandrillEventsRaw) {
            console.warn('Missing mandrill_events in webhook body');
            return null;
        }

        // Verify signature if webhook key is configured
        // Ref: https://mailchimp.com/developer/transactional/docs/webhooks/#authenticating-webhook-requests
        if (this.config.webhookKey && this.config.webhookUrl) {
            const isValid = this._verifyWebhookSignature(body, headers);
            if (!isValid) {
                return null;
            }
        }

        // Parse the mandrill_events JSON string into an array
        const events = this._parseMandrillEvents(mandrillEventsRaw);
        if (!events || events.length === 0) {
            return null;
        }

        // Process all events and return mapped results
        return this._processWebhookEvents(events);
    }

    /**
     * Verifies the webhook signature from Mandrill.
     * 
     * Signature is generated as: HMAC-SHA1(webhookKey, webhookUrl + sorted(key+value pairs))
     * 
     * @param {Object} body - The parsed request body
     * @param {Object} headers - The request headers
     * @returns {boolean} True if signature is valid
     */
    _verifyWebhookSignature(body, headers) {
        const signature = headers['x-mandrill-signature'] || headers['X-Mandrill-Signature'];

        if (!signature) {
            console.warn('Missing X-Mandrill-Signature header');
            return false;
        }

        // Build signed data: URL + sorted POST params (key+value concatenated)
        let signedData = this.config.webhookUrl;

        // Sort keys alphabetically and append key+value
        const sortedKeys = Object.keys(body).sort();
        for (const key of sortedKeys) {
            signedData += key + body[key];
        }

        // Generate expected HMAC-SHA1 signature
        const expectedSignature = crypto
            .createHmac('sha1', this.config.webhookKey)
            .update(signedData)
            .digest('base64');

        if (signature !== expectedSignature) {
            console.warn('Invalid Mandrill webhook signature');
            return false;
        }

        return true;
    }

    /**
     * Parses the mandrill_events JSON string into an array.
     * 
     * @param {string|Array} mandrillEvents - JSON string or already parsed array
     * @returns {Array|null} Parsed events array or null on error
     */
    _parseMandrillEvents(mandrillEvents) {
        try {
            // If already an array, return as-is
            if (Array.isArray(mandrillEvents)) {
                return mandrillEvents;
            }

            // Parse JSON string
            if (typeof mandrillEvents === 'string') {
                return JSON.parse(mandrillEvents);
            }

            console.error('Unexpected mandrill_events type:', typeof mandrillEvents);
            return null;
        } catch (e) {
            console.error('Failed to parse mandrill_events:', e.message);
            return null;
        }
    }

    /**
     * Processes webhook events and maps them to ThorMail standard format.
     * 
     * @param {Array} events - Array of Mandrill webhook events
     * @returns {Object[]} Array of processed events with status and messageId
     */
    _processWebhookEvents(events) {
        // Map Mandrill event types to ThorMail standard statuses
        // Ref: https://mailchimp.com/developer/transactional/docs/webhooks/#event-types
        const statusMap = {
            'send': null,           // Sent but not yet delivered, ignore
            'deferral': null,       // Temporary failure, will retry automatically
            'hard_bounce': 'HARD-REJECT',
            'soft_bounce': 'SOFT-REJECT',
            'delivered': 'DELIVERED',
            'open': 'OPENED',
            'click': 'CLICKED',
            'spam': 'COMPLAINED',
            'unsub': null,          // Unsubscribe handled separately
            'reject': 'HARD-REJECT'
        };

        const results = [];

        for (const webhookEvent of events) {
            const eventType = webhookEvent.event;
            const msg = webhookEvent.msg || {};
            const status = statusMap[eventType];

            // Skip events that don't map to a ThorMail status
            if (!status) {
                continue;
            }

            results.push({
                status: status,
                messageId: msg._id,
                timestamp: webhookEvent.ts,
                event: eventType
            });
        }

        return results.length > 0 ? results : null;
    }
}
