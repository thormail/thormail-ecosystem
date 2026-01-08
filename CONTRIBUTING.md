# Contributing to ThorMail Ecosystem 🔌

First off, thank you for considering contributing to the ThorMail Ecosystem! It is through community-driven adapters that ThorMail becomes a truly agnostic and powerful orchestrator

By contributing to this repository, you agree to abide by our [LEGAL.md](./LEGAL.md) and license terms.

---

## 🛠 Technical Requirements for Adapters

To ensure compatibility with the ThorMail Core, all adapters must follow these technical constraints:

### 1. Interface Contract

Every adapter must implement the standard ThorMail Interface. This ensures the Core can orchestrate different services (Email, SMS, Webhooks) using a predictable communication pattern

* **Input Validation:** Adapters must validate the incoming payload against the service's specific requirements before attempting an external call.
* **Error Handling:** Standardized error codes must be returned to the Core so it can decide whether to retry or fail the task.

### 2. Zero-Access Security

* **No Telemetry:** Adapters must never transmit user data, logs, or credentials to any destination other than the intended service provider.

---

## 🚀 How to Propose a New Adapter

1. **Open a Discussion:** Before writing code, please open a [New Adapter Request](https://github.com/thormail/thormail-ecosystem/discussions/new?category=new-adapter-requests) to discuss the scope and requirements.
2. **Use the Template:** Follow the standardized directory structure for new packages.
3. **Documentation:** Every adapter must include its own `README.md` explaining:
    * Supported functionalities (e.g., Send, Batch, Template support).
    * Specific service provider limitations.

---

## 🐛 Reporting Bugs & Enhancements

Please use our [Issue Templates](https://github.com/thormail/thormail-ecosystem/issues/new/choose) for all reports:

* **Adapter Bugs:** Issues specific to a connector's logic.
* **Core Issues:** If you suspect a bug in the orchestrator logic (please provide Docker version).
* **Security:** **Do not report security vulnerabilities in public issues.** Email us at **<security@thormail.com>**

---

## ⚖️ Legal Agreement

By submitting a Pull Request (PR) to this repository, you acknowledge that:

1. Your contribution will be licensed under the [MIT License](./LICENSE)
2. You have tested the code in a non-production environment.
3. You are responsible for the code you submit and ensure it does not violate any third-party terms of service

---
*ThorMail: Orchestrating the future, one adapter at a time.*
