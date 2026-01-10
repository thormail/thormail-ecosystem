<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://thormail.io/Banner.png">
    <source media="(prefers-color-scheme: light)" srcset="https://thormail.io/Banner.png">
    <img alt="ThorMail Logo" src="https://thormail.io/Banner.png" width="600">
  </picture>
</p>

<h1 align="center">ThorMail Ecosystem</h1>

<p align="center">
  <strong>The God of Deliveries</strong> — High-performance, intelligent delivery orchestrator for email, SMS, push notifications, and webhooks.
</p>

<p align="center">
  <a href="https://thormail.io">Website</a> •
  <a href="https://docs.thormail.io">Documentation</a> •
  <a href="https://docs.thormail.io/getting-started/quick-start/">Getting Started</a> •
  <a href="/CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://docs.thormail.io"><img src="https://img.shields.io/badge/Docs-docs.thormail.io-purple" alt="Documentation"></a>
  <a href="https://www.npmjs.com/org/thormail"><img src="https://img.shields.io/badge/NPM-%40thormail-CB3837?logo=npm&logoColor=white" alt="NPM Org"></a>
</p>

---

## ⚡ What is ThorMail?

**ThorMail** is a self-hosted message delivery orchestrator designed to be the intelligent bridge between your application and any delivery provider. Whether you're sending transactional emails, SMS, push notifications, or webhooks, ThorMail routes and manages delivery through your chosen adapters with extreme speed and reliability.

> **Note:** ThorMail does not deliver messages directly to the final recipient. Instead, it routes and manages delivery through your configured adapters (SendGrid, AWS SES, Twilio, SMTP, etc.).

### Key Highlights

- 🚀 **Extreme Speed** — Ultra-fast asynchronous API with responses in milliseconds
- ⚡ **Automatic Failover** — Configure multiple adapters with priority-based routing
- 🔌 **Zero Vendor Lock-in** — Switch providers instantly, no code changes required
- 🔒 **Self-Hosted & Secure** — Your data never leaves your infrastructure
- 📦 **Multi-Channel** — Email, SMS, Push Notifications, Webhooks, and more

---

## 📂 Repository Structure

This monorepo contains the open-source ecosystem components for ThorMail:

```
thormail-ecosystem/
├── Adapters/               # Provider adapter packages (NPM modules)
│   └── thormail-adapter-*  # Community & official adapters
├── Clients/                # SDK clients for various platforms
│   ├── js/                 # Official Node.js client (@thormail/client)
│   └── wordpress/          # Official WordPress plugin
├── Dockers/                # Docker images for the ecosystem
│   └── Postgres18/         # PostgreSQL 18 with pg_partman
└── .github/                # Issue templates & security policy
```

### What's Included

| Component | Description |
|-----------|-------------|
| **Adapters** | Modular provider integrations (SMTP, SendGrid, Twilio, etc.) that translate ThorMail requests into provider-specific API calls |
| **Clients** | Official SDK clients for Node.js and WordPress to interact with your ThorMail instance |
| **Docker Images** | Pre-configured PostgreSQL image optimized for high-throughput delivery workloads |

### What's NOT Included

The **ThorMail Core** (Backend, Worker, and Dashboard) is distributed separately as compiled Docker images and is subject to its own proprietary license. Visit [thormail.io](https://thormail.io) for more information.

---

## 🚀 Getting Started

### Prerequisites

- Docker Engine 20.10+
- A running ThorMail Core instance (Backend, Worker, Dashboard)

### Installation

For complete installation instructions, including Core setup, visit the **[Official Documentation](https://docs.thormail.io/getting-started/installation)**.

### Quick Start with the Node.js Client

[![npm version](https://img.shields.io/npm/v/@thormail/client.svg?style=flat-square)](https://www.npmjs.com/package/@thormail/client)

```bash
npm install @thormail/client
```

```javascript
import { ThorMailClient } from '@thormail/client';

const client = new ThorMailClient({
  baseUrl: 'https://api.your-thormail-server.com',
  workspaceId: 'your-workspace-id',
  apiKey: 'your-api-key'
});

// Send an email
const result = await client.send({
  to: 'user@example.com',
  subject: 'Welcome to ThorMail!',
  body: '<h1>Hello {{name}}!</h1>',
  data: { name: 'John' }
});

console.log('Queued with ID:', result.id);
```

> ⚠️ **Security Warning:** The Node.js client is designed for server-side use only. Never expose your API key in client-side code.

---

## 📦 Available Packages

### Official Adapters

> **Note:** "Official" means these adapters are developed and maintained by the ThorMail team. They are **not** affiliated with or endorsed by the service providers themselves (e.g., OneSignal, SendGrid, etc.).

| Package | Description | NPM |
|---------|-------------|-----|
| `thormail-adapter-onesignal` | OneSignal Push Notifications | [![npm](https://img.shields.io/npm/v/thormail-adapter-onesignal)](https://www.npmjs.com/package/thormail-adapter-onesignal) |
| `thormail-adapter-resend` | Resend Email API | [![npm](https://img.shields.io/npm/v/thormail-adapter-resend)](https://www.npmjs.com/package/thormail-adapter-resend) |
| `thormail-adapter-ses` | Amazon SES | [![npm](https://img.shields.io/npm/v/thormail-adapter-ses)](https://www.npmjs.com/package/thormail-adapter-ses) |
| `thormail-adapter-smtp` | Custom SMTP Server | [![npm](https://img.shields.io/npm/v/thormail-adapter-smtp)](https://www.npmjs.com/package/thormail-adapter-smtp) |
| `thormail-adapter-telegram` | Telegram Bot API | [![npm](https://img.shields.io/npm/v/thormail-adapter-telegram)](https://www.npmjs.com/package/thormail-adapter-telegram) |

### Official Clients

| Package | Platform | NPM |
|---------|----------|-----|
| `@thormail/client` | Node.js | [![npm](https://img.shields.io/npm/v/@thormail/client)](https://www.npmjs.com/package/@thormail/client) |
| `thormail` | WordPress | [WordPress Plugin](Clients/wordpress/thormail) |

### Docker Images

| Image | Description | Docker Hub |
|-------|-------------|------------|
| `thormail/postgres-thormail` | PostgreSQL 18 + pg_partman | [![Docker](https://img.shields.io/docker/v/thormail/postgres-thormail?label=Docker%20Hub)](https://hub.docker.com/r/thormail/postgres-thormail) |

---

## 🔌 Creating Custom Adapters

ThorMail's modular adapter system allows you to connect to any provider. Adapters are NPM packages that follow a standardized interface.

### Naming Convention

```
thormail-adapter-{provider-name}
```

### Basic Adapter Structure

```javascript
// index.js
export default class MyServiceAdapter {
  static getConfigSchema() {
    return [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      { name: 'from_email', label: 'From Email', type: 'text', required: true }
    ];
  }

  static getMetadata() {
    return {
      name: 'My Service',
      description: 'Send messages via MyService API'
    };
  }

  constructor(config) {
    this.config = config;
  }

  async sendMail({ to, subject, body, data }) {
    // Your implementation here
    return { success: true, id: 'message-id' };
  }

  async validateConfig() {
    return { success: true, message: 'Valid!', canValidate: true };
  }

  async healthCheck() {
    return 'HEALTHY';
  }
}
```

For detailed instructions, see the [Official Adapter Documentation](https://docs.thormail.io/adapters/overview/).

---

## 🔒 Security

If you discover a security vulnerability, please **do not** report it in a public issue.

📧 **Email:** [security@thormail.io](mailto:security@thormail.io)

We will acknowledge receipt within 48 hours and follow responsible disclosure practices.

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're creating a new adapter, improving documentation, or fixing bugs, your help is appreciated.

1. **Discuss First:** Open a [Discussion](https://github.com/thormail/thormail-ecosystem/discussions) before major changes
2. **Follow Guidelines:** Read our [Contributing Guide](CONTRIBUTING.md)
3. **Test Thoroughly:** Ensure your code works in a non-production environment
4. **Submit PR:** Open a pull request with clear descriptions

### Bug Reports & Feature Requests

Use our [Issue Templates](https://github.com/thormail/thormail-ecosystem/issues/new/choose):

- 🐛 **Adapter Bug** — Issues specific to an adapter
- 🔧 **Core Issue** — Orchestrator logic bugs (include Docker version)
- ✨ **Feature Request** — New functionality proposals

---

## 📜 License

This repository is licensed under the **[MIT License](LICENSE)**.

> **Important:** This license applies exclusively to the open-source adapters, clients, and documentation in this repository. The ThorMail Core (distributed as compiled Docker images) is NOT covered by this license and is subject to its own proprietary End-User License Agreement (EULA).

See [LEGAL.md](LEGAL.md) for full legal information and disclaimers.

---

## 📚 Resources

- 🌐 **Website:** [thormail.io](https://thormail.io)
- 📖 **Documentation:** [docs.thormail.io](https://docs.thormail.io)
- 📧 **Security:** [security@thormail.io](mailto:security@thormail.io)

---

<p align="center">
  <strong>ThorMail: Orchestrating the future, one delivery at a time.</strong>
</p>
