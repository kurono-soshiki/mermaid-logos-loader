/**
 * Map of supported render types
 * These correspond to the supported formats outlined in formats.go, and should
 * be kept in sync with those.
 * Certain formats when rendered, for example, the geojson code in this repo
 * handles both geojson and topojson files.
 */
export const enum RENDER_FORMATS {
  solid = 'solid',
  geojson = 'geojson',
  image = 'img',
  pdf = 'pdf',
  psd = 'psd',
  mermaid = 'mermaid',
}

/**
 * Map of supported states for the Status class
 * Enumerates the status message types accepted by the rails app
 */
export enum STATUS_TYPES {
  constructor = 'constructor',
  hello = 'hello',
  resize = 'resize',
  loading = 'loading',
  loaded = 'loaded',
  error = 'error',
  fatal = 'error:fatal',
  invalid = 'error:invalid',
  ready = 'ready',
  // these need to match the strings in github/github/app/assets/modules/github/behaviors/render-editor.ts
  markdown = 'code_rendering_service:markdown:get_data',
  getContainerSize = 'code_rendering_service:container:get_size',
}

export const enum MESSAGE_RESPONSE_TYPES {
  ack = 'ack',
  branding = 'branding',
  markdown = 'code_rendering_service:data:ready',
  containerSize = 'code_rendering_service:container:size',
  readyAck = 'code_rendering_service:ready:ack',
}

/**
 * This is set within the github css. However, because we need to manually
 * update the render container's height during pjax nav events, we also need to ensure that
 * every renderable type fires a resize event some height; this is a fallback for types
 * that did not previously report their height. For now, those types are `geojson` and `stl`
 */
export const DEFAULT_CONTAINER_HEIGHT = 500

export const DEFAULT_DOCS_LINK_HOSTNAME = 'https://docs.github.com'
