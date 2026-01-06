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

	public function __construct() {
		$this->api = new ThorMail_API();
		add_filter( 'pre_wp_mail', array( $this, 'send_email' ), 10, 2 );
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

		// Send
		if ( count( $recipients ) === 1 ) {
			$payload = array(
				'to'      => $recipients[0],
				'subject' => $subject,
				'body'    => $message,
				'type'    => 'EMAIL',
			);
            if ( $adapter_id ) {
                $payload['adapterId'] = $adapter_id;
            }
			$result = $this->api->send( $payload );
		} else {
            // Loop for multiple recipients to ensure strict error handling/adapter usage per message if needed
            $success_count = 0;
            foreach ( $recipients as $recipient ) {
                $payload = array(
                    'to'      => $recipient,
                    'subject' => $subject,
                    'body'    => $message,
                    'type'    => 'EMAIL',
                );
                if ( $adapter_id ) {
                    $payload['adapterId'] = $adapter_id;
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
            // Set PHPMailer ErrorInfo for debuggers
             global $phpmailer;
            if ( ! is_object( $phpmailer ) ) {
                 if ( file_exists( ABSPATH . WPINC . '/class-phpmailer.php' ) ) {
                    require_once ABSPATH . WPINC . '/class-phpmailer.php';
                    // Check for PHPMailer namespace (WP 5.5+)
                    if ( class_exists( 'PHPMailer\\PHPMailer\\PHPMailer' ) ) {
                       $phpmailer = new PHPMailer\PHPMailer\PHPMailer( true );
                    } else {
                        $phpmailer = new PHPMailer( true );
                    }
                 }
            }
            if ( is_object( $phpmailer ) ) {
                $phpmailer->ErrorInfo = $result->get_error_message();
            }
            
            error_log( 'ThorMail Send Error: ' . $result->get_error_message() );
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
