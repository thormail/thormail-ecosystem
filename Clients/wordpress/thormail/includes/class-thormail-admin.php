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
		return $new_input;
	}

    public function field_enabled() {
        $options = get_option( $this->option_name );
        $val     = isset( $options['thormail_enabled'] ) ? $options['thormail_enabled'] : '0';
        ?>
        <label class="switch">
            <input type="checkbox" name="<?php echo $this->option_name; ?>[thormail_enabled]" value="1" <?php checked( $val, '1' ); ?>>
            <span class="slider round"></span>
        </label>
        <p class="description"><?php _e( 'Route all emails through ThorMail.', 'thormail' ); ?></p>
        <?php
    }

	public function field_base_url() {
		$options = get_option( $this->option_name );
		$val     = isset( $options['base_url'] ) ? $options['base_url'] : '';
		echo "<input type='url' name='{$this->option_name}[base_url]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input' placeholder='https://api.thormail.io'>";
		echo "<p class='description'>" . __( 'The base URL of the ThorMail API server.', 'thormail' ) . "</p>";
	}

	public function field_workspace_id() {
		$options = get_option( $this->option_name );
		$val     = isset( $options['workspace_id'] ) ? $options['workspace_id'] : '';
		echo "<input type='text' name='{$this->option_name}[workspace_id]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
	}

	public function field_api_key() {
		$options = get_option( $this->option_name );
		$val     = isset( $options['api_key'] ) ? $options['api_key'] : '';
		echo "<input type='password' name='{$this->option_name}[api_key]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
	}

    public function field_adapter_id() {
        $options = get_option( $this->option_name );
        $val     = isset( $options['adapter_id'] ) ? $options['adapter_id'] : '';
        echo "<input type='text' name='{$this->option_name}[adapter_id]' value='" . esc_attr( $val ) . "' class='regular-text thormail-input'>";
        echo "<p class='description'>" . __( 'Optional. Force all emails to use a specific Adapter ID.', 'thormail' ) . "</p>";
    }

	public function render_page() {
		$options = get_option( $this->option_name );
        // Check if enabled + configured
		$is_configured = ! empty( $options['api_key'] ) && ! empty( $options['workspace_id'] ) && ! empty( $options['base_url'] );
        $is_enabled = isset( $options['thormail_enabled'] ) && $options['thormail_enabled'] === '1';
		
        if ( isset( $_GET['test_email'] ) ) {
            $status = $_GET['test_email'];
            if ( 'success' === $status ) {
                echo '<div class="notice notice-success is-dismissible"><p>' . __( 'Test email sent successfully!', 'thormail' ) . '</p></div>';
            } else {
                 echo '<div class="notice notice-error is-dismissible"><p>' . __( 'Failed to send test email. Check your settings or error logs.', 'thormail' ) . '</p></div>';
            }
        }
		?>
        <div class="wrap thormail-wrap">
            <div class="thormail-header">
                <div class="thormail-logo">
                    <h1>ThorMail Integration</h1>
                </div>
                <div class="thormail-status <?php echo ( $is_configured && $is_enabled ) ? 'active' : 'inactive'; ?>">
					<?php 
                    if ( ! $is_configured ) {
                        _e( 'Missing Configuration', 'thormail' );
                    } elseif ( ! $is_enabled ) {
                        _e( 'Disabled', 'thormail' );
                    } else {
                        _e( 'Active', 'thormail' );
                    }
                    ?>
                </div>
            </div>

            <form action="options.php" method="post" class="thormail-card">
				<?php
				settings_fields( $this->option_name );
				do_settings_sections( 'thormail' );
				submit_button( __( 'Save Changes', 'thormail' ) );
				?>
            </form>

			<?php if ( $is_configured ) : ?>
                <div class="thormail-card" style="margin-top: 20px;">
                    <h3><?php _e( 'Send Test Email', 'thormail' ); ?></h3>
                    <p><?php _e( 'Send a test email to verify your configuration.', 'thormail' ); ?></p>
                    <form action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" method="post">
                        <input type="hidden" name="action" value="thormail_send_test">
						<?php wp_nonce_field( 'thormail_test_email' ); ?>
                        <table class="form-table">
                            <tr>
                                <th scope="row"><label for="thormail_to"><?php _e( 'To:', 'thormail' ); ?></label></th>
                                <td>
                                    <input type="email" name="thormail_to" id="thormail_to" value="<?php echo esc_attr( wp_get_current_user()->user_email ); ?>" class="regular-text">
                                </td>
                            </tr>
                        </table>
						<?php submit_button( __( 'Send Test', 'thormail' ), 'secondary' ); ?>
                    </form>
                </div>
			<?php endif; ?>
        </div>
		<?php
	}

	public function handle_test_email() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		check_admin_referer( 'thormail_test_email' );

		$to = sanitize_email( $_POST['thormail_to'] );
		if ( empty( $to ) ) {
			wp_die( 'Invalid email' );
		}

		$subject = 'ThorMail Test Email';
		$message = "Congratulations! \n\nThis is a test email from ThorMail WordPress Plugin.\n\nTime: " . current_time( 'mysql' );
		$headers = array( 'Content-Type: text/plain' );

		$sent = wp_mail( $to, $subject, $message, $headers );

        // Redirect back
        $status = $sent ? 'success' : 'error';
        wp_redirect( add_query_arg( array( 'page' => 'thormail', 'test_email' => $status ), admin_url( 'options-general.php' ) ) );
        exit;
	}
}
