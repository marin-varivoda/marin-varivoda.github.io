(() => {
  const figure = document.querySelector('.geometry');
  if (!figure) return;
  const stage = figure.querySelector('.geometry-stage');
  const svg = stage.querySelector('svg');
  const panel = figure.querySelector('.geometry-panel');
  const hint = figure.querySelector('.geometry-hint');
  const controls = figure.querySelector('.geometry-controls');
  const original = svg.innerHTML;
  const decoration = [...svg.children]
    .filter(node => ['title', 'desc', 'defs'].includes(node.localName))
    .map(node => node.outerHTML).join('');
  const home = [-Math.PI / 3, Math.PI / 6];
  let [azimuth, elevation] = home;
  let active = false;
  let pointer = null;
  let frame = null;
  let spinFrame = null;
  let velocity = [0, 0];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tiltLimit = Math.PI / 2 - 0.03;
  const clampTilt = value => Math.max(-tiltLimit, Math.min(tiltLimit, value));

  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const unit = v => v.map(x => x / Math.hypot(...v));
  const signs = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z])));
  const cube = signs;
  const vertices = [[1 / 3, -1, -1], [-1, 1 / 3, -1], [-1, -1, 1 / 3]]
    .flatMap(v => [v, v.map(x => -x)]);
  const pairs = points => points.flatMap((_, a) => points.slice(a + 1).map((_, i) => [a, a + i + 1]));
  const cubeEdges = pairs(cube).filter(([a, b]) => cube[a].filter((x, i) => x !== cube[b][i]).length === 1);
  const edges = pairs(vertices).filter(([a, b]) => Math.floor(a / 2) !== Math.floor(b / 2));
  const faces = signs.map(s => ({
    ids: s.map((sign, i) => 2 * i + (sign === -1 ? 1 : 0)),
    normal: unit(s.map(x => 0.75 * x - 0.45 * s.reduce((a, b) => a + b, 0)))
  }));
  const basis = (az, el) => ({
    view: [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)],
    right: [-Math.sin(az), Math.cos(az), 0],
    up: [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)]
  });
  const initial = basis(...home);
  const extent = axis => {
    const values = cube.map(p => dot(p, axis));
    return Math.max(...values) - Math.min(...values);
  };
  const scale = Math.min(218 / extent(initial.right), 210 / extent(initial.up));

  function render() {
    frame = null;
    const { view, right, up } = basis(azimuth, elevation);
    const point = p => `${(140 + scale * dot(p, right)).toFixed(2)} ${(133 - scale * dot(p, up)).toFixed(2)}`;
    const line = (a, b) => `<path d="M${point(a)} ${point(b)}"/>`;
    const visibleFaces = faces.filter(f => dot(f.normal, view) > 1e-9);
    const visibility = ([a, b]) => cube[a].reduce((count, x, i) => count + (x === cube[b][i] && x * view[i] > 1e-9 ? 1 : 0), 0);
    const cubePaths = count => cubeEdges.filter(e => visibility(e) === count).map(([a, b]) => line(cube[a], cube[b])).join('');
    const edgeCount = ([a, b]) => visibleFaces.filter(f => f.ids.includes(a) && f.ids.includes(b)).length;
    const solidPaths = count => edges.filter(e => edgeCount(e) === count).map(([a, b]) => line(vertices[a], vertices[b])).join('');
    const light = unit(view.map((v, i) => v * 0.5 + up[i] * 0.75 - right[i] * 0.65));
    const polygons = visibleFaces.map(f => {
      const t = Math.max(0, Math.min(1, 1 - (1 - (dot(f.normal, light) + 1) / 2) * 1.8));
      const color = '#' + [107, 140, 111].map((d, i) => Math.round(d + ([237, 242, 226][i] - d) * t).toString(16).padStart(2, '0')).join('');
      return `<path d="M${f.ids.map(i => point(vertices[i])).join(' L')}Z" fill="${color}" stroke="${color}" stroke-width=".5"/>`;
    }).join('');
    svg.innerHTML = decoration + `
      <g data-cube="back" fill="none" stroke="#94a18f" stroke-width=".95" stroke-dasharray="3 4" opacity=".58">${cubePaths(0)}</g>
      <g data-cube="outline" fill="none" stroke="#8b9b83" stroke-width="1.25" stroke-linejoin="round">${cubePaths(1)}</g>
      <g>${polygons}</g>
      <g data-cube="front" fill="none" stroke="#8b9b83" stroke-width="1.1" opacity=".8">${cubePaths(2)}</g>
      <g fill="none" stroke="#315845" stroke-width=".85" stroke-linejoin="round" opacity=".75">${solidPaths(2)}</g>
      <g fill="none" stroke="#315845" stroke-width="1.55" stroke-linejoin="round">${solidPaths(1)}</g>`;
  }

  function scheduleRender() {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  function stopSpin() {
    if (spinFrame !== null) cancelAnimationFrame(spinFrame);
    spinFrame = null;
    velocity = [0, 0];
    stage.classList.remove('is-spinning');
  }

  function coast(samples, releasedAt) {
    const last = samples.at(-1);
    if (motionPreference.matches || releasedAt - last.time > 100 || samples.length < 2) return;
    const first = samples.find(sample => sample.time >= last.time - 90) || samples[0];
    const elapsed = last.time - first.time;
    if (elapsed < 8) return;
    velocity = [(last.azimuth - first.azimuth) / elapsed, (last.elevation - first.elevation) / elapsed];
    const speed = Math.hypot(...velocity);
    if (speed < 0.00015) return;
    if (speed > 0.008) velocity = velocity.map(v => v * 0.008 / speed);
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    let previousTime = performance.now();
    stage.classList.add('is-spinning');
    function tick(now) {
      const elapsed = Math.min(48, Math.max(0, now - previousTime));
      previousTime = now;
      const decay = Math.exp(-elapsed / 1100);
      const travel = 1100 * (1 - decay);
      azimuth += velocity[0] * travel;
      const nextTilt = elevation + velocity[1] * travel;
      elevation = clampTilt(nextTilt);
      if (nextTilt !== elevation) velocity[1] = 0;
      velocity = velocity.map(v => v * decay);
      render();
      if (Math.hypot(...velocity) < 0.000025) stopSpin();
      else spinFrame = requestAnimationFrame(tick);
    }
    spinFrame = requestAnimationFrame(tick);
  }

  function activate() {
    if (active) return;
    active = true;
    stage.classList.add('is-active');
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', 'Interactive cube and octahedron. Drag or use arrow keys to rotate. Home resets; Escape finishes.');
    hint.hidden = true;
    controls.hidden = false;
  }

  function releasePointer() {
    const id = pointer?.id;
    pointer = null;
    stage.classList.remove('is-dragging');
    if (id !== undefined && stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
  }

  function reset() {
    stopSpin();
    releasePointer();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    [azimuth, elevation] = home;
    svg.innerHTML = original;
  }

  function finish() {
    reset();
    active = false;
    stage.classList.remove('is-active');
    stage.setAttribute('role', 'button');
    stage.setAttribute('aria-label', 'Rotate the cube and octahedron');
    hint.hidden = false;
    controls.hidden = true;
    stage.focus({ preventScroll: true });
  }

  stage.addEventListener('click', activate);
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
    if (event.pointerType === 'touch' && !active) return;
    stopSpin();
    activate();
    stage.focus({ preventScroll: true });
    stage.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
      samples: [{ time: event.timeStamp, azimuth, elevation }] };
    stage.classList.add('is-dragging');
    event.preventDefault();
  });
  stage.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const sensitivity = 0.009 * 280 / stage.getBoundingClientRect().width;
    azimuth -= (event.clientX - pointer.x) * sensitivity;
    elevation = clampTilt(elevation + (event.clientY - pointer.y) * sensitivity);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.samples.push({ time: event.timeStamp, azimuth, elevation });
    while (pointer.samples.length > 2 && pointer.samples[1].time < event.timeStamp - 90) pointer.samples.shift();
    scheduleRender();
  });
  stage.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    const samples = pointer.samples;
    releasePointer();
    coast(samples, event.timeStamp);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    stage.addEventListener(type, event => {
      if (pointer?.id === event.pointerId) releasePointer();
    });
  }
  function pauseMotion() {
    stopSpin();
    releasePointer();
  }
  window.addEventListener('blur', pauseMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseMotion();
  });
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) stopSpin();
  });
  stage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    } else if (active && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      stopSpin();
      const step = event.shiftKey ? 0.25 : 0.1;
      azimuth += ({ ArrowLeft: step, ArrowRight: -step }[event.key] || 0);
      elevation = clampTilt(elevation + ({ ArrowUp: -step, ArrowDown: step }[event.key] || 0));
      scheduleRender();
    } else if (active && event.key === 'Home') {
      event.preventDefault();
      reset();
    } else if (active && event.key === 'Escape') {
      event.preventDefault();
      finish();
    }
  });
  figure.querySelector('[data-geometry-reset]').addEventListener('click', () => {
    reset();
    stage.focus({ preventScroll: true });
  });
  figure.querySelector('[data-geometry-done]').addEventListener('click', finish);
  stage.setAttribute('role', 'button');
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('aria-label', 'Rotate the cube and octahedron');
  stage.classList.add('is-ready');
  panel.hidden = false;
})();
