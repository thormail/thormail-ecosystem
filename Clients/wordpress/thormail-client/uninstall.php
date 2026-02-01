<?php
/**
 * Fired when the plugin is uninstalled.
 *
 * @package ThorMail
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Delete options
delete_option( 'thormail_settings' );
delete_transient( 'thormail_health_check' );

// Clear any scheduled hooks if we had them (not currently used, but good practice)
wp_clear_scheduled_hook( 'thormail_cron_event' );
