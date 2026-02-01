<?php
/**
 * Plugin Name:       ThorMail Client
 * Plugin URI:        https://github.com/thormail/thormail-ecosystem
 * Description:       Official WordPress client for self-hosted ThorMail servers. Connect to your private email infrastructure via API.
 * Version:           1.0.2
 * Requires at least: 5.7
 * Tested up to:      6.9
 * Requires PHP:      7.4
 * Author:            ThorMail Team
 * Author URI:        https://thormail.io
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       thormail
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'THORMAIL_VERSION', '1.0.2' );
define( 'THORMAIL_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'THORMAIL_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Include core classes
require_once THORMAIL_PLUGIN_DIR . 'includes/class-thormail-api.php';
require_once THORMAIL_PLUGIN_DIR . 'includes/class-thormail-admin.php';
require_once THORMAIL_PLUGIN_DIR . 'includes/class-thormail-mailer.php';

/**
 * Initialize the plugin
 */
function thormail_init() {
	// Initialize Admin
	if ( is_admin() ) {
		new ThorMail_Admin();
	}

	// Initialize Mailer Hook
    // Only if configured
    $options = get_option( 'thormail_settings' );
    if ( ! empty( $options['api_key'] ) && ! empty( $options['workspace_id'] ) && ! empty( $options['base_url'] ) ) {
        ThorMail_Mailer::get_instance();
    }
}
add_action( 'plugins_loaded', 'thormail_init' );

/**
 * Add settings link to plugin list
 */
function thormail_add_settings_link( $links ) {
	$settings_link = '<a href="options-general.php?page=thormail">' . esc_html__( 'Settings', 'thormail' ) . '</a>';
	array_unshift( $links, $settings_link );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'thormail_add_settings_link' );
