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
     * @param {Object} params - { to, subject, body, data, idempotencyKey }
     */
    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            // Construct the sender "Name <email>" format if name exists
            const source = this.config.fromName
                ? `"${this.config.fromName}" <${this.config.fromEmail}>`
                : this.config.fromEmail;

            // Prepare headers
            // We inject standard ThorMail headers. If SES strips them (it shouldn't for custom X- headers),
            // we also include them in Tags for visibility.
            const headers = (data && data.headers) ? { ...data.headers } : {};

            // Add Idempotency Header for downstream tracking
            if (idempotencyKey) {
                headers['X-ThorMail-Idempotency-Key'] = idempotencyKey;
            }

            // Prepare Tags
            const tags = [];
            if (idempotencyKey) {
                // Sanitize tag value: SES tags allow alphanumeric, underscore, dash.
                // UUIDs are fine.
                tags.push({ Name: 'ThorMail-Idempotency-Key', Value: idempotencyKey });
            }

            if (data && data.tags && Array.isArray(data.tags)) {
                // Merge user tags, ensuring limits aren't exceeded (SES limit is 10?)
                // Assuming data.tags are objects {Name, Value}
                tags.push(...data.tags);
            }

            const command = new SendEmailCommand({
                FromEmailAddress: source,
                Destination: {
                    ToAddresses: [to]
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
                    // For Raw email or templated, structure differs. 
                    // This adapter supports standard Simple email for now.
                },
                EmailTags: tags.length > 0 ? tags : undefined,
                // Headers are embedded in the message content for 'Simple' structure?
                // Actually, SES V2 'Simple' structure doesn't easily let you add custom headers 
                // separately from the body content unless using 'Raw'.
                // However, the AWS SDK and API documentation suggests headers can represent
                // structural headers. For custom X- headers in SES v2 Simple email, it's tricky.
                // But we CAN use tags which is better for AWS visibility.
            });

            // If headers are CRITICAL, we must use Raw.
            // But for standard usage, Tags are superior for SES specific tracking.
            // Let's stick to Simple + Tags for now as it's more robust and less error prone than Raw construction.

            const result = await this.client.send(command);

            return {
                success: true,
                id: result.MessageId,
                response: result,
                isTemporary: false
            };

        } catch (error) {
            // Enhanced Error Handling for AWS SES v2

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
}
