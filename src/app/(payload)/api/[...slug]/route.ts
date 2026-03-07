/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

/**
 * Allow long-running SSE streams (LEO, AI Bus) and tool-heavy requests
 * (image generation ~60s, multi-step tool chains) to complete.
 * Vercel Pro default is 60s — far too short for image gen + upload flows.
 */
export const maxDuration = 300

export const GET = REST_GET(config)
export const POST = REST_POST(config)
export const DELETE = REST_DELETE(config)
export const PATCH = REST_PATCH(config)

export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)
