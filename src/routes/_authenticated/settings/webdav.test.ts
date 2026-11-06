import { describe, expect, it } from 'vitest'
import { resolveWebDavPersonalUrl, resolveWebDavSettingsUrl } from './webdav'

describe('resolveWebDavSettingsUrl', () => {
  it('uses the runtime option when a custom DAV URL is configured', () => {
    expect(resolveWebDavSettingsUrl('https://dav.example.com/', 'https://pan.example.com')).toBe(
      'https://dav.example.com/',
    )
  })

  it('falls back to the current-origin DAV path while options are unavailable', () => {
    expect(resolveWebDavSettingsUrl('', 'https://pan.example.com')).toBe('https://pan.example.com/dav/')
  })
})

describe('resolveWebDavPersonalUrl', () => {
  it('appends the personal space segment to the server URL', () => {
    expect(resolveWebDavPersonalUrl('https://dav.example.com/')).toBe('https://dav.example.com/personal/')
  })

  it('works with the path-mounted server URL and without a trailing slash', () => {
    expect(resolveWebDavPersonalUrl('https://pan.example.com/dav/')).toBe('https://pan.example.com/dav/personal/')
    expect(resolveWebDavPersonalUrl('https://pan.example.com/dav')).toBe('https://pan.example.com/dav/personal/')
  })
})
