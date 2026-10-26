const SETTINGS_KEY = 'classified.settings.v1';
const SESSION_KEY = 'classified.session.v1';

export const defaults = { volume: 0.7, sensitivity: 1.0, quality: 'medium', fov: 75 };
export const settings = { ...defaults };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* storage unavailable: keep defaults */ }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const data = raw && JSON.parse(raw);
    return data && Array.isArray(data.collected) && Array.isArray(data.inv) && Array.isArray(data.taken) ? data : null;
  } catch (e) { return null; }
}

export function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}
