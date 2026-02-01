<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ThorMail_Admin
 * Handles the administrative interface.
 */
class ThorMail_Admin {
	private $option_name = 'thormail_settings';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menu_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'admin_post_thormail_send_test', array( $this, 'handle_test_email' ) );
        add_action( 'update_option_' . $this->option_name, array( $this, 'clear_health_cache' ) );
	}

    public function clear_health_cache() {
        delete_transient( 'thormail_health_check' );
    }


	public function enqueue_scripts( $hook ) {
		if ( 'settings_page_thormail' !== $hook ) {
			return;
		}
		wp_enqueue_style( 'thormail-admin-css', THORMAIL_PLUGIN_URL . 'assets/css/admin.css', array(), THORMAIL_VERSION );
	}

	public function add_menu_page() {
		add_options_page(
			'ThorMail Settings',
			'ThorMail',
			'manage_options',
			'thormail',
			array( $this, 'render_page' )
		);
	}

	public function register_settings() {
		register_setting( $this->option_name, $this->option_name, array( $this, 'sanitize_settings' ) );

		add_settings_section(
			'thormail_main_section',
			__( 'Configuration', 'thormail' ),
			null,
			'thormail'
		);

        add_settings_field(
            'thormail_enabled',
            __( 'Enable ThorMail', 'thormail' ),
            array( $this, 'field_enabled' ),
            'thormail',
            'thormail_main_section'
        );

		add_settings_field(
			'base_url',
			__( 'API Base URL', 'thormail' ),
			array( $this, 'field_base_url' ),
			'thormail',
			'thormail_main_section'
		);

		add_settings_field(
			'workspace_id',
			__( 'Workspace ID', 'thormail' ),
			array( $this, 'field_workspace_id' ),
			'thormail',
			'thormail_main_section'
		);

		add_settings_field(
			'api_key',
			__( 'API Key', 'thormail' ),
			array( $this, 'field_api_key' ),
			'thormail',
			'thormail_main_section'
		);

        add_settings_field(
            'adapter_id',
            __( 'Adapter ID (Optional)', 'thormail' ),
            array( $this, 'field_adapter_id' ),
            'thormail',
            'thormail_main_section'
        );

        add_settings_field(
            'template_id',
            __( 'Template ID (Optional)', 'thormail' ),
            array( $this, 'field_template_id' ),
            'thormail',
            'thormail_main_section'
        );

        add_settings_field(
            'body_key',
            __( 'Body Data Key (Optional)', 'thormail' ),
            array( $this, 'field_body_key' ),
            'thormail',
            'thormail_main_section'
        );
	}

	public function sanitize_settings( $input ) {
		$new_input = array();
        $new_input['thormail_enabled'] = isset( $input['thormail_enabled'] ) ? '1' : '0';
		if ( isset( $input['base_url'] ) ) {
			$new_input['base_url'] = esc_url_raw( $input['base_url'] );
		}
		if ( isset( $input['workspace_id'] ) ) {
			$new_input['workspace_id'] = sanitize_text_field( $input['workspace_id'] );
		}
		if ( isset( $input['api_key'] ) ) {
			$new_input['api_key'] = sanitize_text_field( $input['api_key'] );
		}
        if ( isset( $input['adapter_id'] ) ) {
            $new_input['adapter_id'] = sanitize_text_field( $input['adapter_id'] );
        }
        if ( isset( $input['template_id'] ) ) {
            $new_input['template_id'] = sanitize_text_field( $input['template_id'] );
        }
        if ( isset( $input['body_key'] ) ) {
            $new_input['body_key'] = sanitize_text_field( $input['body_key'] );
        }
		return $new_input;
	}

    public function field_enabled() {
        $options = get_option( $this->option_name );
        $val     = isset( $options['thormail_enabled'] ) ? $options['thormail_enabled'] : '0';
        ?>
        <label class="switch">
            <input type="checkbox" name="<?php echo esc_attr( $this->option_name ); ?>[thormail_enabled]" value="1" <?php checked( $val, '1' ); ?>>
            <span class="slider round"></span>
        </label>
        <p class="description"><?php esc_html_e( 'Route all emails through ThorMail.', 'thormail' ); ?></p>
        <?php
    }

	public function field_base_url() {
		$options = get_option( $this->option_name );
		$val     = isset( $options['base_url'] ) ? $options['base_url'] : '';
		echo "<input type='url' name='" . esc_attr( $this->option_name ) . "[base_url]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input' pPlaceholder='https://api.thormail.io'>";
		echo "<p class='description'>" . esc_html__( 'The base URL of the ThorMail API server.', 'thormail' ) . "</p>";
	}

	public function field_workspace_id() {
		$options = get_option( $this->option_name );
		$val     = isset( $options['workspace_id'] ) ? $options['workspace_id'] : '';
		echo "<input type='text' name='" . esc_attr( $this->option_name ) . "[workspace_id]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
	}

	public function field_api_key() {
		$options = get_option( $this->option_name );
		$val     = isset( $options['api_key'] ) ? $options['api_key'] : '';
		echo "<input type='password' name='" . esc_attr( $this->option_name ) . "[api_key]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
	}

    public function field_adapter_id() {
        $options = get_option( $this->option_name );
        $val     = isset( $options['adapter_id'] ) ? $options['adapter_id'] : '';
        echo "<input type='text' name='" . esc_attr( $this->option_name ) . "[adapter_id]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
        echo "<p class='description'>" . esc_html__( 'Optional. Force all emails to use a specific Adapter ID.', 'thormail' ) . "</p>";
    }

    public function field_template_id() {
        $options = get_option( $this->option_name );
        $val     = isset( $options['template_id'] ) ? $options['template_id'] : '';
        echo "<input type='text' name='" . esc_attr( $this->option_name ) . "[template_id]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
        echo "<p class='description'>" . esc_html__( 'Optional. Use a specific Template ID for emails.', 'thormail' ) . "</p>";
    }

    public function field_body_key() {
        $options = get_option( $this->option_name );
        $val     = isset( $options['body_key'] ) ? $options['body_key'] : '';
        echo "<input type='text' name='" . esc_attr( $this->option_name ) . "[body_key]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
        echo "<p class='description'>" . wp_kses_post( __( 'Optional. If set, puts the email body into <code>data[key]</code> instead of <code>body</code>. Useful for templates.', 'thormail' ) ) . "</p>";
    }

	public function render_page() {
		$options = get_option( $this->option_name );
		// Check if enabled + configured
		$is_configured = ! empty( $options['api_key'] ) && ! empty( $options['workspace_id'] ) && ! empty( $options['base_url'] );
        $is_enabled = isset( $options['thormail_enabled'] ) && $options['thormail_enabled'] === '1';
		
       if ( isset( $_GET['test_email'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
           $status = sanitize_text_field( wp_unslash( $_GET['test_email'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
           if ( 'success' === $status ) {
               echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Test email sent successfully!', 'thormail' ) . '</p></div>';
           } else {
               $error_msg = __( 'Failed to send test email. Check your settings or error logs.', 'thormail' );
               if ( isset( $_GET['error_message'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
                   $decoded = base64_decode( sanitize_text_field( wp_unslash( $_GET['error_message'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
                   if ( $decoded ) {
                       $error_msg .= ' <br/><strong>' . __( 'Error:', 'thormail' ) . '</strong> ' . esc_html( $decoded );
                   }
               }
               echo '<div class="notice notice-error is-dismissible"><p>' . wp_kses_post( $error_msg ) . '</p></div>';
           }
       }
		?>
        <div class="wrap thormail-wrap">
            <div class="thormail-header">
                <div class="thormail-logo">
                    <img src="<?php echo esc_url( THORMAIL_PLUGIN_URL . 'assets/images/logo-text-dark.png' ); ?>" alt="ThorMail" style="height: 50px;">
                </div>
                <div class="thormail-header-actions">
                    <div class="thormail-status <?php echo ( $is_configured && $is_enabled ) ? 'active' : 'inactive'; ?>">
						<?php 
                        if ( ! $is_configured ) {
                            esc_html_e( 'Missing Configuration', 'thormail' );
                        } elseif ( ! $is_enabled ) {
                            esc_html_e( 'Disabled', 'thormail' );
                        } else {
                            esc_html_e( 'Active', 'thormail' );
                        }
                        ?>
                    </div>
                </div>
            </div>

            <div class="thormail-container">
                <div class="thormail-main">
                    <form action="options.php" method="post" class="thormail-card">
                        <div class="thormail-card-header">
                            <h2><?php esc_html_e( 'Settings', 'thormail' ); ?></h2>
                            <p><?php esc_html_e( 'Configure your ThorMail connection details below.', 'thormail' ); ?></p>
                        </div>
						<?php
						settings_fields( $this->option_name );
						do_settings_sections( 'thormail' );
						submit_button( __( 'Save Changes', 'thormail' ) );
						?>
                    </form>

					<?php if ( $is_configured ) : ?>
                        <div class="thormail-card thormail-test-email">
                            <div class="thormail-card-header">
                                <h3><?php esc_html_e( 'Send Test Email', 'thormail' ); ?></h3>
                                <p><?php esc_html_e( 'Send a test email to verify your configuration.', 'thormail' ); ?></p>
                            </div>
                            <form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post">
                                <input type="hidden" name="action" value="thormail_send_test">
								<?php wp_nonce_field( 'thormail_test_email' ); ?>
                                <div class="thormail-form-row">
                                    <label for="thormail_to"><?php esc_html_e( 'To:', 'thormail' ); ?></label>
                                    <input type="email" name="thormail_to" id="thormail_to" value="<?php echo esc_attr( wp_get_current_user()->user_email ); ?>" class="regular-text" style="width: 100%;">
                                </div>
                                <div class="thormail-form-row">
                                    <label for="thormail_body"><?php esc_html_e( 'Body (HTML):', 'thormail' ); ?></label>
                                    <textarea name="thormail_body" id="thormail_body" rows="6" class="large-text code"><h1>Test Email</h1><p>This is a <strong>test</strong> email from ThorMail.</p></textarea>
                                </div>
								<?php submit_button( __( 'Send Test', 'thormail' ), 'secondary' ); ?>
                            </form>
                        </div>
					<?php endif; ?>
                </div>

                <div class="thormail-sidebar">
                    <?php if ( $is_configured ) : ?>
                        <?php
                        // Health Check Logic
                        $health_status = get_transient( 'thormail_health_check' );
                        if ( false === $health_status ) {
                             $api = new ThorMail_API();
                             $health_response = $api->get_health();
                             if ( ! is_wp_error( $health_response ) && isset( $health_response['status'] ) && 'ok' === $health_response['status'] ) {
                                 $health_status = $health_response;
                                 set_transient( 'thormail_health_check', $health_status, 60 ); // Cache for 1 minute
                             } else {
                                 // Cache error/invalid state briefly to avoid hammering
                                 set_transient( 'thormail_health_check', 'error', 60 );
                                 $health_status = 'error';
                             }
                        }
                        
                        $is_healthy = is_array($health_status) && isset($health_status['status']) && $health_status['status'] === 'ok';
                        ?>
                        
                        <div class="thormail-card thormail-info-card thormail-status-card">
                            <h3><?php esc_html_e( 'ThorMail Service Status', 'thormail' ); ?></h3>
                            <?php if ( $is_healthy ) : ?>
                                <div class="thormail-system-status safe">
                                    <span class="dashicons dashicons-yes-alt"></span> <strong><?php esc_html_e( 'All Systems Operational', 'thormail' ); ?></strong>
                                </div>
                                <ul class="thormail-service-list">
                                    <?php if ( isset( $health_status['services'] ) ) : ?>
                                        <?php foreach ( $health_status['services'] as $service => $info ) : ?>
                                            <li>
                                                <span><?php echo esc_html( $service ); ?></span>
                                                <span class="thormail-status-ok"><?php echo esc_html( isset($info['status']) ? $info['status'] : 'OK' ); ?></span>
                                            </li>
                                        <?php endforeach; ?>
                                    <?php endif; ?>
                                </ul>
                                <div class="thormail-status-timestamp">
                                    <?php echo esc_html( isset($health_status['timestamp']) ? date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), strtotime( $health_status['timestamp'] ) ) : '' ); ?>
                                </div>
                            <?php else : ?>
                                 <div class="thormail-system-status error">
                                    <span class="dashicons dashicons-warning"></span> <strong><?php esc_html_e( 'System Unreachable', 'thormail' ); ?></strong>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <div class="thormail-card thormail-info-card">
                        <h3><?php esc_html_e( 'About ThorMail', 'thormail' ); ?></h3>
                        <p><?php esc_html_e( 'ThorMail is a powerful email delivery service designed for developers and businesses.', 'thormail' ); ?></p>
                        
                        <h4><?php esc_html_e( 'Why ThorMail?', 'thormail' ); ?></h4>
                        <ul class="thormail-feature-list">
                            <li><span class="dashicons dashicons-randomize"></span> <?php esc_html_e( 'Automatic Failovers', 'thormail' ); ?></li>
                            <li><span class="dashicons dashicons-unlock"></span> <?php esc_html_e( 'No Vendor Lock-in', 'thormail' ); ?></li>
                            <li><span class="dashicons dashicons-performance"></span> <?php esc_html_e( 'Infinite Scalability', 'thormail' ); ?></li>
                            <li><span class="dashicons dashicons-chart-bar"></span> <?php esc_html_e( 'Detailed Analytics', 'thormail' ); ?></li>
                        </ul>

                        <div class="thormail-actions">
                            <a href="https://thormail.io" target="_blank" class="button button-primary thormail-btn-block">
                                <?php esc_html_e( 'Visit Official Website', 'thormail' ); ?> <span class="dashicons dashicons-external"></span>
                            </a>
                            <a href="https://docs.thormail.io" target="_blank" class="button thormail-btn-block">
                                <?php esc_html_e( 'Read Documentation', 'thormail' ); ?> <span class="dashicons dashicons-book"></span>
                            </a>
                            <a href="https://github.com/thormail/thormail-ecosystem/" target="_blank" class="button thormail-btn-block">
                                <?php esc_html_e( 'Get Support', 'thormail' ); ?> <span class="dashicons dashicons-sos"></span>
                            </a>
                        </div>
                    </div>
                    
                    <div class="thormail-card thormail-info-card thormail-version-card">
                        <h3><?php esc_html_e( 'Need Help?', 'thormail' ); ?></h3>
                        <p><?php esc_html_e( 'Check out our comprehensive guides to get the most out of ThorMail.', 'thormail' ); ?></p>
                         <p class="thormail-footer-link">Running Version <?php echo esc_html( THORMAIL_VERSION ); ?></p>
                    </div>
                </div>
            </div>
        </div>
		<?php
	}

	public function handle_test_email() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		check_admin_referer( 'thormail_test_email' );

		$to = isset( $_POST['thormail_to'] ) ? sanitize_email( wp_unslash( $_POST['thormail_to'] ) ) : '';
		if ( empty( $to ) ) {
			wp_die( 'Invalid email' );
		}

		$subject = 'ThorMail Test Email';
        $body_content = isset( $_POST['thormail_body'] ) ? wp_kses_post( wp_unslash( $_POST['thormail_body'] ) ) : '';
        if ( empty( $body_content ) ) {
		    $message = "Congratulations! \n\nThis is a test email from ThorMail WordPress Plugin.\n\nTime: " . current_time( 'mysql' );
            $headers = array( 'Content-Type: text/plain' );
        } else {
            $message = $body_content;
            $headers = array( 'Content-Type: text/html' );
        }

		$sent = wp_mail( $to, $subject, $message, $headers );

		// Redirect back
		$query_args = array( 'page' => 'thormail' );
		if ( $sent ) {
			$query_args['test_email'] = 'success';
		} else {
			$query_args['test_email'] = 'error';
            $mailer = ThorMail_Mailer::get_instance();
            $last_error = $mailer->get_last_error();
            
			if ( ! empty( $last_error ) ) {
				$query_args['error_message'] = base64_encode( $last_error );
			}
		}

		wp_safe_redirect( add_query_arg( $query_args, admin_url( 'options-general.php' ) ) );
		exit;
	}
}
