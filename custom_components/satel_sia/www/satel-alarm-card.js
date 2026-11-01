/*
 * Satel alarm card for Home Assistant
 * Partition arming status, panel connectivity and power, recent events.
 * Works with the satel_sia integration (and the built-in sia integration).
 * https://github.com/tomaszsluszniak/ha-satel-sia
 */

const CARD_VERSION = "1.2.0";
const CARD_TAG = "satel-alarm-card";

const I18N = {
  pl: {
    title: "Alarm",
    armed: "Czuwanie",
    armed_away: "Czuwanie",
    armed_home: "Czuwanie częściowe",
    armed_night: "Czuwanie nocne",
    armed_vacation: "Czuwanie (urlop)",
    armed_custom_bypass: "Czuwanie (bypass)",
    disarmed: "Brak czuwania",
    arming: "Uzbrajanie…",
    pending: "Czas na wejście…",
    disarming: "Rozbrajanie…",
    triggered: "ALARM",
    unknown: "Nieznany",
    unknown_hint: "czeka na zdarzenie",
    unavailable: "Brak danych",
    since: "od",
    by: "przez",
    last_known: "ostatnio",
    connected: "Połączono",
    disconnected: "Brak łączności",
    power_ok: "230 V",
    power_fail: "Awaria 230 V",
    power_back: "Powrót zasilania 230 V",
    events: "Ostatnie zdarzenia",
    no_events: "Brak zdarzeń w ostatnich {h} h",
    alarm_in: "Alarm",
    code_BA: "Alarm włamaniowy",
    code_FA: "Alarm pożarowy",
    code_PA: "Alarm napadowy",
    code_HA: "Napad / przymus",
    code_JA: "Sabotaż kodu",
    code_TA: "Sabotaż",
    code_MA: "Alarm medyczny",
    ev_armed: "{p}: załączenie czuwania",
    ev_disarmed: "{p}: wyłączenie czuwania",
    ev_triggered: "{p}: {what}",
    ev_conn_lost: "Utrata łączności z centralą",
    ev_conn_back: "Łączność przywrócona",
    stale: "stan sprzed {t}",
    today: "",
    yesterday: "wczoraj",
    partition_n: "Strefa {n}",
    switch_on: "Włączone",
    switch_off: "Wyłączone",
    ev_switch_on: "{p}: włączenie",
    ev_switch_off: "{p}: wyłączenie",
  },
  en: {
    title: "Alarm",
    armed: "Armed",
    armed_away: "Armed",
    armed_home: "Armed home",
    armed_night: "Armed night",
    armed_vacation: "Armed vacation",
    armed_custom_bypass: "Armed (bypass)",
    disarmed: "Disarmed",
    arming: "Arming…",
    pending: "Entry delay…",
    disarming: "Disarming…",
    triggered: "ALARM",
    unknown: "Unknown",
    unknown_hint: "waiting for an event",
    unavailable: "No data",
    since: "since",
    by: "by",
    last_known: "last",
    connected: "Connected",
    disconnected: "No connection",
    power_ok: "Mains",
    power_fail: "Mains failure",
    power_back: "Mains restored",
    events: "Recent events",
    no_events: "No events in the last {h} h",
    alarm_in: "Alarm",
    code_BA: "Burglary alarm",
    code_FA: "Fire alarm",
    code_PA: "Panic alarm",
    code_HA: "Holdup / duress",
    code_JA: "Code tamper",
    code_TA: "Tamper",
    code_MA: "Medical alarm",
    ev_armed: "{p} armed",
    ev_disarmed: "{p} disarmed",
    ev_triggered: "{p}: {what}",
    ev_conn_lost: "Connection to the panel lost",
    ev_conn_back: "Connection restored",
    stale: "state from {t} ago",
    today: "",
    yesterday: "yesterday",
    partition_n: "Partition {n}",
    switch_on: "On",
    switch_off: "Off",
    ev_switch_on: "{p} on",
    ev_switch_off: "{p} off",
  },
};

const REAL_STATES = new Set([
  "armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass",
  "disarmed", "triggered", "arming", "pending", "disarming",
]);

const isArmed = (s) => typeof s === "string" && s.startsWith("armed");

/* Satel puts "<number>^<partition name 16><source name 16>^" in the SIA message. */
function parseSatelMessage(msg) {
  const out = { number: null, partition: null, source: null };
  if (!msg || typeof msg !== "string") return out;
  const i = msg.indexOf("^");
  if (i < 0) {
    out.number = msg.trim() || null;
    return out;
  }
  out.number = msg.slice(0, i).trim() || null;
  const names = msg.slice(i + 1).split("^")[0];
  const p = names.slice(0, 16).trim();
  const s = names.slice(16).trim();
  if (names.length <= 16 && !s) {
    out.source = p || null;
  } else {
    out.partition = p || null;
    out.source = s || null;
  }
  return out;
}

function whoFromAttrs(a) {
  if (!a) return null;
  if (a.last_source_name) return a.last_source_name;
  const parsed = parseSatelMessage(a.last_message);
  if (parsed.source) return parsed.source;
  return null;
}

class SatelAlarmCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._history = null;
    this._lastReal = {};
    this._historyKey = "";
    this._fetching = false;
    this._tick = null;
  }

  static getStubConfig(hass) {
    const panels = Object.keys(hass.states)
      .filter((e) => e.startsWith("alarm_control_panel.") && /_zone_\d+_alarm$/.test(e))
      .sort();
    const base = panels.length ? panels[0].replace(/^alarm_control_panel\./, "").replace(/_zone_\d+_alarm$/, "") : "";
    const cfg = { partitions: panels.map((entity) => ({ entity })) };
    if (base && hass.states[`binary_sensor.${base}_connectivity`]) cfg.connectivity = `binary_sensor.${base}_connectivity`;
    if (base && hass.states[`binary_sensor.${base}_power`]) cfg.power = `binary_sensor.${base}_power`;
    return cfg;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.partitions) || !config.partitions.length) {
      throw new Error("Add at least one partition: partitions: [{ entity: alarm_control_panel.xxx }]");
    }
    this._config = {
      events: 6,
      hours: 24,
      show_events: true,
      ...config,
      partitions: config.partitions.map((p) => (typeof p === "string" ? { entity: p } : p)),
    };
    this._historyKey = "";
    if (this._eventsOpen === undefined) this._eventsOpen = this._config.show_events !== "collapsed";
    this._render();
  }

  _showEvents() {
    const v = this._config.show_events;
    return v !== false && v !== "false" && v !== "hidden" && this._config.events > 0;
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const ids = this._entityIds();
    const changed = !old || ids.some((id) => old.states[id] !== hass.states[id]);
    if (changed) {
      this._render();
      this._maybeFetchHistory();
    }
  }

  connectedCallback() {
    this._tick = setInterval(() => this._render(), 60000);
  }

  disconnectedCallback() {
    clearInterval(this._tick);
  }

  getCardSize() {
    return 3 + Math.ceil(this._config.partitions.length / 2) * 2 + (this._showEvents() && this._eventsOpen ? 2 : 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _t(key, vars) {
    const lang = (this._hass && this._hass.language || "pl").slice(0, 2);
    const dict = I18N[lang] || I18N.en;
    let s = dict[key] ?? I18N.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  }

  _entityIds() {
    const ids = this._config.partitions.map((p) => p.entity);
    if (this._config.connectivity) ids.push(this._config.connectivity);
    if (this._config.power) ids.push(this._config.power);
    return ids;
  }

  /* Card option > entity name in HA (set from the panel's partition name by
     satel_sia, or renamed by the user) > name from the last event > "Partition N". */
  _partitionName(p) {
    if (p.name) return p.name;
    const st = this._hass.states[p.entity];
    const a = (st && st.attributes) || {};
    const friendly = a.friendly_name;
    const zone = (friendly || p.entity).match(/zone[ _](\d+)[ _-]+alarm$/i);
    if (friendly && !zone) return friendly;
    if (a.last_partition_name) return a.last_partition_name;
    const parsed = parseSatelMessage(a.last_message);
    if (parsed.partition) return parsed.partition;
    return zone ? this._t("partition_n", { n: zone[1] }) : friendly || p.entity;
  }

  /* ---------- history ---------- */

  async _maybeFetchHistory() {
    if (!this._hass || this._fetching) return;
    const ids = this._entityIds();
    const key = ids.map((id) => {
      const s = this._hass.states[id];
      return s ? `${id}:${s.state}:${s.last_changed}` : id;
    }).join("|");
    if (key === this._historyKey) return;
    this._historyKey = key;
    this._fetching = true;
    try {
      const start = new Date(Date.now() - Math.max(this._config.hours, 1) * 3600 * 1000);
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        entity_ids: ids,
        minimal_response: false,
        no_attributes: false,
        significant_changes_only: false,
      });
      this._history = res || {};
      this._buildLastReal();
    } catch (err) {
      this._history = null;
      console.warn(CARD_TAG, "history fetch failed", err);
    } finally {
      this._fetching = false;
      this._render();
    }
  }

  _rows(entityId) {
    const rows = (this._history && this._history[entityId]) || [];
    let attrs = {};
    return rows.map((r) => {
      if (r.a) attrs = { ...attrs, ...r.a };
      const ts = (r.lc ?? r.lu) * 1000;
      return { s: r.s, a: attrs, t: ts };
    });
  }

  _buildLastReal() {
    this._lastReal = {};
    for (const p of this._config.partitions) {
      const rows = this._rows(p.entity).filter((r) => REAL_STATES.has(r.s));
      if (rows.length) this._lastReal[p.entity] = rows[rows.length - 1];
    }
  }

  _events() {
    const out = [];
    for (const p of this._config.partitions) {
      const name = this._partitionName(p);
      let prev = null;
      for (const r of this._rows(p.entity)) {
        if (!REAL_STATES.has(r.s)) continue;
        const kind = isArmed(r.s) ? "armed" : r.s;
        if (prev === kind) continue;
        const firstRow = prev === null;
        prev = kind;
        if (firstRow && r.t <= Date.now() - this._config.hours * 3600 * 1000 + 1000) continue;
        const who = whoFromAttrs(r.a);
        if (p.mode === "switch" && (kind === "armed" || kind === "disarmed")) {
          const on = kind === "armed";
          out.push({ t: r.t, icon: p.icon || "mdi:power", tone: on ? "accent" : "muted", text: this._t(on ? "ev_switch_on" : "ev_switch_off", { p: name }), who });
          continue;
        }
        if (kind === "armed") out.push({ t: r.t, icon: "mdi:lock", tone: "danger", text: this._t("ev_armed", { p: name }), who });
        else if (kind === "disarmed") out.push({ t: r.t, icon: "mdi:lock-open-variant", tone: "success", text: this._t("ev_disarmed", { p: name }), who });
        else if (kind === "triggered") {
          const what = this._t(`code_${r.a.last_code}`) !== `code_${r.a.last_code}` ? this._t(`code_${r.a.last_code}`) : this._t("triggered");
          out.push({ t: r.t, icon: "mdi:alarm-light", tone: "alarm", text: this._t("ev_triggered", { p: name, what }), who });
        }
      }
    }
    if (this._config.power) {
      let prev = null;
      for (const r of this._rows(this._config.power)) {
        if (r.s !== "on" && r.s !== "off") continue;
        if (prev !== null && prev !== r.s) {
          out.push(r.s === "off"
            ? { t: r.t, icon: "mdi:power-plug-off-outline", tone: "warning", text: this._t("power_fail") }
            : { t: r.t, icon: "mdi:power-plug-outline", tone: "success", text: this._t("power_back") });
        }
        prev = r.s;
      }
    }
    if (this._config.connectivity && this._config.show_connectivity_events !== false) {
      const rows = this._rows(this._config.connectivity).filter((r) => r.s === "on" || r.s === "off");
      // only report outages that lasted longer than 10 minutes
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].s !== "off") continue;
        const end = rows.slice(i + 1).find((r) => r.s === "on");
        const dur = (end ? end.t : Date.now()) - rows[i].t;
        if (dur < 10 * 60 * 1000) continue;
        out.push({ t: rows[i].t, icon: "mdi:lan-disconnect", tone: "warning", text: this._t("ev_conn_lost") });
        if (end) out.push({ t: end.t, icon: "mdi:lan-connect", tone: "success", text: this._t("ev_conn_back") });
      }
    }
    return out.sort((a, b) => b.t - a.t).slice(0, this._config.events);
  }

  /* ---------- formatting ---------- */

  _time(ts) {
    const d = new Date(ts);
    const lang = this._hass.locale?.language || this._hass.language || "pl";
    const hm = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return hm;
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `${this._t("yesterday")} ${hm}`;
    return `${d.toLocaleDateString(lang, { day: "numeric", month: "numeric" })} ${hm}`;
  }

  _ago(ts) {
    const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 60) return `${min} min`;
    const h = Math.round(min / 60);
    return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
  }

  _moreInfo(entityId) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  /* ---------- render ---------- */

  _render() {
    if (!this._config || !this._hass) return;
    const hass = this._hass;
    const conn = this._config.connectivity ? hass.states[this._config.connectivity] : null;
    const power = this._config.power ? hass.states[this._config.power] : null;
    const connOk = conn ? conn.state === "on" : null;

    const parts = this._config.partitions.map((p) => {
      const st = hass.states[p.entity];
      let state = st ? st.state : "unavailable";
      let since = st ? Date.parse(st.last_changed) : null;
      let attrs = st ? st.attributes : {};
      let stale = false;
      if (!REAL_STATES.has(state) && this._lastReal[p.entity]) {
        const lr = this._lastReal[p.entity];
        state = lr.s;
        since = lr.t;
        attrs = { ...lr.a, ...attrs, last_source_name: attrs.last_source_name || lr.a.last_source_name, last_message: attrs.last_message || lr.a.last_message };
        stale = true;
      }
      return { p, st, state, since, attrs, stale, name: this._partitionName(p) };
    });

    const alarms = parts.filter((x) => x.state === "triggered");

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const tile = (x) => {
      const s = x.state;
      let tone = "neutral", icon = "mdi:help-circle-outline", label = this._t("unknown"), sub = this._t("unknown_hint");
      const who = whoFromAttrs(x.attrs);
      if (x.p.mode === "switch" && (isArmed(s) || s === "disarmed")) {
        const on = isArmed(s);
        tone = on ? "accent" : "off"; icon = x.p.icon || "mdi:power"; label = this._t(on ? "switch_on" : "switch_off");
      } else if (isArmed(s)) {
        tone = "danger"; icon = s === "armed_night" ? "mdi:shield-moon" : "mdi:lock"; label = this._t(s);
      } else if (s === "disarmed") {
        tone = "success"; icon = "mdi:lock-open-variant"; label = this._t("disarmed");
      } else if (s === "triggered") {
        tone = "alarm"; icon = "mdi:alarm-light"; label = this._t("triggered");
      } else if (s === "arming" || s === "pending" || s === "disarming") {
        tone = "warning"; icon = "mdi:timer-sand"; label = this._t(s);
      } else if (s === "unavailable") {
        label = this._t("unavailable"); sub = "";
      }
      if (REAL_STATES.has(s) && x.since) {
        const parts = [];
        if (who) parts.push(who);
        parts.push(x.stale ? this._t("stale", { t: this._ago(x.since) }) : `${this._t("since")} ${this._time(x.since)}`);
        sub = parts.join(" · ");
      }
      return `
        <button class="tile ${tone} ${x.stale ? "stale" : ""}" data-entity="${esc(x.p.entity)}">
          <div class="tile-head"><span class="pname">${esc(x.name)}</span><ha-icon icon="${icon}"></ha-icon></div>
          <div class="state">${esc(label)}</div>
          <div class="sub">${esc(sub)}</div>
        </button>`;
    };

    const banner = alarms.map((x) => {
      const code = x.attrs.last_code;
      const what = this._t(`code_${code}`) !== `code_${code}` ? this._t(`code_${code}`) : this._t("triggered");
      const who = whoFromAttrs(x.attrs);
      return `
        <button class="banner" data-entity="${esc(x.p.entity)}">
          <ha-icon icon="mdi:alarm-light"></ha-icon>
          <div><div class="b-title">${esc(this._t("alarm_in"))} – ${esc(x.name)}</div>
          <div class="b-sub">${esc(what)}${who ? " · " + esc(who) : ""}${x.since ? " · " + esc(this._time(x.since)) : ""}</div></div>
        </button>`;
    }).join("");

    const chips = [];
    if (conn) {
      chips.push(`<button class="chip ${connOk ? "ok" : "bad"}" data-entity="${esc(this._config.connectivity)}" title="${esc(conn.attributes.friendly_name || "")}">
        <ha-icon icon="${connOk ? "mdi:lan-connect" : "mdi:lan-disconnect"}"></ha-icon>
        <span>${esc(connOk ? this._t("connected") : this._t("disconnected") + (conn.state === "off" ? " · " + this._t("since") + " " + this._time(Date.parse(conn.last_changed)) : ""))}</span></button>`);
    }
    if (power && (power.state === "on" || power.state === "off")) {
      const ok = power.state === "on";
      chips.push(`<button class="chip ${ok ? "ok" : "bad"}" data-entity="${esc(this._config.power)}">
        <ha-icon icon="${ok ? "mdi:power-plug-outline" : "mdi:power-plug-off-outline"}"></ha-icon>
        <span>${esc(ok ? this._t("power_ok") : this._t("power_fail"))}</span></button>`);
    }

    let eventsHtml = "";
    if (this._showEvents()) {
      const collapsible = this._config.show_events === "collapsed";
      const open = !collapsible || this._eventsOpen;
      const evs = open && this._history ? this._events() : [];
      const head = collapsible
        ? `<button class="ev-title toggle" data-toggle="events" aria-expanded="${open}"><span>${esc(this._t("events"))}</span><ha-icon icon="${open ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon></button>`
        : `<div class="ev-title">${esc(this._t("events"))}</div>`;
      const list = !open ? "" : evs.length
        ? evs.map((e) => `<div class="ev"><span class="ev-t">${esc(this._time(e.t))}</span><ha-icon class="${e.tone}" icon="${e.icon}"></ha-icon><span class="ev-x">${esc(e.text)}${e.who ? ` <span class="ev-who">· ${esc(e.who)}</span>` : ""}</span></div>`).join("")
        : `<div class="empty">${esc(this._history ? this._t("no_events", { h: this._config.hours }) : "…")}</div>`;
      eventsHtml = `<div class="events">${head}${list}</div>`;
    }

    const title = this._config.title ?? this._t("title");
    const headIcon = alarms.length ? "mdi:shield-alert" : parts.some((x) => x.p.mode !== "switch" && isArmed(x.state)) ? "mdi:shield-lock" : "mdi:shield-home-outline";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; overflow: hidden; }
        button { font: inherit; color: inherit; background: none; border: 0; padding: 0; text-align: left; cursor: pointer; }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 500; }
        .title ha-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }
        .title.alarm ha-icon { color: var(--error-color); }
        .chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 3px 8px; border-radius: 999px;
          background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); color: var(--secondary-text-color); }
        .chip ha-icon { --mdc-icon-size: 15px; }
        .chip.ok ha-icon { color: var(--success-color); }
        .chip.bad { background: color-mix(in srgb, var(--warning-color) 18%, transparent); color: var(--primary-text-color); }
        .chip.bad ha-icon { color: var(--warning-color); }
        .banner { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px; margin-bottom: 10px; border-radius: 12px;
          background: var(--error-color); color: var(--text-primary-color, #fff); animation: pulse 1.6s ease-in-out infinite; }
        .banner ha-icon { --mdc-icon-size: 28px; }
        .b-title { font-size: 17px; font-weight: 500; }
        .b-sub { font-size: 13px; opacity: .9; }
        @keyframes pulse { 50% { filter: brightness(1.15); } }
        @media (prefers-reduced-motion: reduce) { .banner { animation: none; } }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .tile { border-radius: 12px; padding: 12px; min-height: 86px; border: 1px solid transparent; display: flex; flex-direction: column; gap: 2px; }
        .tile-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; }
        .pname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tile ha-icon { --mdc-icon-size: 24px; flex: none; }
        .state { font-size: 18px; font-weight: 500; line-height: 1.3; }
        .sub { font-size: 12px; opacity: .85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-height: 16px; }
        .tile.danger { background: color-mix(in srgb, var(--error-color) 14%, transparent); border-color: color-mix(in srgb, var(--error-color) 35%, transparent); }
        .tile.danger ha-icon, .tile.danger .state { color: var(--error-color); }
        .tile.success { background: color-mix(in srgb, var(--success-color) 14%, transparent); border-color: color-mix(in srgb, var(--success-color) 35%, transparent); }
        .tile.success ha-icon, .tile.success .state { color: var(--success-color); }
        .tile.warning { background: color-mix(in srgb, var(--warning-color) 16%, transparent); border-color: color-mix(in srgb, var(--warning-color) 40%, transparent); }
        .tile.warning ha-icon, .tile.warning .state { color: var(--warning-color); }
        .tile.accent { background: color-mix(in srgb, var(--primary-color) 14%, transparent); border-color: color-mix(in srgb, var(--primary-color) 35%, transparent); }
        .tile.accent ha-icon, .tile.accent .state { color: var(--primary-color); }
        .tile.off { border: 1px solid var(--divider-color); }
        .tile.off ha-icon, .tile.off .state { color: var(--secondary-text-color); }
        .tile.alarm { background: var(--error-color); color: var(--text-primary-color, #fff); }
        .tile.neutral { border: 1px dashed var(--divider-color); }
        .tile.neutral ha-icon, .tile.neutral .state { color: var(--secondary-text-color); }
        .tile.stale { border-style: dashed; }
        .events { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--divider-color); }
        .ev-title { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 6px; }
        .ev-title.toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0; }
        .ev-title.toggle[aria-expanded="true"] { margin-bottom: 6px; }
        .ev-title.toggle ha-icon { --mdc-icon-size: 18px; }
        .ev { display: grid; grid-template-columns: 72px 20px minmax(0, 1fr); align-items: center; gap: 6px; font-size: 13px; padding: 2px 0; }
        .ev-t { color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
        .ev ha-icon { --mdc-icon-size: 17px; }
        .ev ha-icon.danger, .ev ha-icon.alarm { color: var(--error-color); }
        .ev ha-icon.success { color: var(--success-color); }
        .ev ha-icon.warning { color: var(--warning-color); }
        .ev ha-icon.accent { color: var(--primary-color); }
        .ev ha-icon.muted { color: var(--secondary-text-color); }
        .ev-x { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ev-who { color: var(--secondary-text-color); }
        .empty { font-size: 13px; color: var(--secondary-text-color); }
      </style>
      <ha-card>
        <div class="head">
          <div class="title ${alarms.length ? "alarm" : ""}"><ha-icon icon="${headIcon}"></ha-icon><span>${esc(title)}</span></div>
          <div class="chips">${chips.join("")}</div>
        </div>
        ${banner}
        <div class="grid">${parts.map(tile).join("")}</div>
        ${eventsHtml}
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((el) => {
      el.addEventListener("click", () => this._moreInfo(el.dataset.entity));
    });
    const toggle = this.shadowRoot.querySelector('[data-toggle="events"]');
    if (toggle) {
      toggle.addEventListener("click", () => {
        this._eventsOpen = !this._eventsOpen;
        this._render();
      });
    }
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, SatelAlarmCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TAG,
    name: "Satel alarm card",
    description: "Partition arming status, panel connectivity and recent events (Satel SIA).",
    preview: true,
    documentationURL: "https://github.com/tomaszsluszniak/ha-satel-sia",
  });
  console.info(`%c SATEL-ALARM-CARD %c ${CARD_VERSION} `, "background:#c62828;color:#fff", "background:#444;color:#fff");
}
