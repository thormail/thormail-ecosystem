import crypto from 'crypto';

export default class ResendAdapter {
    /**
     * Defines the configuration form schema for the frontend.
     */
    static getConfigSchema() {
        return [
            {
                name: 'apiKey',
                label: 'API Key',
                type: 'password',
                required: true,
                placeholder: 're_123...',
                hint: 'Your Resend API Key.',
                group: 'authentication'
            },
            {
                name: 'fromEmail',
                label: 'From Email',
                type: 'text',
                required: true,
                placeholder: 'onboarding@resend.dev',
                hint: 'The email address to send from (must be a verified domain).',
                group: 'defaults'
            },
            {
                name: 'webhookSigningSecret',
                label: 'Webhook Signing Secret',
                type: 'password',
                required: false,
                placeholder: 'whsec_...',
                hint: 'The signing secret to verify webhook events from Resend.',
                group: 'security'
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
                name: 'custom_name',
                label: 'Adapter Name',
                type: 'text',
                required: false,
                placeholder: 'Production Resend',
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
            name: 'Resend',
            description: 'Send emails via Resend API.',
            group: 'transactional'
        };
    }

    /**
     * @param {Object} config - { apiKey, fromEmail, fromName }
     */
    constructor(config) {
        this.config = config;
        this.baseUrl = 'https://api.resend.com';
    }

    /**
     * Internal helper to make HTTP requests to Resend API.
     * centralizes auth, headers, parsing, and error handling.
     */
    async _request(method, endpoint, body = null, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const fetchOptions = {
            method,
            headers
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

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

        if (!response.ok) {
            return this._handleResendError(responseData, response.status, response.headers, body);
        }

        return { success: true, data: responseData };
    }


    /**
     * Centralized error handler.
     * @param {Object} errorBody
     * @param {number} httpStatus
     * @param {Headers} headers
     * @param {Object} payloadContext
     */
    _handleResendError(errorBody, httpStatus, headers, payloadContext = null) {
        // Resend error format matches: { name, message, statusCode }
        // We use httpStatus as fallback if not in body.
        const errorName = errorBody.name || errorBody.code || 'unknown_error';
        const message = errorBody.message || 'An unknown error occurred.';

        // Permanent errors (should NOT be retried)
        const permanentErrors = [
            'validation_error',
            'missing_api_key',
            'invalid_api_key',
            'restricted_api_key',
            'invalid_from_address',
            'invalid_attachment',
            'invalid_parameter',
            'invalid_region',
            'missing_required_field',
            'not_found',
            'method_not_allowed',
            'invalid_access',
            'security_error',
            'concurrent_idempotent_requests' // Failover shield
        ];

        // Temporary errors (CAN be retried)
        const temporaryErrors = [
            'rate_limit_exceeded',
            'daily_quota_exceeded',
            'monthly_quota_exceeded',
            'application_error',
            'internal_server_error'
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

        const response = {
            success: false,
            error: `${errorName}: ${message}`,
            isTemporary,
            errorCode: errorName
        };

        // Handle Rate Limiting & Quota errors (429)
        if (httpStatus === 429 || ['rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded'].includes(errorName)) {
            let pauseDuration = 60; // Default 60s

            if (errorName === 'daily_quota_exceeded') {
                pauseDuration = 3600;
            } else if (errorName === 'monthly_quota_exceeded') {
                pauseDuration = 86400;
            } else if (headers) {
                const retryAfter = headers.get('Retry-After') || headers.get('retry-after');
                if (retryAfter) {
                    pauseDuration = parseInt(retryAfter, 10);
                }
            }
            response.pauseDuration = pauseDuration;
        }

        // Concurrent Idempotency (409) - Race Condition
        // Return success to prevent failover/double-send.
        if (errorName === 'concurrent_idempotent_requests') {
            let generatedId = `concurrent-idempotency-${Date.now()}`;
            if (payloadContext) {
                const hash = crypto.createHash('sha256').update(JSON.stringify(payloadContext)).digest('hex').substring(0, 16);
                generatedId = `concurrent_id_${hash}`;
            }

            return {
                success: true,
                id: generatedId,
                message: 'Request in progress (Concurrent), Must be validated in your resend dashboard',
                isTemporary: false
            };
        }

        // Invalid Idempotency (Duplicate with different payload)
        if (errorName === 'invalid_idempotent_request') {
            response.isTemporary = false;
            response.message = 'Idempotency key is invalid';
        }

        return response;
    }

    /**
     * Validates the configuration by checking if the API Key is valid
     * and if the sender domain is verified.
     * Ref: https://resend.com/docs/api-reference/domains/list-domains
     */
    async validateConfig() {
        try {
            // 1. Check API Key/Domains
            const result = await this._request('GET', '/domains');

            if (!result.success) {
                return {
                    success: false,
                    message: `Connection failed: ${result.error}`,
                    canValidate: true
                };
            }

            const domainsData = result.data.data; // Resend list returns { data: [] }

            // 2. Validate sender domain is verified
            const fromEmail = this.config.fromEmail;
            if (fromEmail) {
                const senderDomain = fromEmail.split('@')[1];

                if (senderDomain && domainsData && Array.isArray(domainsData)) {
                    const domain = domainsData.find(d => d.name === senderDomain);

                    if (!domain) {
                        return {
                            success: false,
                            message: `Domain "${senderDomain}" is not registered in your Resend account.`,
                            canValidate: true
                        };
                    }

                    if (domain.status !== 'verified') {
                        return {
                            success: false,
                            message: `Domain "${senderDomain}" is not verified (status: ${domain.status}).`,
                            canValidate: true
                        };
                    }
                }
            }

            return {
                success: true,
                message: 'Successfully connected to Resend. Domain is verified.',
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
     */
    async healthCheck() {
        try {
            const result = await this._request('GET', '/domains');
            if (!result.success) {
                return 'UNHEALTHY';
            }
            return 'HEALTHY';
        } catch (error) {
            return 'UNHEALTHY';
        }
    }

    /**
     * Sends an email via Resend.
     * Ref: https://resend.com/docs/api-reference/emails/send-email
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            const from = this.config.fromName
                ? `"${this.config.fromName}" <${this.config.fromEmail}>`
                : this.config.fromEmail;

            // Prepare headers
            const headers = (data && data.headers) ? { ...data.headers } : {};

            // Prepare Tags
            const tags = [];
            if (data && data.tags && Array.isArray(data.tags)) {
                tags.push(...data.tags.map(t => ({
                    name: t.Name || t.name,
                    value: t.Value || t.value
                })));
            }

            // Ensure 'to' is a flat array of strings
            const recipients = Array.isArray(to) ? to.flat() : [to];

            const payload = {
                from,
                to: recipients,
                subject,
                html: body,
                headers,
                tags: tags.length > 0 ? tags : undefined
            };

            // Map standard email fields if present in data
            if (data) {
                if (data.text) payload.text = data.text;
                if (data.cc) payload.cc = Array.isArray(data.cc) ? data.cc.flat() : [data.cc];
                if (data.bcc) payload.bcc = Array.isArray(data.bcc) ? data.bcc.flat() : [data.bcc];
                if (data.replyTo) payload.reply_to = data.replyTo;
                // Fallback for Reply-To in headers if not in top-level data
                else if (headers['Reply-To']) payload.reply_to = headers['Reply-To'];
            }

            if (data.attachments && Array.isArray(data.attachments)) {
                payload.attachments = data.attachments.map(att => {
                    // Security Check: Prevent local file access
                    if (att.path && typeof att.path === 'string') {
                        const lowerPath = att.path.toLowerCase();
                        if (!lowerPath.startsWith('http://') && !lowerPath.startsWith('https://')) {
                            const error = new Error('Security Error: Local file paths are not allowed. Use \'path\' or \'href\' with a valid URL.');
                            error.code = 'E_SECURITY';
                            error.responseCode = 553;
                            throw error;
                        }
                    }
                    return {
                        filename: att.filename,
                        content: att.content ? Buffer.from(att.content).toString('base64') : undefined,
                        path: typeof att.path === 'string' ? att.path : undefined,
                        content_id: att.contentId || att.content_id || att.cid || undefined,
                    }
                });
            } else {
                payload.attachments = [];
            }


            const requestOptions = {};
            // Ref: https://resend.com/docs/api-reference/introduction#idempotency
            if (idempotencyKey) {
                const hashedKey = crypto.createHash('sha1').update(idempotencyKey).digest('hex');
                requestOptions.headers = {
                    'Idempotency-Key': hashedKey
                };
            }

            const result = await this._request('POST', '/emails', payload, requestOptions);

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                id: result.data.id,
                response: result.data,
                isTemporary: false
            };

        } catch (error) {
            return {
                success: false,
                error: `Unexpected Error: ${error.message}`,
                isTemporary: true
            };
        }
    }

    /**
     * Processes webhooks.
     * Ref: https://resend.com/docs/dashboard/webhooks/introduction
     * @param {Object} event - The webhook payload.
     * @param {Object} headers - The webhook headers (useful for signature verification).
     */
    async webhook(event, headers) {
        // Validation: Check for signing secret
        const signingSecret = this.config.webhookSigningSecret;

        if (signingSecret) {
            const svixId = headers['svix-id'];
            const svixTimestamp = headers['svix-timestamp'];
            const svixSignature = headers['svix-signature'];

            if (!svixId || !svixTimestamp || !svixSignature) {
                console.warn('Missing Svix headers for verification');
                return null;
            }

            // Verify timestamp
            const now = Math.floor(Date.now() / 1000);
            if (Math.abs(now - svixTimestamp) > 300) {
                console.warn('Webhook timestamp too old');
                return null;
            }

            // Prepare content for signing
            let payloadString = '';
            if (typeof event === 'string') {
                payloadString = event;
            } else if (Buffer.isBuffer(event)) {
                payloadString = event.toString('utf8');
            } else {
                // Fallback for object 
                payloadString = JSON.stringify(event);
            }

            const signedContent = `${svixId}.${svixTimestamp}.${payloadString}`;

            let secretBytes;
            if (signingSecret.startsWith('whsec_')) {
                secretBytes = Buffer.from(signingSecret.substring(6), 'base64');
            } else {
                secretBytes = Buffer.from(signingSecret, 'base64');
            }

            const signature = crypto
                .createHmac('sha256', secretBytes)
                .update(signedContent)
                .digest('base64');

            const signatures = svixSignature.split(' ');
            const match = signatures.some(sig => {
                const [scheme, val] = sig.split(',');
                return scheme === 'v1' && val === signature;
            });

            if (!match) {
                console.warn('Invalid webhook signature');
                return null;
            }
        }

        const type = event.type;
        const data = event.data;

        // Map Resend events to ThorMail standardized events
        // ACCEPTED, DELIVERED, OPENED, CLICKED, HARD-REJECT (Bounced), SOFT-REJECT (Temporary Fail), COMPLAINED, UNSUBSCRIBED

        let eventStatus = null;

        switch (type) {
            case 'email.sent':
                // Informational event - email is sent but may not be delivered.
                // Not a final status, so we ignore it.
                return null;
                break;
            case 'email.delivered':
                eventStatus = 'DELIVERED';
                break;
            case 'email.delivery_delayed':
                // Informational event - email is delayed but may still be delivered.
                // Not a final status, so we ignore it.
                return null;
            case 'email.bounced':
                eventStatus = 'HARD-REJECT';
                break;
            case 'email.complained':
                eventStatus = 'COMPLAINED';
                break;
            case 'email.clicked':
                eventStatus = 'CLICKED';
                break;
            case 'email.opened':
                eventStatus = 'OPENED';
                break;
            default:
                return null;
        }

        return {
            status: eventStatus,
            messageId: data.email_id
        };
    }
}
