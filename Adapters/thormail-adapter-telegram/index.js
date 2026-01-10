export default class TelegramAdapter {
    static getConfigSchema() {
        return [
            {
                name: 'botToken',
                label: 'Bot Token',
                type: 'password',
                required: true,
                placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
                hint: 'Your Telegram Bot Token from @BotFather',
                group: 'authentication'
            },
            {
                name: 'defaultChatId',
                label: 'Default Chat ID',
                type: 'text',
                required: false,
                placeholder: '123456789',
                hint: 'Default Chat ID to send messages to if not specified in the "to" field.',
                group: 'defaults'
            }
        ];
    }

    static getMetadata() {
        return {
            name: 'Telegram',
            description: 'Send messages via Telegram Bot API',
            group: 'chat',
            type: 'TELEGRAM'
        };
    }

    constructor(config) {
        this.config = config;
        this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
    }

    async validateConfig() {
        try {
            const response = await fetch(`${this.baseUrl}/getMe`);
            const data = await response.json();

            if (data.ok) {
                return {
                    success: true,
                    message: `Valid! Connected as @${data.result.username}`,
                    canValidate: true
                };
            } else {
                return {
                    success: false,
                    message: data.description || 'Invalid Bot Token',
                    canValidate: true
                };
            }
        } catch (err) {
            return {
                success: false,
                message: err.message,
                canValidate: true
            };
        }
    }

    async sendMail({ to, subject, body, data, idempotencyKey }) {
        try {
            const chatId = to || this.config.defaultChatId;

            if (!chatId) {
                return {
                    success: false,
                    error: 'No Chat ID provided (in "to" field) and no default Chat ID configured.',
                    isTemporary: false
                };
            }

            // Construct message text from subject and body
            // Telegram supports basic HTML
            let text = '';
            // If subject exists, make it bold
            if (subject) {
                text += `<b>${subject}</b>\n\n`;
            }
            if (subject) {
                text += `<b>${subject}</b>\n\n`;
            }
            text += this._sanitizeHtml(body);


            // Prepare payload
            const payload = {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: data && data._disableWebPagePreview ? true : false
            };

            const response = await fetch(`${this.baseUrl}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.ok) {
                return {
                    success: true,
                    id: result.result.message_id.toString()
                };
            } else {
                // Handle Telegram errors
                const errorCode = result.error_code;
                const isTemporary = [429, 500, 502, 503, 504].includes(errorCode);

                return {
                    success: false,
                    error: result.description,
                    isTemporary
                };
            }
        } catch (err) {
            return {
                success: false,
                error: err.message,
                isTemporary: true
            };
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/getMe`);
            const data = await response.json();
            if (data.ok) {
                return 'HEALTHY';
            }
            return 'UNHEALTHY';
        } catch {
            return 'UNHEALTHY';
        }
    }

    async webhook(event, headers) {
        // Telegram webhooks are for receiving messages.
        // If ThorMail expects status updates, Telegram doesn't provide them via webhook for regular messages in this context.
        return null;
    }

    /**
     * Sanitizes HTML to only allow Telegram-supported tags.
     * Converts block elements to newlines.
     * 
     * Supported tags: <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <a>, <code>, <pre>
     */
    _sanitizeHtml(html) {
        if (!html) return '';

        // 1. Replace <br> and <br/> with newline
        let sanitized = html.replace(/<br\s*\/?>/gi, '\n');

        // 2. Replace block tags (open and close) with newline to preserve structure
        sanitized = sanitized.replace(/<\/?(div|p|h[1-6]|li|ul|ol|blockquote)[^>]*>/gi, '\n');

        // 3. Strip all tags EXCEPT allowed ones
        // Allowed: b, strong, i, em, u, ins, s, strike, del, a, code, pre
        // We use a regex that matches any tag, and check if it's in the whitelist.
        sanitized = sanitized.replace(/<(\/?)(\w+)([^>]*)>/g, (match, close, tag, attrs) => {
            const lowerTag = tag.toLowerCase();
            const allowedTags = [
                'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre'
            ];

            if (allowedTags.includes(lowerTag)) {
                // For <a> tag, we want to allow href attribute
                if (lowerTag === 'a') {
                    // Simple extraction of href to avoid XSS or other attributes, though Telegram is safe-ish.
                    // However, we'll just keep the original tag string for simplicity as Telegram parses it safely.
                    // But to be cleaner, we could reconstruct it. For now, returning match is valid for Telegram.
                    return match;
                }
                // For other tags, stripping attributes is safer/cleaner as they don't support them anyway (except class/style which are ignored)
                // But code/pre might have class for language. Telegram ignores it.
                // We'll return the match as is because stripping attributes accurately with regex is hard.
                return match;
            }

            // If not allowed, return empty string (strip tag, keep content)
            return '';
        });

        // 4. Decode HTML entities if necessary? 
        // Telegram expects raw text with tags. 
        // If the input HTML has &lt;b&gt; it will be treated as literal <b>.
        // If it has <b>, it is bold.
        // Usually Body comes as real HTML.

        // 5. Trim extra newlines
        // Replace multiple newlines with double newline max
        sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

        return sanitized.trim();
    }
}
