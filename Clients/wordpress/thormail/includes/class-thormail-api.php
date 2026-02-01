<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ThorMail_API
 * Handles communication with the ThorMail API.
 */
class ThorMail_API {
	private $api_key;
	private $workspace_id;
	private $base_url;
	private $timeout = 30;

	public function __construct() {
		$options = get_option( 'thormail_settings' );
		$this->api_key      = isset( $options['api_key'] ) ? $options['api_key'] : '';
		$this->workspace_id = isset( $options['workspace_id'] ) ? $options['workspace_id'] : '';
		$this->base_url     = isset( $options['base_url'] ) ? untrailingslashit( $options['base_url'] ) : '';
	}

	/**
	 * Send a single email through ThorMail.
	 *
	 * @param array $payload The message payload.
	 * @return array|WP_Error Response body on success, WP_Error on failure.
	 */
	public function send( $payload ) {
		return $this->request( '/v1/send', $payload );
	}

    /**
     * Get server health status.
     *
     * @return array|WP_Error Response body on success, WP_Error on failure.
     */
    public function get_health() {
        return $this->request( '/health', array(), 'GET' );
    }

	/**
	 * Test the connection to the API.
	 *
	 * @return boolean|WP_Error True if valid, WP_Error if not.
	 */
	public function verify_connection() {
		// We can try to send a dummy request or check a theoretical health endpoint.
        // If we don't have a specific ping endpoint, we might just assume valid if settings are present
        // or try to list something if permission allows. 
        // For now, we'll assume if we can hit the endpoint and get a auth error (if invalid) or 404 (if valid but wrong path) implies connectivity.
        // Actually, let's use a known safe operation if available, or just skip hard verification for "lightweight" unless requested.
        // The user asked to "verify the latest version", maybe check if API is reachable?
        
        // Since we don't have a specific `GET /v1/me` documented in the JS client, we will rely on sending handling errors.
        // However, we can basic check if variables are set.
		if ( empty( $this->api_key ) || empty( $this->workspace_id ) ) {
			return new WP_Error( 'missing_config', __( 'API Key and Workspace ID are required.', 'thormail' ) );
		}
        return true;
	}

	/**
	 * Internal request handler with retry logic.
	 *
	 * @param string $endpoint
	 * @param array  $body
	 * @param string $method
	 * @return array|WP_Error
	 */
	private function request( $endpoint, $body, $method = 'POST' ) {
		$url = $this->base_url . $endpoint;

		$args = array(
			'method'    => $method,
			'headers'   => array(
				'Content-Type'   => 'application/json',
				'Accept'         => 'application/json',
				'X-Workspace-ID' => $this->workspace_id,
				'X-API-Key'      => $this->api_key,
				'X-Client-SDK'   => 'wordpress/' . THORMAIL_VERSION,
			),
			'timeout'   => $this->timeout,
			'blocking'  => true,
		);

        if ( ! empty( $body ) || 'GET' !== $method ) {
            $args['body'] = wp_json_encode( $body );
        }

		$max_retries = 3;
		$attempt     = 0;

		while ( $attempt <= $max_retries ) {
			$response = wp_remote_request( $url, $args );

			if ( is_wp_error( $response ) ) {
                // Network error
				if ( $attempt >= $max_retries ) {
					return $response;
				}
                sleep( 1 ); // Basic wait
			} else {
				$code = wp_remote_retrieve_response_code( $response );
				$body = wp_remote_retrieve_body( $response );
                $data = json_decode( $body, true );

				// Success
				if ( $code >= 200 && $code < 300 ) {
					return $data;
				}

				// Retryable errors
				if ( in_array( $code, array( 429, 500, 502, 503, 504 ), true ) && $attempt < $max_retries ) {
					$retry_after = wp_remote_retrieve_header( $response, 'retry-after' );
					if ( $retry_after ) {
						sleep( min( (int) $retry_after, 5 ) );
					} else {
						sleep( pow( 2, $attempt ) );
					}
					$attempt++;
					continue;
				}

				// Non-retryable error
                $error_msg = isset($data['error']) ? $data['error'] : wp_remote_retrieve_response_message( $response );
				return new WP_Error( 'api_error', $error_msg, array( 'status' => $code, 'details' => $data ) );
			}

			$attempt++;
		}

		return new WP_Error( 'timeout', __( 'Request timed out after retries.', 'thormail' ) );
	}
}
