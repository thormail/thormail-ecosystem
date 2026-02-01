=== ThorMail Client ===
Contributors: jodacame
Tags: email, transactional, thormail, api, smtp
Requires at least: 5.7
Tested up to: 6.9
Stable tag: 1.0.3
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

The Ultimate Delivery Platform. Official WordPress client for ThorMail (Self-Hosted). Connect your WordPress site to your own email infrastructure.

== Description ==

**IMPORTANT:** This plugin is a **client** implementation. To use it, you must have a running instance of **ThorMail** installed on your own server.

ThorMail is the Ultimate Delivery Platform. A high-performance, intelligent delivery infrastructure designed for scale, speed, and absolute reliability. This plugin seamlessly connects your WordPress site to your private ThorMail server, allowing you to bypass default wp_mail() limitations and wield sending power previously reserved for enterprise giants.

For installation instructions and documentation, please visit [docs.thormail.io](https://docs.thormail.io).
To learn more about the project, visit [thormail.io](https://thormail.io).

**Why ThorMail?**

*   **Lightning Speed:** Engineered for zero latency. Process millions of messages with unparalleled efficiency using asynchronous background processing.
*   **Unbreakable Uptime:** Built with automatic failover. If one provider fails (e.g., SES), ThorMail instantly switches to your backup (e.g., SMTP or SendGrid).
*   **Radical Provider Freedom:** Break the chains of Vendor Lock-in. Switch providers with a single click without changing a line of code in WordPress.
*   **Sovereign Security:** Your data, your infrastructure. Keep your email logs and templates on your own servers. GDPR compliant by design.
*   **Intelligent Routing:** Define priority rules to route transactional emails via high-deliverability paths and marketing emails via bulk providers.

== Installation ==

1.  Ensure you have a ThorMail server instance running (see [thormail.io](https://thormail.io)).
2.  Upload the `thormail` folder to the `/wp-content/plugins/` directory.
3.  Activate the plugin through the 'Plugins' menu in WordPress.
4.  Go to **Settings > ThorMail**.
5.  Enter your **Self-Hosted API URL**, Workspace ID, and API Key.

== Frequently Asked Questions ==

= Where do I find my API Key? =
Log in to your ThorMail dashboard, select your workspace, and navigate to the Developers Zone.

= Does this support attachments? =
Not in version 1.0.0. Basic transactional emails (HTML/Text) are supported.

== Screenshots ==

1. Settings page configuration.

== Changelog ==

= 1.0.0 =
*   Initial release.
