/**
 * Generic REST API Adapter for ThorMail
 * Allows sending messages via any RESTful API with configurable endpoints and payloads.
 */
export default class GenericRestAdapter {
    /**
     * Defines the configuration form schema for the frontend.
     */
    static getConfigSchema() {
        return [
            {
                name: 'custom_name',
                label: 'Name',
                type: 'text',
                required: false,
                placeholder: 'My Generic API',
                hint: 'Internal name for this adapter instance.',
                group: 'settings'
            },
            {
                name: 'baseUrl',
                label: 'Base URL',
                type: 'text',
                required: true,
                placeholder: 'https://api.myservice.com/v1/send',
                hint: 'The full URL endpoint where the request will be sent.',
                group: 'connection'
            },
            {
                name: 'method',
                label: 'HTTP Method',
                type: 'select',
                required: true,
                options: ['POST', 'PUT', 'PATCH', 'GET'],
                placeholder: 'POST',
                hint: 'The HTTP method to use for sending the message.',
                group: 'connection'
            },
            {
                name: 'customHeaders',
                label: 'Custom Headers',
                type: 'customHeaders',
                required: false,
                hint: 'Optional HTTP headers to include in the request (e.g., Authorization, X-API-Key).',
                group: 'authentication'
            },
            {
                name: 'payloadTemplate',
                label: 'Payload Template',
                type: 'json-template',
                required: false,
                placeholder: '{\n  "recipient": "{{to}}",\n  "content": "{{body}}"\n}',
                hint: 'A JSON template for the request body. Values like {{to}}, {{subject}}, and {{body}} will be automatically replaced.',
                group: 'payload'
            },
            {
                name: 'successStatus',
                label: 'Success Status Code(s)',
                type: 'text',
                required: false,
                placeholder: '200,201,202',
                hint: 'Comma-separated list of HTTP status codes to treat as success. Defaults to 200, 201, 202.',
                group: 'validation'
            },
            {
                name: 'from_email',
                label: 'From Email',
                type: 'text',
                required: false,
                placeholder: 'noreply@yourdomain.com',
                hint: 'Default sender email address if required by the destination API.',
                group: 'defaults'
            },
            {
                name: 'from_name',
                label: 'From Name',
                type: 'text',
                required: false,
                placeholder: 'My App',
                hint: 'Default sender name.',
                group: 'defaults'
            }
        ];
    }

    /**
     * Defines adapter metadata for the registry.
     */
    static getMetadata() {
        return {
            name: 'Generic REST API',
            description: 'Send messages via any generic REST API with custom payloads and headers.',
            group: 'generic'
        };
    }

    /**
     * @param {Object} config - The configuration object.
     */
    constructor(config) {
        this.config = config;
        this.successCodes = (config.successStatus || '200,201,202')
            .split(',')
            .map(code => parseInt(code.trim(), 10));
    }

    /**
     * Internal helper to make HTTP requests.
     */
    async _request(method, url, body = null, headers = {}) {
        const fetchHeaders = { ...headers };

        // Default Content-Type if body is provided and not already set
        if (body && !Object.keys(fetchHeaders).some(h => h.toLowerCase() === 'content-type')) {
            fetchHeaders['Content-Type'] = 'application/json';
        }

        const fetchOptions = {
            method,
            headers: fetchHeaders
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, fetchOptions);
            const status = response.status;
            let responseData;
            const text = await response.text();

            try {
                responseData = text ? JSON.parse(text) : {};
            } catch (e) {
                responseData = { raw: text };
            }

            const success = this.successCodes.includes(status);

            if (!success) {
                // Determine if temporary error
                // 429 (Rate Limit) and 5xx (Server Error) are usually temporary
                const isTemporary = status === 429 || (status >= 500 && status < 600);

                return {
                    success: false,
                    error: `HTTP ${status}: ${text.substring(0, 500)}`,
                    isTemporary,
                    status,
                    response: responseData
                };
            }

            return { success: true, data: responseData, status };
        } catch (error) {
            return {
                success: false,
                error: `Network/Fetch Error: ${error.message}`,
                isTemporary: true
            };
        }
    }

    /**
     * Validates configuration by attempting a request to the base URL.
     */
    async validateConfig() {
        try {
            // For validation, we use the method configured, but if it's POST/PUT/PATCH we don't send a body.
            // Some APIs might reject this, so we try a simple request.
            const validationHeaders = this._parseHeaders(this.config.customHeaders);

            // If the user provided a success status, we check if the base URL responds with one of them.
            // Note: This is an optimistic check.
            const result = await this._request(this.config.method || 'GET', this.config.baseUrl, null, validationHeaders);

            if (result.success) {
                return {
                    success: true,
                    message: `Successfully reached the endpoint (Status ${result.status}).`,
                    canValidate: true
                };
            } else {
                return {
                    success: false,
                    message: `Endpoint returned error: ${result.error}`,
                    canValidate: true
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Validation failed: ${error.message}`,
                canValidate: true
            };
        }
    }

    /**
     * Checks if the external service is reachable.
     */
    async healthCheck() {
        const result = await this.validateConfig();
        return result.success ? 'HEALTHY' : 'UNHEALTHY';
    }

    /**
     * Dispatches a message via the configured REST API.
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            const method = this.config.method || 'POST';
            const url = this.config.baseUrl;
            const headers = this._parseHeaders(this.config.customHeaders);

            // Merge headers from the send request if any
            if (data && data.headers) {
                Object.assign(headers, data.headers);
            }

            // Handle Idempotency Key
            if (idempotencyKey) {
                // Common headers for idempotency, can be overridden by customHeaders
                const idHeaders = ['Idempotency-Key', 'X-Idempotency-Key', 'X-Request-Id'];
                for (const h of idHeaders) {
                    if (!Object.keys(headers).some(key => key.toLowerCase() === h.toLowerCase())) {
                        headers[h] = idempotencyKey;
                    }
                }
            }

            let payload;

            if (this.config.payloadTemplate) {
                // If a template is provided, we replace variables.
                // ThorMail core usually provides data with replacements, 
                // but we also have to, subject, body specifically.
                let templateStr = this.config.payloadTemplate;
                const replacements = {
                    ...data,
                    to,
                    subject,
                    body,
                    from_email: this.config.from_email || (data && data.from_email),
                    from_name: this.config.from_name || (data && data.from_name)
                };

                // Simple mustache-like replacement: {{variable}}
                payload = templateStr.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
                    const key = p1.trim();
                    return replacements[key] !== undefined ? replacements[key] : match;
                });

                // Attempt to parse as JSON if it looks like one
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    // Keep as string if not valid JSON
                }
            } else {
                // Default payload if no template is provided
                payload = {
                    to,
                    subject,
                    content: body,
                    data
                };
            }

            const result = await this._request(method, url, payload, headers);

            if (!result.success) {
                return result;
            }

            // Extract ID if possible from response
            const responseId = result.data?.id || result.data?.messageId || result.data?.result?.id || `rest-${Date.now()}`;

            return {
                success: true,
                id: String(responseId),
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
     * Processes incoming webhooks (optional for generic REST, as it depends on the destination service).
     */
    async webhook(event, headers) {
        // Generic adapter cannot know the format of webhooks from unknown services.
        // User should use a specialized adapter or the core's generic webhook handling if available.
        return null;
    }

    /**
     * Helper to parse customHeaders field.
     * ThorMail customHeaders type usually comes as an array of objects { key, value } or a JSON object.
     */
    _parseHeaders(headersConfig) {
        const headers = {};
        if (!headersConfig) return headers;

        if (Array.isArray(headersConfig)) {
            headersConfig.forEach(h => {
                if (h.key && h.value) {
                    headers[h.key] = h.value;
                }
            });
        } else if (typeof headersConfig === 'object') {
            Object.assign(headers, headersConfig);
        } else if (typeof headersConfig === 'string') {
            try {
                Object.assign(headers, JSON.parse(headersConfig));
            } catch (e) {
                // Ignore invalid JSON
            }
        }
        return headers;
    }
}
