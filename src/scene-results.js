const asset = (name) => `${import.meta.env.BASE_URL}${name}`;
const scenes = [
  { id: 'synthetic', name: 'Synthetic apartment' },
  { id: 'real', name: 'Real-world classroom' },
  { id: 'generated', name: 'Generated-video apartment' },
];
const modalities = [
  ['geometry', 'Geometry'], ['normal', 'Surface normals'], ['depth', 'Depth'], ['relighting', 'Relighting'],
];

export function initSceneResults() {
  const video = document.querySelector('#scene-orbit');
  const error = document.querySelector('#orbit-error');
  const tabs = [...document.querySelectorAll('[data-scene]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let entered = false;
  let visible = false;
  let manualPause = false;
  let changing = false;
  const inputImage = document.querySelector('#input-animation');
  const inputButton = document.querySelector('#input-sequence');
  const inputMotion = document.querySelector('#input-motion');
  const interiorMotion = document.querySelector('#interior-motion');
  const grid = document.querySelector('.interior-grid');
  let inputPaused = reducedMotion.matches;
  let interiorPaused = reducedMotion.matches;
  let interiorIndex = 0;
  let interiorRequest = 0;
  let timer;

  function motionButton(button, paused, subject) {
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${subject} sequence`);
    button.dataset.tooltip = `${paused ? 'Play' : 'Pause'} ${subject} sequence`;
  }
  function updateInput() {
    const scene = scenes[index];
    const animated = visible && !document.hidden && !inputPaused;
    const version = scene.id === 'generated' ? '?v=watermark-crop-v2' : '';
    const path = asset(`scenes/${scene.id}/${animated ? 'inputs-32.gif' : 'inputs-poster.webp'}${version}`);
    if (inputImage.getAttribute('src') !== path) inputImage.src = path;
    inputImage.alt = `${scene.name}: all 32 reconstruction input views`;
    inputButton.dataset.galleryImage = asset(`scenes/${scene.id}/inputs-32.gif${version}`);
    inputButton.dataset.caption = `${scene.name}: 32 input views in reconstruction order`;
    motionButton(inputMotion, inputPaused, 'input');
  }
  function scheduleInterior() {
    clearTimeout(timer);
    if (!visible || document.hidden || interiorPaused || document.querySelector('#image-dialog').open) return;
    timer = setTimeout(() => void showInterior((interiorIndex + 1) % 4), 1800);
  }
  async function showInterior(next) {
    clearTimeout(timer);
    const token = ++interiorRequest;
    const scene = scenes[index];
    const frames = modalities.map(([key]) => {
      const image = new Image();
      image.src = asset(`scenes/${scene.id}/interior/${next}-${key}.webp`);
      return image;
    });
    try {
      await Promise.all(frames.map((image) => image.decode()));
    } catch {
      if (token === interiorRequest) {
        grid.dataset.state = 'error';
        document.querySelector('#interior-counter').textContent = 'Unavailable';
      }
      return;
    }
    if (token !== interiorRequest) return;
    interiorIndex = next;
    modalities.forEach(([key, label], i) => {
      const button = document.querySelector(`[data-interior="${key}"]`);
      const image = button.querySelector('img');
      image.src = frames[i].src;
      image.alt = `${scene.name}: ${label}, interior view ${next + 1}`;
      button.dataset.galleryImage = image.src;
      button.dataset.caption = image.alt;
      button.dataset.view = String(next);
    });
    grid.dataset.state = 'ready';
    grid.dataset.scene = scene.id;
    grid.dataset.view = String(next);
    document.querySelector('#interior-counter').textContent = `View ${next + 1} / 4`;
    scheduleInterior();
  }

  function play() {
    if (visible && !document.hidden && !manualPause && !reducedMotion.matches) {
      void video.play().catch(() => {});
    }
  }
  function load() {
    changing = true;
    video.pause();
    video.src = asset(`scenes/${scenes[index].id}/orbit-hd.mp4`);
    video.dataset.scene = scenes[index].id;
    video.load();
  }
  function showScene(next) {
    index = (next + scenes.length) % scenes.length;
    const scene = scenes[index];
    manualPause = false;
    error.hidden = true;
    tabs.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    document.querySelector('#scene-panel').setAttribute('aria-labelledby', `scene-tab-${index}`);
    video.poster = asset(`scenes/${scene.id}/orbit-hd-poster.webp`);
    video.setAttribute('aria-label', `${scene.name}: fixed-radius 360-degree orbit`);
    document.querySelector('#orbit-download').href = asset(`scenes/${scene.id}/orbit-hd.mp4`);
    updateInput();
    grid.dataset.state = 'loading';
    if (entered) void showInterior(0);
    if (entered) load();
  }
  tabs.forEach((button, i) => {
    button.addEventListener('click', () => showScene(i));
    button.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      tabs[keys[event.key]].focus();
      showScene(keys[event.key]);
    });
  });
  document.querySelector('#previous-scene').addEventListener('click', () => showScene(index - 1));
  document.querySelector('#next-scene').addEventListener('click', () => showScene(index + 1));
  video.muted = true;
  video.addEventListener('loadeddata', () => {
    changing = false;
    error.hidden = true;
    play();
  });
  video.addEventListener('error', () => { error.hidden = false; });
  video.addEventListener('pause', () => {
    if (!changing && visible && !document.hidden && video.readyState >= 2) manualPause = true;
  });
  video.addEventListener('play', () => { manualPause = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else play();
    updateInput();
    scheduleInterior();
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) video.pause();
    else if (!entered) {
      entered = true;
      load();
      void showInterior(0);
    } else play();
    updateInput();
    scheduleInterior();
  }, { threshold: 0.15 }).observe(video);
  inputMotion.addEventListener('click', () => {
    inputPaused = !inputPaused;
    updateInput();
  });
  interiorMotion.addEventListener('click', () => {
    interiorPaused = !interiorPaused;
    motionButton(interiorMotion, interiorPaused, 'interior');
    scheduleInterior();
  });
  for (const [id, direction] of [['interior-previous', -1], ['interior-next', 1]]) {
    document.querySelector(`#${id}`).addEventListener('click', () => void showInterior((interiorIndex + direction + 4) % 4));
  }
  reducedMotion.addEventListener('change', (event) => {
    inputPaused = interiorPaused = event.matches;
    updateInput();
    motionButton(interiorMotion, interiorPaused, 'interior');
    scheduleInterior();
  });
  motionButton(interiorMotion, interiorPaused, 'interior');
  showScene(0);
  document.querySelector('#scene-panel').addEventListener('click', (event) => {
    const button = event.target.closest('[data-gallery-image]');
    if (!button) return;
    const dialog = document.querySelector('#image-dialog');
    dialog.classList.remove('actual-size');
    const zoom = document.querySelector('#zoom-figure');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.setAttribute('aria-label', 'View image at actual size');
    zoom.dataset.tooltip = 'Actual size';
    document.querySelector('#dialog-image').src = button.dataset.galleryImage;
    document.querySelector('#dialog-image').alt = button.dataset.caption;
    document.querySelector('#dialog-caption').textContent = button.dataset.caption;
    document.querySelector('#download-figure').href = button.dataset.galleryImage;
    clearTimeout(timer);
    dialog.showModal();
  });
  document.querySelector('#image-dialog').addEventListener('close', scheduleInterior);
}
