# Email Provider Adapters Developer Guide

This directory contains the adapter classes for various email providers. ThorMail uses an adapter pattern to standardized how the system interacts with external email services (SMTP, AWS SES, SendGrid, etc.).

## 📖 Overview

Every provider integration in ThorMail is an **Adapter**. An adapter is a Javascript class that translates ThorMail's standardized internal requests into the specific API calls required by a provider (Email, SMS, etc.).

The lifecycle of an adapter involves two main parts:

1. **Backend (Configuration)**: The adapter defines its own configuration form schema (`getConfigSchema`), which the frontend renders dynamically.
2. **Worker (Execution)**: The adapter is instantiated with the saved configuration and used to send emails (`sendMail`).

## 🛠️ Interface Reference

To create a valid adapter, your class must implement the following methods.

### Static Methods

#### `static getConfigSchema()`

Defines the form fields that the user will see in the UI when configuring this provider.

* **Returns**: `Array<Object>` - A list of field definitions.
* **Field Properties**:
  * `name`: (string) The key used to store the value in the JSON config.
  * `label`: (string) logic key for translation or human-readable label.
  * `type`: (string) `text`, `password`, `number`, `boolean`, `select`, `textarea`, `json-template`.
  * `required`: (boolean)
  * `placeholder`: (string) Placeholder text for inputs.
  * `hint`: (string) Help text displayed below the input.
  * `options`: (Array<string>) Required if type is `select`.
  * `group`: (string) Optional grouping for the field (e.g., 'provider_groups.marketing').

**Recommended Fields**:

* `custom_name`: (text) Allow users to name this instance (e.g., "Marketing SendGrid").
* `from_email`: (text) Default sender address.
* `from_name`: (text) Default sender name.

#### `static getMetadata()`

Provides metadata for the adapter registry.

* **Returns**: `Object`
  * `name`: (string) Display name.
  * `description`: (string) Description key or text.
  
**Guidelines**:

* Use the official provider name.
* Keep descriptions short (1-2 sentences).
* Do not include setup instructions here.
  
---

### Instance Methods

#### `constructor(config)`

Initializes the adapter instance.

* **config**: `Object` - The configuration object containing the values captured by the `getConfigSchema` form (e.g., `apiKey`, `host`, `user`).

**Best Practice**:
Do NOT perform network validation in the constructor. Save it for `validateConfig` to ensure fast initialization.

#### `async validateConfig()`

Validates that the provided configuration works (e.g., by making a "ping" or "verify credentials" API call).

* **Returns**: `Promise<Object>`
  * `success`: (boolean)
  * `message`: (string) Success or error message.
  * `canValidate`: (boolean) `true` if this adapter supports validation logic.

#### `async sendMail({ to, subject, body, data, idempotencyKey })`

The core method to dispatch a message (Email, SMS, Push, etc.).

* **Parameters**:
  * `to`: (string) Recipient address (Email, Phone number, Device Token, etc.).
  * **`subject`**: (string) Message title or subject (optional for some channels like SMS).
  * **`body`**: (string) Main content of the message. This can be plain text, HTML, or a template string. ThorMail automatically compiles this using the values in `data` before calling the adapter.
  * **`data`**: (Object) Optional object containing variable substitutions (e.g., `{ name: "John" }`) or provider-specific options.
  * **`idempotencyKey`**: (string) Unique key for the job (useful for preventing duplicate sends if the provider supports it).

**Advanced Usage (`data`)**:
The `data` object allows passing provider-specific options or using server-side templates.

* **Provider Templates**: Pass `_useProviderTemplate: true` and `_templateId` to skip ThorMail rendering and use the provider's template engine.
* **Custom Metadata**: Pass custom headers or tracking tags (e.g., `_tags: ['newsletter']`).
* **Variables**: Any other keys in `data` are treated as template variables.
* **Returns**: `Promise<Object>`
  * `success`: (boolean)
  * `id`: (string) The provider's unique message ID.
  * `response`: (any) The raw response from the provider (optional).
  * `error`: (string) Error message if failed.
  * `isTemporary`: (boolean) `true` if the failure is transient (e.g., rate limit, timeout) and should be retried.
    * **Temporary**: Rate Limits (429), Server Errors (5xx), Network Timeouts.
    * **Permanent**: Auth Errors (401/403), Invalid Usage (400), Payment Required (402).
  * `pauseDuration`: (number) Automatic pause in seconds. Use this if the provider indicates a rate limit or "cooling off" period (optional).
    * **Smart Pausing**: If returned, the worker stops pulling jobs for this provider for the specified duration but leads them in the queue. Auto-resumes afterwards.

#### `async webhook(event, headers)`

Processes incoming webhooks from the provider (delivery reports, bounces, etc.).

* **Parameters**:
  * `event`: (Object) The raw webhook payload (body).
  * `headers`: (Object) The request headers.
* **Returns**: `Promise<Object>`
  * `status`: (string) One of `'ACCEPTED'`, `'SOFT-REJECT'`, `'HARD-REJECT'`, `'OPENED'`, `'CLICKED'`, `'COMPLAINED'`.
  * `messageId`: (string) The provider-side message ID extracted from the event. This is CRITICAL for ThorMail to match the event to the sent message.

#### `async healthCheck()`

Checks if the external service is reachable and healthy.

* **Returns**: `Promise<string>` - one of `'HEALTHY'`, `'DEGRADED'`, `'UNHEALTHY'`.

---

## 🚀 Tutorial: creating a New Adapter

ThorMail supports external adapters loaded via NPM. To keep the core lightweight, custom or community adapters should be created as separate NPM packages.

### 1. Naming Convention

Your package **MUST** follow this naming convention:
`thormail-adapter-{name}`

Example: `thormail-adapter-myservice`

**Important**: ThorMail uses this naming convention (`thormail-adapter-*`) to automatically discover available adapters in the NPM registry. If your package does not follow this convention, it will not appear in the search results within the application.

### 2. Project Structure

Initialize a new NPM project:

```bash
mkdir thormail-adapter-myservice
cd thormail-adapter-myservice
npm init -y
```

Your `package.json` should look like this (ensure you set `type: "module"`):

```json
{
  "name": "thormail-adapter-myservice",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "peerDependencies": {
    "thormail": "*"
  },
  "keywords": [
    "thormail",
    "thormail-adapter",
    "email"
  ]
}
```

### 3. Implement the Adapter

Create your `index.js` file and export your adapter class as the **default export**.

```javascript
// index.js
export default class MyServiceAdapter {
    static getConfigSchema() {
        return [
            {
                name: 'apiKey',
                label: 'API Key',
                type: 'password',
                required: true
            },
            {
                name: 'from_email',
                label: 'From Email',
                type: 'text',
                required: true
            }
        ];
    }

    static getMetadata() {
        return {
            name: 'My Service',
            description: 'Send emails via MyService API',
            group: 'provider_groups.marketing'
        };
    }

    constructor(config) {
        this.config = config;
    }

    async validateConfig() {
        // ... (implementation)
        return { success: true, message: "Valid!", canValidate: true };
    }

    async sendMail({ to, subject, body, data }) {
         // ... (implementation)
         return { success: true, id: "123" };
    }

    async webhook(event, headers) {
        // ... (implementation)
        return { status: "ACCEPTED", messageId: "123" };
    }
    
    async healthCheck() {
        return "HEALTHY";
    }
}
```

### 4. Publish to NPM

Once your adapter is ready, publish it to the NPM registry:

```bash
npm publish --access public
```

### 5. Install in ThorMail

1. Go to the **Adapters** section in your ThorMail instance.
2. Install your package by name: `thormail-adapter-myservice`.
3. The system will automatically detect the adapter, load it, and make it available in the **adapters** list.

### 6. Validation Requirements

To ensure stability and security, your adapter must meet the following criteria to be accepted by the system:

1. **Naming Convention**: The package name must start with `thormail-adapter-`.
2. **Valid Structure**: The default export must be a class implementing all required static and instance methods (`getConfigSchema`, `sendMail`, `webhook`, etc.).
3. **Minimal Dependencies**: Keep dependencies to a minimum to ensure lightweight execution.
4. **Code Integrity**: The source code must be clean, readable, and free of obfuscation or minification.
5. **Safety compliance**: The adapter must not attempt to access restricted system resources (file system, child processes, or unauthorized network calls).

## 🧪 Testing Your Adapter

You can test your adapter using the `DummyAdapter` logic as a reference or by setting up a local worker instance and triggering a test email via the UI.

1. Go to **Connections** in the UI.
2. Add a new connection and select your new provider (it should appear if registered in Backend's `providerManager`).
3. Fill in the form (generated from your `getConfigSchema`).
4. Click **Save & Test**. This triggers `validateConfig()`.
