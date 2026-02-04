import nodemailer from 'nodemailer';

export default class SMTPAdapter {
    /**
     * Defines the configuration form schema for the frontend.
     */
    static getConfigSchema() {
        return [
            {
                name: 'host',
                label: 'SMTP Host',
                type: 'text',
                required: true,
                placeholder: 'smtp.example.com',
                hint: 'The hostname or IP address of your SMTP server.',
                group: 'main'
            },
            {
                name: 'port',
                label: 'SMTP Port',
                type: 'number',
                required: true,
                defaultValue: 587,
                placeholder: '587',
                hint: 'The port to connect to (e.g., 587, 465, 25).',
                group: 'main'
            },
            {
                name: 'secure',
                label: 'Use TLS/SSL',
                type: 'boolean',
                defaultValue: false,
                hint: 'If true, the connection will use TLS when connecting to server. If false (the default), TLS is used if server supports the STARTTLS extension.',
                group: 'security'
            },
            {
                name: 'auth_user',
                label: 'Username',
                type: 'text',
                required: true,
                placeholder: 'user@example.com',
                hint: 'Your SMTP username.',
                group: 'authentication'
            },
            {
                name: 'auth_pass',
                label: 'Password',
                type: 'password',
                required: true,
                placeholder: '••••••••',
                hint: 'Your SMTP password.',
                group: 'authentication'
            },
            {
                name: 'fromEmail',
                label: 'From Email',
                type: 'text',
                required: true,
                placeholder: 'sender@example.com',
                hint: 'The default email address that will appear as the sender.',
                group: 'defaults'
            },
            {
                name: 'fromName',
                label: 'From Name',
                type: 'text',
                required: false,
                placeholder: 'My Company',
                hint: 'The default friendly name for the sender.',
                group: 'defaults'
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
                name: 'custom_name',
                label: 'Adapter Name',
                type: 'text',
                required: false,
                placeholder: 'My SMTP Server',
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
            name: 'SMTP',
            description: 'Send emails using any standard SMTP server.',
            group: 'transactional'
        };
    }

    /**
     * @param {Object} config - { host, port, secure, auth_user, auth_pass, fromEmail, fromName }
     */
    constructor(config) {
        this.config = config;

        // Initialize transporter
        this.transporter = nodemailer.createTransport({
            host: this.config.host,
            port: parseInt(this.config.port, 10),
            secure: this.config.secure === true || this.config.secure === 'true', // true for 465, false for other ports
            auth: {
                user: this.config.auth_user,
                pass: this.config.auth_pass,
            },
        });
    }

    /**
     * Validates the configuration by attempting to connect.
     */
    async validateConfig() {
        try {
            await this.transporter.verify();
            return {
                success: true,
                message: 'Successfully connected to SMTP server.',
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
     * Sends an email via SMTP.
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            const mailOptions = {
                from: this.config.fromName
                    ? `"${this.config.fromName}" <${this.config.fromEmail}>`
                    : this.config.fromEmail,
                to: to,
                subject: subject,
                html: body, // ThorMail body is HTML
                headers: this._parseHeaders(this.config.customHeaders)
            };

            if (data.attachments && Array.isArray(data.attachments)) {
                mailOptions.attachments = data.attachments.map(att => {
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
                    if (att.href && typeof att.href === 'string') {
                        const lowerHref = att.href.toLowerCase();
                        if (!lowerHref.startsWith('http://') && !lowerHref.startsWith('https://')) {
                            const error = new Error('Security Error: Local file paths are not allowed. Use \'path\' or \'href\' with a valid URL.');
                            error.code = 'E_SECURITY';
                            error.responseCode = 553;
                            throw error;
                        }
                    }
                    return att;
                });
            } else {
                mailOptions.attachments = [];
            }

            // Handle data if needed, though for standard SMTP usually just HTML content is enough.
            // Some SMTP providers might support custom headers for tracking.
            if (data && typeof data === 'object') {
                if (data.headers) {
                    mailOptions.headers = data.headers;
                }
                // Text version fallback if provided
                if (data.text) {
                    mailOptions.text = data.text;
                }
            }

            // Add Message-ID if allowed/needed? Nodemailer handles it usually.
            // If idempotencyKey is critical, some providers use custom headers.
            // We'll leave it to standard Nodemailer behavior for generic SMTP.

            const info = await this.transporter.sendMail(mailOptions);

            return {
                success: true,
                id: info.messageId,
                response: info.response,
                isTemporary: false
            };

        } catch (error) {
            // Enhanced Error Handling based on Nodemailer & SMTP Standards

            // 1. Explicitly Temporary Errors (Network/Timeout/Throttling)
            // commonly: ETIMEDOUT, ECONNRESET, EPIPE, ESOCKET, ECONNECTION
            // 4xx SMTP codes are also Temporary (Soft Bounces)
            const isNetworkError = [
                'ETIMEDOUT',
                'ECONNRESET',
                'EPIPE',
                'ESOCKET',
                'ECONNECTION',
                'EDNS', // DNS lookup failure might be temporary
                'ENOTFOUND' // Could be temporary DNS issue
            ].includes(error.code);


            const isLocalError = [
                'E_SECURITY'
            ].includes(error.code);

            const isSMTP4xx = error.responseCode >= 400 && error.responseCode < 500;

            // 2. Explicitly Permanent Errors (Configuration/Auth/Data)
            // commonly: EAUTH (Auth failed), EENVELOPE (Bad address), EMESSAGE (Bad content)
            // 5xx SMTP codes are Permanent (Hard Bounces)
            const isSMTP5xx = error.responseCode >= 500;
            const isAuthError = error.code === 'EAUTH' || error.responseCode === 535;

            // Determine final status
            let isTemporary = isNetworkError || isSMTP4xx;


            // Override if strictly permanent
            if (isAuthError || isSMTP5xx) {
                isTemporary = false;
            }

            // Construct meaningful error message
            // Nodemailer often puts the raw SMTP response in 'response'
            const details = error.response ? ` (${error.response})` : '';
            const finalMessage = `${error.message}${details}`;

            return {
                success: false,
                error: finalMessage,
                code: error.code,
                isTemporary,
                isLocalError
            };
        }
    }

    /**
     * Checks if the service is reachable.
     */
    async healthCheck() {
        try {
            await this.transporter.verify();
            return 'HEALTHY';
        } catch (error) {
            return 'UNHEALTHY';
        }
    }

    /**
     * Processes webhooks.
     * Standard SMTP does not support webhooks, so we return null (ignored).
     */
    async webhook(event, headers) {
        return null;
    }

    /**
     * Parses custom headers configuration.
     * @param {Object|Array|string} headersConfig - Configuration for custom headers.
     * @returns {Object} Parsed headers object.
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
