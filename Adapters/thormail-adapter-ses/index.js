import { SESv2Client, SendEmailCommand, GetAccountCommand } from "@aws-sdk/client-sesv2";

export default class SESAdapter {
    /**
     * Defines the configuration form schema for the frontend.
     */
    static getConfigSchema() {
        return [
            {
                name: 'region',
                label: 'AWS Region',
                type: 'text',
                required: true,
                defaultValue: 'us-east-1',
                placeholder: 'us-east-1',
                hint: 'The AWS region where your SES account is located.',
                group: 'main'
            },
            {
                name: 'accessKeyId',
                label: 'Access Key ID',
                type: 'text',
                required: true,
                placeholder: 'AKIA...',
                hint: 'AWS Access Key ID with SES permissions.',
                group: 'authentication'
            },
            {
                name: 'secretAccessKey',
                label: 'Secret Access Key',
                type: 'password',
                required: true,
                placeholder: 'wJalr...',
                hint: 'AWS Secret Access Key.',
                group: 'authentication'
            },
            {
                name: 'fromEmail',
                label: 'From Email',
                type: 'text',
                required: true,
                placeholder: 'sender@example.com',
                hint: 'The default email address verified in SES.',
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
                name: 'custom_name',
                label: 'Adapter Name',
                type: 'text',
                required: false,
                placeholder: 'Production SES',
                hint: 'Internal name for this adapter instance.',
                group: 'settings'
            },
            {
                name: 'endpoint',
                label: 'Custom Endpoint',
                type: 'text',
                required: false,
                placeholder: 'https://email.us-east-1.amazonaws.com',
                hint: 'Optional custom endpoint URL. Leave empty to use default. Useful for AWS-compatible alternatives or testing with local development.',
                group: 'settings'
            }
        ];
    }

    /**
     * Defines adapter metadata for the registry.
     */
    static getMetadata() {
        return {
            name: 'Amazon SES',
            description: 'Send emails via Amazon Simple Email Service (SES) V2.',
            group: 'transactional'
        };
    }

    /**
     * @param {Object} config - { region, accessKeyId, secretAccessKey, fromEmail, fromName, endpoint }
     */
    constructor(config) {
        this.config = config;

        // Initialize AWS SDK v3 SESv2 Client
        const clientConfig = {
            region: this.config.region,
            credentials: {
                accessKeyId: this.config.accessKeyId,
                secretAccessKey: this.config.secretAccessKey
            }
        };

        if (this.config.endpoint && this.config.endpoint.trim() !== '') {
            clientConfig.endpoint = this.config.endpoint;
        }

        this.client = new SESv2Client(clientConfig);
    }

    /**
     * Validates the configuration by checking account details.
     */
    async validateConfig() {
        try {
            await this.client.send(new GetAccountCommand({}));
            return {
                success: true,
                message: 'Successfully connected to Amazon SES v2.',
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
     * Also checks if the account's sending ability is paused (Reputation/Enforcement).
     */
    async healthCheck() {
        try {
            const data = await this.client.send(new GetAccountCommand({}));

            // Check if sending is globally enabled for the account
            // If SendingEnabled is false, the account is effectively shut down for sending.
            // This maps to the worst state: UNHEALTHY.
            if (data.SendingEnabled === false) {
                return 'UNHEALTHY';
            }

            // Check for Probation status
            // If the account is in probation, sending might still work but reliable delivery is at risk.
            // This maps to DEGRADED.
            // Note: EnforcementStatus can be 'HEALTHY' or 'PROBATION'.
            if (data.EnforcementStatus === 'PROBATION') {
                return 'DEGRADED';
            }

            return 'HEALTHY';
        } catch (error) {
            return 'UNHEALTHY';
        }
    }

    /**
     * Sends an email via Amazon SES v2.
     * Supports attachments via Raw MIME format (native builder, no external dependencies).
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            // Construct the sender "Name <email>" format if name exists
            const source = this.config.fromName
                ? `"${this.config.fromName}" <${this.config.fromEmail}>`
                : this.config.fromEmail;

            // Prepare headers
            const headers = (data && data.headers) ? { ...data.headers } : {};

            // Add Idempotency Header for downstream tracking
            if (idempotencyKey) {
                headers['X-ThorMail-Idempotency-Key'] = idempotencyKey;
            }

            // Prepare Tags
            const tags = [];
            if (idempotencyKey) {
                tags.push({ Name: 'ThorMail-Idempotency-Key', Value: idempotencyKey });
            }

            if (data && data.tags && Array.isArray(data.tags)) {
                tags.push(...data.tags);
            }

            // Check if we need to send Raw email (Attachments or complex headers)
            const hasAttachments = data && data.attachments && data.attachments.length > 0;

            if (hasAttachments) {
                // RAW MODE: Use native MIME builder (no external dependencies)
                const processedAttachments = [];
                const inlineImages = [];

                // Process Attachments
                for (const att of data.attachments) {
                    let content = att.content;
                    let filename = this._sanitizeFilename(att.filename || att.name || 'attachment');
                    let contentType = att.type || att.contentType || 'application/octet-stream';

                    const url = att.path || att.href || att.url;

                    if (url) {
                        // Download remote attachment
                        this._validateAttachmentUrl(url);
                        const downloaded = await this._downloadAttachment(url);
                        content = downloaded.buffer.toString('base64');
                        if (!contentType || contentType === 'application/octet-stream') {
                            contentType = downloaded.contentType;
                        }
                    } else if (content) {
                        // Handle content: convert to base64 if not already
                        if (Buffer.isBuffer(content)) {
                            content = content.toString('base64');
                        } else if (typeof content === 'string' && !this._isBase64(content)) {
                            content = Buffer.from(content).toString('base64');
                        }
                    }

                    const cid = att.cid || att.content_id || att.contentId;

                    if (cid) {
                        // Inline image
                        inlineImages.push({
                            filename: filename,
                            content: content,
                            contentType: contentType,
                            cid: cid
                        });
                    } else {
                        // Regular attachment
                        processedAttachments.push({
                            filename: filename,
                            content: content,
                            contentType: contentType
                        });
                    }
                }

                // Build raw MIME message using native builder
                const rawData = this._buildRawMimeMessage({
                    from: source,
                    to: Array.isArray(to) ? to.join(', ') : to,
                    cc: data.cc ? (Array.isArray(data.cc) ? data.cc.join(', ') : data.cc) : null,
                    bcc: data.bcc ? (Array.isArray(data.bcc) ? data.bcc.join(', ') : data.bcc) : null,
                    replyTo: data.replyTo || null,
                    subject: subject,
                    htmlBody: body,
                    textBody: data.text || null,
                    headers: headers,
                    attachments: processedAttachments,
                    inlineImages: inlineImages
                });

                const command = new SendEmailCommand({
                    Content: {
                        Raw: {
                            Data: rawData
                        }
                    },
                    EmailTags: tags.length > 0 ? tags : undefined
                });

                const result = await this.client.send(command);

                return {
                    success: true,
                    id: result.MessageId,
                    response: result,
                    isTemporary: false
                };

            } else {
                // SIMPLE MODE: Efficient for standard emails without attachments
                const command = new SendEmailCommand({
                    FromEmailAddress: source,
                    Destination: {
                        ToAddresses: Array.isArray(to) ? to : [to],
                        CcAddresses: (data && data.cc) ? (Array.isArray(data.cc) ? data.cc : [data.cc]) : undefined,
                        BccAddresses: (data && data.bcc) ? (Array.isArray(data.bcc) ? data.bcc : [data.bcc]) : undefined
                    },
                    Content: {
                        Simple: {
                            Subject: {
                                Data: subject,
                                Charset: "UTF-8"
                            },
                            Body: {
                                Html: {
                                    Data: body,
                                    Charset: "UTF-8"
                                }
                            }
                        }
                    },
                    ReplyToAddresses: (data && data.replyTo) ? [data.replyTo] : undefined,
                    EmailTags: tags.length > 0 ? tags : undefined
                });

                const result = await this.client.send(command);

                return {
                    success: true,
                    id: result.MessageId,
                    response: result,
                    isTemporary: false
                };
            }

        } catch (error) {
            // Security errors
            if (error.code === 'E_SECURITY') {
                return {
                    success: false,
                    error: error.message,
                    isTemporary: false,
                    isLocalError: true
                };
            }

            // Temporary Errors
            // ThrottlingException, LimitExceededException, ServiceUnavailable, InternalFailure, TooManyRequestsException
            const isTemporary = [
                'ThrottlingException',
                'LimitExceededException',
                'ServiceUnavailable',
                'InternalFailure',
                'RequestTimeout',
                'NetworkingError',
                'TimeoutError',
                'TooManyRequestsException'
            ].includes(error.name) || (error.$metadata && error.$metadata.httpStatusCode >= 500);

            return {
                success: false,
                error: `${error.name}: ${error.message}`,
                isTemporary
            };
        }
    }

    /**
     * Processes webhooks.
     */
    async webhook(event, headers) {
        return null;
    }

    /**
     * Downloads a remote file and returns its buffer and content type.
     * Uses streaming for efficient memory usage.
     * @param {string} url - Remote URL to download
     * @returns {Promise<{buffer: Buffer, contentType: string}>}
     */
    async _downloadAttachment(url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download attachment: ${response.statusText}`);
        }

        // Get content type from response headers
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Stream to buffer efficiently
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
            buffer: buffer,
            contentType: contentType
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
     * Builds a raw MIME message with attachments.
     * @param {Object} params - { from, to, cc, bcc, replyTo, subject, htmlBody, textBody, headers, attachments, inlineImages }
     * @returns {Buffer} Raw MIME message as Buffer
     */
    _buildRawMimeMessage({ from, to, cc, bcc, replyTo, subject, htmlBody, textBody, headers = {}, attachments = [], inlineImages = [] }) {
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).substring(2)}`;

        let mimeMessage = '';

        // Headers
        mimeMessage += `From: ${from}\r\n`;
        mimeMessage += `To: ${to}\r\n`;
        if (cc) mimeMessage += `Cc: ${cc}\r\n`;
        if (bcc) mimeMessage += `Bcc: ${bcc}\r\n`;
        if (replyTo) mimeMessage += `Reply-To: ${replyTo}\r\n`;
        mimeMessage += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
        mimeMessage += `MIME-Version: 1.0\r\n`;

        // Custom headers
        for (const [key, value] of Object.entries(headers)) {
            mimeMessage += `${key}: ${value}\r\n`;
        }

        const hasAttachments = attachments.length > 0;
        const hasInlineImages = inlineImages.length > 0;

        if (hasAttachments) {
            // mixed/alternative structure for attachments
            mimeMessage += `Content-Type: multipart/mixed; boundary="${mixedBoundary}"\r\n\r\n`;
            mimeMessage += `--${mixedBoundary}\r\n`;

            if (hasInlineImages) {
                // related/alternative for inline images
                mimeMessage += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
            } else {
                mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
            }
        } else if (hasInlineImages) {
            mimeMessage += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
        } else {
            mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
        }

        // Text part (optional)
        if (textBody) {
            mimeMessage += `--${boundary}\r\n`;
            mimeMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
            mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
            mimeMessage += `${this._wrapBase64(Buffer.from(textBody).toString('base64'))}\r\n`;
        }

        // HTML part
        mimeMessage += `--${boundary}\r\n`;
        mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
        mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
        mimeMessage += `${this._wrapBase64(Buffer.from(htmlBody).toString('base64'))}\r\n`;

        // Inline images
        for (const img of inlineImages) {
            mimeMessage += `--${boundary}\r\n`;
            mimeMessage += `Content-Type: ${img.contentType}\r\n`;
            mimeMessage += `Content-Transfer-Encoding: base64\r\n`;
            mimeMessage += `Content-ID: <${img.cid}>\r\n`;
            mimeMessage += `Content-Disposition: inline; filename="${img.filename}"\r\n\r\n`;
            mimeMessage += `${this._wrapBase64(img.content)}\r\n`;
        }

        mimeMessage += `--${boundary}--\r\n`;

        // Regular attachments
        if (hasAttachments) {
            for (const att of attachments) {
                mimeMessage += `--${mixedBoundary}\r\n`;
                mimeMessage += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
                mimeMessage += `Content-Transfer-Encoding: base64\r\n`;
                mimeMessage += `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n`;
                mimeMessage += `${this._wrapBase64(att.content)}\r\n`;
            }
            mimeMessage += `--${mixedBoundary}--\r\n`;
        }

        return Buffer.from(mimeMessage);
    }

    /**
     * Wraps base64 string at 76 characters per line (MIME standard).
     * @param {string} base64 - Base64 encoded string
     * @returns {string} Wrapped base64 string
     */
    _wrapBase64(base64) {
        const lines = [];
        for (let i = 0; i < base64.length; i += 76) {
            lines.push(base64.substring(i, i + 76));
        }
        return lines.join('\r\n');
    }

    /**
     * Sanitizes filename to prevent MIME header injection and encoding issues.
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
    _sanitizeFilename(filename) {
        if (typeof filename !== 'string') return 'attachment';

        // Remove path separators and null bytes
        let sanitized = filename.replace(/[\/\\\x00]/g, '');

        // Remove or replace problematic characters for MIME headers
        sanitized = sanitized.replace(/["\r\n]/g, '_');

        // Limit length
        if (sanitized.length > 200) {
            const ext = sanitized.slice(-10);  // Preserve extension
            sanitized = sanitized.slice(0, 190) + ext;
        }

        return sanitized || 'attachment';
    }
}
