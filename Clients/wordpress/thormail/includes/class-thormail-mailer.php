<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ThorMail_Mailer
 * Intercepts wp_mail and sends emails via ThorMail API.
 */
class ThorMail_Mailer {
	private $api;
    private static $instance = null;
    private $last_error = '';

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

	public function __construct() {
		$this->api = new ThorMail_API();
		add_filter( 'pre_wp_mail', array( $this, 'send_email' ), 10, 2 );
	}

    public function get_last_error() {
        return $this->last_error;
    }

	/**
	 * Pre-hook to hijack wp_mail.
	 *
	 * @param null|bool $return Short-circuit return value.
	 * @param array     $atts   Attributes from wp_mail.
	 * @return bool|null True if sent successfully, null to fallback (if needed, but we want to force it).
	 */
	public function send_email( $return, $atts ) {
        $options = get_option( 'thormail_settings' );
        if ( ! isset( $options['thormail_enabled'] ) || $options['thormail_enabled'] !== '1' ) {
            return null; // Fallback to default mailer
        }

		// Extract attributes
		$to          = isset( $atts['to'] ) ? $atts['to'] : '';
		$subject     = isset( $atts['subject'] ) ? $atts['subject'] : '';
		$message     = isset( $atts['message'] ) ? $atts['message'] : '';
		$headers     = isset( $atts['headers'] ) ? $atts['headers'] : array();
		$attachments = isset( $atts['attachments'] ) ? $atts['attachments'] : array();

		// Normalize recipients
		$recipients = $this->parse_recipients( $to );
		$cc_bcc = $this->parse_cc_bcc( $headers );
		$recipients = array_merge( $recipients, $cc_bcc );
        $recipients = array_unique( $recipients );

		if ( empty( $recipients ) ) {
			return false; // No recipients
		}
        
        // Handle Attachments: Log warning
        if ( ! empty( $attachments ) ) {
            error_log( 'ThorMail Warning: Attachments are not currently supported by this plugin version.' );
        }

        $adapter_id = ! empty( $options['adapter_id'] ) ? $options['adapter_id'] : null;
        $template_id = ! empty( $options['template_id'] ) ? $options['template_id'] : null;
        $body_key    = ! empty( $options['body_key'] ) ? $options['body_key'] : null;

		// Send
		if ( count( $recipients ) === 1 ) {
			$payload = array(
				'to'      => $recipients[0],
				'subject' => $subject,
				'type'    => 'EMAIL',
			);
            
            if ( $body_key ) {
                $payload['data'] = array( $body_key => $message );
            } else {
                $payload['body'] = $message;
            }
            if ( $adapter_id ) {
                $payload['adapterId'] = $adapter_id;
            }
            if ( $template_id ) {
                $payload['templateId'] = $template_id;
            }
			$result = $this->api->send( $payload );
		} else {
            // Loop for multiple recipients to ensure strict error handling/adapter usage per message if needed
            $success_count = 0;
            foreach ( $recipients as $recipient ) {
                $payload = array(
                    'to'      => $recipient,
                    'subject' => $subject,
                    'type'    => 'EMAIL',
                );

                if ( $body_key ) {
                    $payload['data'] = array( $body_key => $message );
                } else {
                    $payload['body'] = $message;
                }
                if ( $adapter_id ) {
                    $payload['adapterId'] = $adapter_id;
                }
                if ( $template_id ) {
                    $payload['templateId'] = $template_id;
                }

                $res = $this->api->send( $payload );
                if ( ! is_wp_error( $res ) ) {
                    $success_count++;
                } else {
                     error_log( 'ThorMail Partial Fail: ' . $res->get_error_message() );
                }
            }
            return $success_count > 0;
		}

		if ( is_wp_error( $result ) ) {
            $this->last_error = $result->get_error_message();
            error_log( 'ThorMail Send Error: ' . $this->last_error );
			return false;
		}

		return true;
	}

	private function parse_recipients( $to ) {
		if ( is_array( $to ) ) {
			return $to;
		}
		return array_map( 'trim', explode( ',', $to ) );
	}

	private function parse_cc_bcc( $headers ) {
		$recipients = array();
		if ( empty( $headers ) ) {
			return $recipients;
		}

		if ( ! is_array( $headers ) ) {
			$headers = explode( "\n", str_replace( "\r\n", "\n", $headers ) );
		}

		foreach ( $headers as $header ) {
			if ( strpos( $header, ':' ) === false ) {
				continue;
			}
			list( $name, $content ) = explode( ':', $header, 2 );
			$name = trim( strtolower( $name ) );
			if ( in_array( $name, array( 'cc', 'bcc' ), true ) ) {
				$recipients = array_merge( $recipients, $this->parse_recipients( $content ) );
			}
		}

		return $recipients;
	}
}
