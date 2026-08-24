(() => {
  const input = document.getElementById('wQuery');
  const results = document.getElementById('waterResults');
  if (!input || !results) return;

  let timer = null;
  let suggestionRows = [];
  let suggestSeq = 0;
  let searchSeq = 0;
  const recent = new Map();
  const MAX_RESULTS = 12;
  const MAX_SUGGESTIONS = 6;
  const CACHE_MS = 30000;

  function anchor() {
    const p = window.atlasFishingLocation || window.AtlasMap?.getPosition?.();
    return p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
      ? { lat: Number(p.lat), lon: Number(p.lon) }
      : null;
  }

  function miles(a, b) {
    if (!a || !Number.isFinite(Number(b?.latitude)) || !Number.isFinite(Number(b?.longitude))) return null;
    const r = 3958.7613, rad = x => x * Math.PI / 180;
    const dLat = rad(Number(b.latitude) - a.lat), dLon = rad(Number(b.longitude) - a.lon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(Number(b.latitude))) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(x));
  }

  function preciseRows(rows, q, limit) {
    const p = anchor(), needle = q.toLowerCase();
    return [...rows].map(w => ({ ...w, _distance: miles(p, w) })).sort((a, b) => {
      const an = String(a.name || '').toLowerCase(), bn = String(b.name || '').toLowerCase();
      const aExact = an === needle ? 0 : an.startsWith(needle) ? 1 : 2;
      const bExact = bn === needle ? 0 : bn.startsWith(needle) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      if (p && a._distance != null && b._distance != null && a._distance !== b._distance) return a._distance - b._distance;
      return (a.match_rank ?? 9) - (b.match_rank ?? 9) || an.localeCompare(bn);
    }).slice(0, limit);
  }

  function searchKey(q, limit) {
    return [q.toLowerCase(), document.getElementById('wState').value, document.getElementById('wType').value, limit].join('|');
  }

  async function catalogSearch(q, limit = 12) {
    if (!session) throw new Error('Sign in first.');
    const key = searchKey(q, limit), hit = recent.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
    const rows = await api('/rest/v1/rpc/search_water_catalog', {
      method: 'POST',
      body: JSON.stringify({
        p_query: q,
        p_state: document.getElementById('wState').value,
        p_type: document.getElementById('wType').value,
        p_limit: limit
      })
    });
    recent.set(key, { at: Date.now(), rows: rows || [] });
    if (recent.size > 12) recent.delete(recent.keys().next().value);
    return rows || [];
  }

  function meta(w) {
    const d = w._distance;
    const proximity = Number.isFinite(d) ? ` · ${d < .1 ? Math.round(d * 5280) + ' ft' : d.toFixed(1) + ' mi'} from spot` : '';
    return `${esc(w.state_code)} · ${esc(w.water_type)}${proximity}`;
  }

  function renderSuggestions(rows) {
    suggestionRows = rows;
    const box = document.getElementById('waterSuggestions');
    if (!box) return;
    box.innerHTML = rows.length
      ? rows.map((w, i) => `<button type="button" class="suggestion" data-suggestion="${i}"><strong>${esc(w.name)}</strong><span>${meta(w)}</span></button>`).join('')
      : '';
    box.hidden = !rows.length;
    box.querySelectorAll('[data-suggestion]').forEach(btn => {
      btn.onclick = () => {
        const w = suggestionRows[Number(btn.dataset.suggestion)];
        input.value = w.name;
        document.getElementById('wState').value = w.state_code;
        if (w.water_type === 'river' || w.water_type === 'stream') document.getElementById('wType').value = 'river';
        else if (w.water_type === 'lake') document.getElementById('wType').value = 'lake';
        box.hidden = true;
        loadWater(w);
      };
    });
  }

  async function suggest() {
    const seq = ++suggestSeq, q = input.value.trim();
    if (q.length < 2 || !session) {
      renderSuggestions([]);
      return;
    }
    try {
      const rows = await catalogSearch(q, 16);
      if (seq !== suggestSeq || q !== input.value.trim()) return;
      renderSuggestions(preciseRows(rows, q, MAX_SUGGESTIONS));
    } catch {
      if (seq === suggestSeq) renderSuggestions([]);
    }
  }

  window.cachedWaters = async function(q, state, type) {
    return api('/rest/v1/rpc/search_water_catalog', {
      method: 'POST',
      body: JSON.stringify({ p_query: q, p_state: state, p_type: type, p_limit: 18 })
    });
  };

  window.searchWater = async function() {
    const seq = ++searchSeq;
    try {
      const q = input.value.trim();
      if (q.length < 2) throw new Error('Enter at least two characters.');
      stat(anchor() ? 'Searching waters nearest your fishing spot…' : 'Searching Minnesota and Wisconsin waters…');
      let official = [], warning = '';
      try {
        const d = await api('/functions/v1/atlas-water-catalog', {
          method: 'POST',
          body: JSON.stringify({ query: q, state: document.getElementById('wState').value, water_type: document.getElementById('wType').value })
        });
        if (seq !== searchSeq) return;
        official = d.waters || [];
        if (d.failures?.length) warning = 'Some official sources were unavailable. FishWizz also checked its indexed catalog.';
      } catch {
        if (seq !== searchSeq) return;
        warning = 'The official catalog did not respond. FishWizz used its indexed catalog.';
      }
      const cached = await catalogSearch(q, 18);
      if (seq !== searchSeq) return;
      const map = new Map();
      [...official, ...cached].forEach(w => map.set(w.id || [w.name, w.state_code, w.water_type].join('|'), w));
      const rows = preciseRows([...map.values()], q, MAX_RESULTS);
      const spotNote = anchor() ? '<div class="map-note">Showing the best matches, prioritized toward your selected fishing spot.</div>' : '<div class="map-note">Showing the best matches only. Select a spot on the map for proximity ranking.</div>';
      results.innerHTML = spotNote + (warning ? `<div class="warning">${esc(warning)}</div>` : '') +
        (rows.map((w, i) => `<button class="result" data-water="${i}"><b>${esc(w.name)}</b><br><span class="muted">${meta(w)} · ${esc(w.source_label || w.source_system || 'FishWizz catalog')}</span></button>`).join('') || '<p>No close match found. Try the full water name or select your fishing spot on the map first.</p>');
      results.querySelectorAll('[data-water]').forEach(btn => btn.onclick = () => loadWater(rows[Number(btn.dataset.water)]));
      renderSuggestions([]);
      stat(`Showing ${rows.length} best water match${rows.length === 1 ? '' : 'es'}.`, 'ok');
    } catch (e) {
      if (seq === searchSeq) stat(e.message, 'err');
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    suggestSeq++;
    timer = setTimeout(suggest, 260);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.searchWater();
    }
  });
  ['wState','wType'].forEach(id => document.getElementById(id)?.addEventListener('change', () => { recent.clear(); suggestSeq++; }));
  document.getElementById('searchWater').onclick = window.searchWater;
})();
