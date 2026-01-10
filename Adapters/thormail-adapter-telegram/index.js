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
            let isMarkdown = data && data._isMarkdown;

            if (!chatId) {
                return {
                    success: false,
                    error: 'No Chat ID provided (in "to" field) and no default Chat ID configured.',
                    isTemporary: false
                };
            }

            // Auto-detect: if they say Markdown but it's actually HTML, use HTML mode
            if (isMarkdown && this._containsHtmlTags(body)) {
                isMarkdown = false;
            }

            // Construct message text from subject and body
            // Telegram supports basic HTML
            let text = '';
            // If subject exists, make it bold
            if (subject) {
                if (isMarkdown) {
                    text += `*${this._escapeMarkdownV2(subject)}*\n\n`;
                } else {
                    text += `<b>${subject}</b>\n\n`;
                }
            }
            if (isMarkdown) {
                text += this._sanitizeMarkdown(body);
            } else {
                text += this._sanitizeHtml(body);
            }


            // Prepare payload
            const payload = {
                chat_id: chatId,
                text: text,
                parse_mode: isMarkdown ? 'MarkdownV2' : 'HTML',
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
     * Detects if the text contains HTML tags.
     * Used to auto-switch from Markdown to HTML mode when needed.
     * 
     * @param {string} text - Text to check
     * @returns {boolean} True if HTML tags are detected
     */
    _containsHtmlTags(text) {
        if (!text) return false;
        // Match common HTML tags (opening or self-closing)
        // Looks for patterns like <tag>, <tag attr="value">, </tag>, <tag/>
        const htmlTagPattern = /<\/?(?:b|strong|i|em|u|ins|s|strike|del|a|code|pre|p|div|span|br|h[1-6]|ul|ol|li|blockquote|img|script|style)(?:\s[^>]*)?\/?>/i;
        return htmlTagPattern.test(text);
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

    /**
     * Escapes special characters for Telegram MarkdownV2.
     * Characters that must be escaped: _ * [ ] ( ) ~ ` > # + - = | { } . !
     * 
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    _escapeMarkdownV2(text) {
        if (!text) return '';
        // These characters must be escaped with \ in MarkdownV2
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
    }

    /**
     * Escapes characters inside code/pre blocks.
     * Inside pre and code entities, only ` and \ must be escaped.
     * 
     * @param {string} text - Text inside code block
     * @returns {string} Escaped text
     */
    _escapeMarkdownV2InCode(text) {
        if (!text) return '';
        return text.replace(/([`\\])/g, '\\$1');
    }

    /**
     * Escapes characters inside inline link URLs.
     * Inside (...) part of inline link, only ) and \ must be escaped.
     * 
     * @param {string} url - URL to escape
     * @returns {string} Escaped URL
     */
    _escapeMarkdownV2InLink(url) {
        if (!url) return '';
        return url.replace(/([)\\])/g, '\\$1');
    }

    /**
     * Sanitizes and converts standard Markdown to Telegram MarkdownV2 format.
     * Handles escaping of special characters while preserving formatting.
     * 
     * Supported MarkdownV2 features:
     * - *bold* 
     * - _italic_
     * - __underline__
     * - ~strikethrough~
     * - ||spoiler||
     * - `inline code`
     * - ```pre-formatted code```
     * - ```language code``` (with syntax highlighting)
     * - [text](url) - inline links
     * - > blockquote
     * 
     * @param {string} markdown - Standard markdown text
     * @returns {string} Telegram MarkdownV2 formatted text
     */
    _sanitizeMarkdown(markdown) {
        if (!markdown) return '';

        let result = markdown;

        // Store code blocks temporarily to prevent escaping inside them
        const codeBlocks = [];
        const inlineCodes = [];
        const links = [];

        // Use placeholders that won't be affected by escaping (using 0x00 null char as delimiter)
        const PH = '\x00';

        // Extract and protect fenced code blocks ```...```
        result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `${PH}CODEBLOCK${codeBlocks.length}${PH}`;
            const escapedCode = this._escapeMarkdownV2InCode(code.trim());
            if (lang) {
                codeBlocks.push(`\`\`\`${lang}\n${escapedCode}\`\`\``);
            } else {
                codeBlocks.push(`\`\`\`\n${escapedCode}\`\`\``);
            }
            return placeholder;
        });

        // Extract and protect inline code `...`
        result = result.replace(/`([^`]+)`/g, (match, code) => {
            const placeholder = `${PH}INLINECODE${inlineCodes.length}${PH}`;
            inlineCodes.push(`\`${this._escapeMarkdownV2InCode(code)}\``);
            return placeholder;
        });

        // Extract and protect markdown links [text](url)
        result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            const placeholder = `${PH}LINK${links.length}${PH}`;
            const escapedText = this._escapeMarkdownV2(text);
            const escapedUrl = this._escapeMarkdownV2InLink(url);
            links.push(`[${escapedText}](${escapedUrl})`);
            return placeholder;
        });

        // Store formatting markers temporarily
        const boldMarkers = [];
        const italicMarkers = [];
        const underlineMarkers = [];
        const strikeMarkers = [];
        const spoilerMarkers = [];

        // Extract bold **text** or __text__ (convert to *text*)
        result = result.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
            const placeholder = `${PH}BOLD${boldMarkers.length}${PH}`;
            boldMarkers.push({ text, placeholder });
            return placeholder;
        });

        // Extract italic *text* or _text_ (be careful not to conflict with underline)
        // In Telegram MarkdownV2, _text_ is italic
        result = result.replace(/(?<![_*])_([^_]+)_(?![_*])/g, (match, text) => {
            const placeholder = `${PH}ITALIC${italicMarkers.length}${PH}`;
            italicMarkers.push({ text, placeholder });
            return placeholder;
        });

        // Handle single asterisk italic
        result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (match, text) => {
            if (boldMarkers.some(b => b.text === text)) return match;
            const placeholder = `${PH}ITALIC2${italicMarkers.length}${PH}`;
            italicMarkers.push({ text, placeholder, useAsterisk: true });
            return placeholder;
        });

        // Extract underline (using custom syntax or HTML-style if needed)
        // Telegram uses __text__ for underline
        result = result.replace(/__([^_]+)__/g, (match, text) => {
            // Only if not already a bold marker
            if (boldMarkers.some(b => match.includes(b.placeholder))) return match;
            const placeholder = `${PH}UNDERLINE${underlineMarkers.length}${PH}`;
            underlineMarkers.push({ text, placeholder });
            return placeholder;
        });

        // Extract strikethrough ~~text~~
        result = result.replace(/~~([^~]+)~~/g, (match, text) => {
            const placeholder = `${PH}STRIKE${strikeMarkers.length}${PH}`;
            strikeMarkers.push({ text, placeholder });
            return placeholder;
        });

        // Extract spoiler ||text|| (already Telegram format)
        result = result.replace(/\|\|([^|]+)\|\|/g, (match, text) => {
            const placeholder = `${PH}SPOILER${spoilerMarkers.length}${PH}`;
            spoilerMarkers.push({ text, placeholder });
            return placeholder;
        });

        // Handle blockquotes (lines starting with >)
        const lines = result.split('\n');
        const processedLines = lines.map(line => {
            if (line.trim().startsWith('>')) {
                // Extract the quote content
                const quoteContent = line.replace(/^>\s*/, '');
                // Escape the content and add back the >
                return '>' + this._escapeMarkdownV2(quoteContent);
            }
            return this._escapeMarkdownV2(line);
        });
        result = processedLines.join('\n');

        // Restore spoiler markers with proper formatting
        spoilerMarkers.forEach(({ text, placeholder }) => {
            const escapedText = this._escapeMarkdownV2(text);
            result = result.replace(placeholder, `||${escapedText}||`);
        });

        // Restore strikethrough markers with proper formatting
        strikeMarkers.forEach(({ text, placeholder }) => {
            const escapedText = this._escapeMarkdownV2(text);
            result = result.replace(placeholder, `~${escapedText}~`);
        });

        // Restore underline markers with proper formatting
        underlineMarkers.forEach(({ text, placeholder }) => {
            const escapedText = this._escapeMarkdownV2(text);
            result = result.replace(placeholder, `__${escapedText}__`);
        });

        // Restore italic markers with proper formatting
        italicMarkers.forEach(({ text, placeholder }) => {
            const escapedText = this._escapeMarkdownV2(text);
            result = result.replace(placeholder, `_${escapedText}_`);
        });

        // Restore bold markers with proper formatting
        boldMarkers.forEach(({ text, placeholder }) => {
            const escapedText = this._escapeMarkdownV2(text);
            result = result.replace(placeholder, `*${escapedText}*`);
        });

        // Restore links
        links.forEach((link, i) => {
            const placeholder = `${PH}LINK${i}${PH}`;
            result = result.replace(placeholder, link);
        });

        // Restore inline codes
        inlineCodes.forEach((code, i) => {
            const placeholder = `${PH}INLINECODE${i}${PH}`;
            result = result.replace(placeholder, code);
        });

        // Restore code blocks
        codeBlocks.forEach((code, i) => {
            const placeholder = `${PH}CODEBLOCK${i}${PH}`;
            result = result.replace(placeholder, code);
        });

        return result.trim();
    }
}
