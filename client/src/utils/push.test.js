import { describe, it, expect } from 'vitest';
import { pushStatus } from './push';

const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const browser = ({ push = true, permission = 'default', ua = 'Mozilla/5.0 (Windows NT 10.0)', standalone = false } = {}) => ({
  navigator: { userAgent: ua, platform: '', maxTouchPoints: 0, ...(push ? { serviceWorker: {} } : {}) },
  ...(push ? { PushManager: function PushManager() {}, Notification: { permission } } : {}),
  matchMedia: () => ({ matches: standalone }),
});

describe('pushStatus', () => {
  it('can be switched on where the browser supports notifications', () => {
    expect(pushStatus(browser())).toBe('ready');
    expect(pushStatus(browser({ permission: 'granted' }))).toBe('granted');
    expect(pushStatus(browser({ permission: 'denied' }))).toBe('denied');
  });

  it('asks iPad users in Safari to add the app to their Home Screen first', () => {
    expect(pushStatus(browser({ push: false, ua: IPAD }))).toBe('install');
  });

  it('says nothing where notifications are impossible', () => {
    expect(pushStatus(browser({ push: false }))).toBe('unsupported');
    expect(pushStatus(browser({ push: false, ua: IPAD, standalone: true }))).toBe('unsupported');   // an older iPad
    expect(pushStatus(undefined)).toBe('unsupported');
  });
});
