// Controles del sistema en Antuan OS. Misma interfaz que el ayudante de Windows (json/ask/stop),
// usando PipeWire (wpctl/pactl), brightnessctl, playerctl, powerprofilesctl y /sys.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const run = (cmd, args, t = 4000) => new Promise((res) => execFile(cmd, args, { timeout: t, encoding: 'utf8' }, (e, out) => res(e ? '' : String(out))));
const ok = (o) => Object.assign({ ok: true }, o);
const fail = (m) => ({ ok: false, error: m });

const PROFILE = { 'power-saver': 'eficiencia', balanced: 'equilibrado', performance: 'rendimiento' };
const PROFILE_INV = { eficiencia: 'power-saver', equilibrado: 'balanced', rendimiento: 'performance' };

function bateria() {
  const base = '/sys/class/power_supply';
  let bat = null, ac = false;
  try {
    for (const d of fs.readdirSync(base)) {
      const t = fs.readFileSync(path.join(base, d, 'type'), 'utf8').trim();
      if (t === 'Battery' && !bat) bat = path.join(base, d);
      if (t === 'Mains') ac = fs.readFileSync(path.join(base, d, 'online'), 'utf8').trim() === '1';
    }
  } catch { }
  const rd = (f) => { try { return +fs.readFileSync(path.join(bat, f), 'utf8').trim(); } catch { return null; } };
  if (!bat) return { present: false, ac: true };
  const full = rd('energy_full') ?? rd('charge_full'), design = rd('energy_full_design') ?? rd('charge_full_design');
  let st = ''; try { st = fs.readFileSync(path.join(bat, 'status'), 'utf8').trim(); } catch { }
  return { present: true, percent: rd('capacity'), charging: st === 'Charging', ac,
    designMWh: design ? Math.round(design / 1000) : null, fullMWh: full ? Math.round(full / 1000) : null,
    health: full && design ? Math.round(full / design * 100) : null };
}

async function exec(line) {
  const [c, ...a] = line.trim().split(/\s+/);
  switch (c) {
    case 'ping': return ok({});
    case 'vol?': {
      const o = await run('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@']);
      const m = /Volume:\s*([\d.]+)/.exec(o);
      return m ? ok({ level: Math.round(+m[1] * 100), muted: /MUTED/.test(o) }) : fail('sin audio');
    }
    case 'vol': await run('wpctl', ['set-volume', '-l', '1.0', '@DEFAULT_AUDIO_SINK@', (Math.max(0, Math.min(100, +a[0])) / 100).toFixed(2)]); return exec('vol?');
    case 'mute': await run('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', a[0] === '1' ? '1' : '0']); return exec('vol?');
    case 'bri?': {
      const cur = +(await run('brightnessctl', ['get'])), max = +(await run('brightnessctl', ['max']));
      return ok({ level: max ? Math.round(cur / max * 100) : -1 });
    }
    case 'bri': await run('brightnessctl', ['set', Math.max(1, +a[0]) + '%']); return ok({});
    case 'apps-audio?': {
      let list = [];
      try { list = JSON.parse(await run('pactl', ['-f', 'json', 'list', 'sink-inputs']) || '[]'); } catch { }
      return ok({ sessions: list.map((s) => {
        const p = s.properties || {};
        const vol = Object.values(s.volume || {})[0];
        return { pid: +(p['application.process.id'] || s.index), index: s.index, name: p['application.name'] || p['application.process.binary'] || 'App',
          exe: p['application.process.binary'] || null, level: vol ? parseInt(vol.value_percent) : 100, muted: !!s.mute, active: !s.corked, system: false };
      }) });
    }
    case 'app-vol': case 'app-mute': {
      let list = [];
      try { list = JSON.parse(await run('pactl', ['-f', 'json', 'list', 'sink-inputs']) || '[]'); } catch { }
      const mine = list.filter((s) => String((s.properties || {})['application.process.id']) === a[0] || String(s.index) === a[0]);
      for (const s of mine) await run('pactl', c === 'app-vol' ? ['set-sink-input-volume', String(s.index), a[1] + '%'] : ['set-sink-input-mute', String(s.index), a[1]]);
      return ok({ count: mine.length });
    }
    case 'outputs?': {
      let sinks = []; try { sinks = JSON.parse(await run('pactl', ['-f', 'json', 'list', 'sinks']) || '[]'); } catch { }
      const def = (await run('pactl', ['get-default-sink'])).trim();
      return ok({ devices: sinks.map((s) => ({ id: s.name, name: s.description, default: s.name === def })) });
    }
    case 'output-set': { const id = Buffer.from(a[0], 'base64').toString('utf8'); await run('pactl', ['set-default-sink', id]); return ok({}); }
    case 'media?': {
      const st = (await run('playerctl', ['status'])).trim();
      if (!st || /No players/i.test(st)) return ok({ none: true });
      const f = (await run('playerctl', ['metadata', '--format', '{{playerName}}\t{{title}}\t{{artist}}\t{{album}}\t{{mpris:artUrl}}\t{{position}}\t{{mpris:length}}'])).trim().split('\t');
      const art = f[4] && f[4].startsWith('file://') ? decodeURIComponent(f[4].slice(7)) : null;
      return ok({ app: f[0], title: f[1], artist: f[2], album: f[3], playing: st === 'Playing', position: +f[5] / 1e6 || 0, duration: +f[6] / 1e6 || 0, cover: art });
    }
    case 'media-cmd': {
      const m = { play: 'play', pause: 'pause', toggle: 'play-pause', next: 'next', prev: 'previous' }[a[0]];
      await run('playerctl', [m || 'play-pause']); return ok({ done: true });
    }
    case 'power?': { const p = (await run('powerprofilesctl', ['get'])).trim(); return ok({ mode: PROFILE[p] || 'equilibrado', ac: bateria().ac }); }
    case 'power-set': await run('powerprofilesctl', ['set', PROFILE_INV[a[0]] || 'balanced']); return exec('power?');
    case 'battery?': return ok(bateria());
    case 'privacy?': {
      // Camara: procesos con /dev/video* abierto; micro: grabaciones de PipeWire (pactl); ubicacion: no hay servicio
      const webcam = new Set();
      try {
        for (const d of fs.readdirSync('/proc')) {
          if (!/^\d+$/.test(d)) continue;
          let fds = []; try { fds = fs.readdirSync(`/proc/${d}/fd`); } catch { continue; }
          if (fds.some((f) => { try { return fs.readlinkSync(`/proc/${d}/fd/${f}`).startsWith('/dev/video'); } catch { return false; } })) {
            try { webcam.add(fs.readFileSync(`/proc/${d}/comm`, 'utf8').trim()); } catch { }
          }
        }
      } catch { }
      let src = []; try { src = JSON.parse(await run('pactl', ['-f', 'json', 'list', 'source-outputs']) || '[]'); } catch { }
      const microphone = [...new Set(src.map((s) => (s.properties || {})['application.name'] || (s.properties || {})['application.process.binary']).filter(Boolean))];
      return ok({ webcam: [...webcam], microphone, location: [] });
    }
    case 'refresh?': {
      const o = await run('xrandr', ['--current']);
      const cur = /(\d+)x(\d+)\s+([\d.]+)\*/.exec(o);
      const line = o.split('\n').find((l) => /\*/.test(l)) || '';
      const max = Math.max(...(line.match(/[\d.]+(?=[*+ ]*\s|$)/g) || ['60']).map(Number).filter((n) => n < 500));
      return ok({ current: cur ? Math.round(+cur[3]) : 60, max: Math.round(max) || 60, width: cur ? +cur[1] : 0, height: cur ? +cur[2] : 0 });
    }
  }
  return fail('Orden desconocida: ' + c);
}

module.exports = {
  json: (cmd) => exec(cmd).catch((e) => fail(String(e))),
  ask: async (cmd) => JSON.stringify(await exec(cmd).catch((e) => fail(String(e)))),
  stop: () => { }
};
