import { describe, expect, it } from 'vitest';
import { parseCookies } from '../auth';

describe('parseCookies', () => {
  it('returns empty object for null or empty header', () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('parses a single cookie', () => {
    expect(parseCookies('session=abc123')).toEqual({ session: 'abc123' });
  });

  it('parses multiple cookies', () => {
    expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('handles values that contain = signs', () => {
    // Base64 tokens often contain = padding
    expect(parseCookies('token=abc==; other=x')).toEqual({ token: 'abc==', other: 'x' });
    expect(parseCookies('__session=a=b=c')).toEqual({ __session: 'a=b=c' });
  });

  it('skips parts with no = separator', () => {
    expect(parseCookies('valid=yes; noequals; also=ok')).toEqual({ valid: 'yes', also: 'ok' });
  });

  it('trims whitespace from keys and values', () => {
    expect(parseCookies('  key  =  val  ')).toEqual({ key: 'val' });
  });

  it('URL-decodes keys and values', () => {
    expect(parseCookies('hello%20world=foo%3Dbar')).toEqual({ 'hello world': 'foo=bar' });
  });

  it('skips parts with an empty key after trimming', () => {
    expect(parseCookies('=orphan; real=yes')).toEqual({ real: 'yes' });
  });

  it('handles no-space separators', () => {
    expect(parseCookies('a=1;b=2;c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });
});
