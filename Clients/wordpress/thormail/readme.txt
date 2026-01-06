=== ThorMail Client ===
Contributors: thormail
Tags: email, transactional, thormail, api, smtp, self-hosted
Requires at least: 5.7
Tested up to: 6.9
Stable tag: 1.0.0
Requires PHP: 7.4
License: MIT
License URI: https://opensource.org/licenses/MIT

Official WordPress client for ThorMail (Self-Hosted). Connect your WordPress site to your own email infrastructure.

== Description ==

**IMPORTANT:** This plugin is a **client** implementation. To use it, you must have a running instance of **ThorMail** installed on your own server.

ThorMail is a self-hosted, high-performance email delivery API (similar to SendGrid or Mailgun, but on your own infrastructure). This plugin connects your WordPress site to your private ThorMail server, allowing you to bypass default wp_mail() limitations and ensure reliable delivery.

For more information on how to deploy your own ThorMail server, please visit [thormail.io](https://thormail.io).

**Features:**

*   **Self-Hosted Power:** Complete control over your email data and infrastructure.
*   **Performance:** Offload email processing to your ThorMail instance.
*   **Resilient:** Built-in retry logic to handle network interruptions.
*   **Simple Integration:** Route all WP emails through your API just by configuring your endpoint.

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
