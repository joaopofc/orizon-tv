export const RECENT_SEARCHES_KEY = 'orizon_recent_searches';
export const RECENT_SEARCHES_EVENT = 'orizon:recent-searches-updated';

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term) {
  if (!term || !term.trim()) return [];
  const clean = term.trim();
  try {
    const current = getRecentSearches();
    const filtered = current.filter(t => t.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, 8);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(RECENT_SEARCHES_EVENT, { detail: updated }));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentSearch(term) {
  try {
    const current = getRecentSearches();
    const updated = current.filter(t => t !== term);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(RECENT_SEARCHES_EVENT, { detail: updated }));
    return updated;
  } catch {
    return [];
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new CustomEvent(RECENT_SEARCHES_EVENT, { detail: [] }));
    return [];
  } catch {
    return [];
  }
}

