import { describe, expect, it } from 'vitest'
import { isOidcProvisioning } from './auth.js'

const oidc = new Set(['corp-sso'])

describe('isOidcProvisioning', () => {
  it('accepts the callback route pattern with the provider id in params', () => {
    expect(isOidcProvisioning({ path: '/callback/:id', params: { id: 'corp-sso' } }, oidc)).toBe(true)
  })

  it('accepts a concrete callback path without params', () => {
    expect(isOidcProvisioning({ path: '/callback/corp-sso' }, oidc)).toBe(true)
    expect(isOidcProvisioning({ path: '/api/auth/callback/corp-sso' }, oidc)).toBe(true)
  })

  it('accepts the generic-oauth callback path', () => {
    expect(isOidcProvisioning({ path: '/oauth2/callback/:providerId', params: { providerId: 'corp-sso' } }, oidc)).toBe(
      true,
    )
  })

  it('rejects providers that are not configured as OIDC (e.g. built-in social login)', () => {
    expect(isOidcProvisioning({ path: '/callback/:id', params: { id: 'github' } }, oidc)).toBe(false)
    expect(isOidcProvisioning({ path: '/callback/github' }, oidc)).toBe(false)
  })

  it('prefers the route param over the path segment', () => {
    expect(isOidcProvisioning({ path: '/callback/corp-sso', params: { id: 'github' } }, oidc)).toBe(false)
  })

  it('rejects non-callback endpoints', () => {
    expect(isOidcProvisioning({ path: '/sign-up/email', body: { email: 'a@b.c' } }, oidc)).toBe(false)
    expect(isOidcProvisioning({ path: '/admin/create-user' }, oidc)).toBe(false)
    expect(isOidcProvisioning({ path: '/callback/corp-sso/extra' }, oidc)).toBe(false)
  })

  it('rejects missing or malformed context', () => {
    expect(isOidcProvisioning(null, oidc)).toBe(false)
    expect(isOidcProvisioning(undefined, oidc)).toBe(false)
    expect(isOidcProvisioning({}, oidc)).toBe(false)
    expect(isOidcProvisioning({ path: 42 }, oidc)).toBe(false)
  })

  it('rejects everything when no OIDC provider is enabled', () => {
    expect(isOidcProvisioning({ path: '/callback/:id', params: { id: 'corp-sso' } }, new Set())).toBe(false)
  })
})
