import {
  createIcons, ArrowUpRight, FileText, ChevronLeft, ChevronRight,
  Images, Maximize2, MoveHorizontal, Code2, Download, X, Play, Pause, ZoomIn, Copy, Check,
} from 'lucide';
import { initSceneResults } from './scene-results.js';
import { initCitation } from './citation.js';

createIcons({
  icons: {
    ArrowUpRight, FileText, ChevronLeft, ChevronRight, Images,
    Maximize2, MoveHorizontal, Code2, Download, X, Play, Pause, ZoomIn, Copy, Check,
  },
});

const asset = (name) => `${import.meta.env.BASE_URL}${name}`;

initSceneResults();
initCitation();

function wireTabs(selector, onChange) {
  const buttons = [...document.querySelectorAll(selector)];
  function activate(button) {
    buttons.forEach((item) => {
      item.setAttribute('aria-selected', String(item === button));
      item.tabIndex = item === button ? 0 : -1;
    });
    onChange(button);
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activate(button));
    button.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[nextIndex].focus();
      activate(buttons[nextIndex]);
    });
  });
}

const baseline = document.querySelector('#baseline');
const comparisonScenes = ['dining', 'classroom', 'library', 'interior-4', 'interior-5'];
const comparisonMethods = [
  ['vggt', 'VGGT-Ω + TSDF'],
  ['murre', 'Murre'],
  ['monosdf', 'MonoSDF'],
  ['finerecon', 'FineRecon'],
  ['genrecon', 'GenRecon'],
  ['ours', 'WorldRecon'],
];
let comparisonSceneIndex = 0;
let comparisonSplit = 50;

function createComparisonTile([method, methodLabel]) {
  const figure = document.createElement('figure');
  figure.className = 'method-comparison';

  const heading = document.createElement('figcaption');
  heading.className = 'method-comparison-title';
  heading.textContent = methodLabel;

  const viewer = document.createElement('div');
  viewer.className = 'image-comparison';
  viewer.style.setProperty('--split', '50%');

  const after = document.createElement('img');
  after.className = 'comparison-after';
  after.width = 335;
  after.height = 335;
  after.loading = 'lazy';

  const beforeWrap = document.createElement('div');
  beforeWrap.className = 'comparison-before';
  const before = document.createElement('img');
  before.width = 335;
  before.height = 335;
  before.loading = 'lazy';
  beforeWrap.append(before);

  const beforeLabel = document.createElement('span');
  beforeLabel.className = 'image-label before-label';
  const afterLabel = document.createElement('span');
  afterLabel.className = 'image-label after-label';
  afterLabel.textContent = methodLabel;

  const divider = document.createElement('div');
  divider.className = 'comparison-divider';
  const handle = document.createElement('span');
  const icon = document.createElement('i');
  icon.dataset.lucide = 'move-horizontal';
  handle.append(icon);
  divider.append(handle);

  const range = document.createElement('input');
  range.className = 'comparison-tile-range';
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = String(comparisonSplit);
  range.setAttribute('aria-label', `${methodLabel} comparison position`);
  range.addEventListener('input', () => {
    comparisonSplit = Number(range.value);
    comparisonTiles.forEach((tile) => {
      const tileViewer = tile.querySelector('.image-comparison');
      const tileRange = tileViewer.querySelector('.comparison-tile-range');
      tileViewer.style.setProperty('--split', `${comparisonSplit}%`);
      tileRange.value = String(comparisonSplit);
      tileRange.setAttribute(
        'aria-valuetext',
        `${comparisonSplit}% ${baseline.selectedOptions[0].textContent}, ${100 - comparisonSplit}% method result`,
      );
    });
  });

  viewer.append(after, beforeWrap, beforeLabel, afterLabel, divider, range);
  figure.append(heading, viewer);
  figure.updateComparison = (scene) => {
    const baselineMethod = baseline.value;
    const baselineLabel = baseline.selectedOptions[0].textContent;
    after.src = asset(`compare-${scene}-${method}.webp`);
    before.src = asset(`compare-${scene}-${baselineMethod}.webp`);
    after.alt = `${methodLabel} reconstruction`;
    before.alt = `${baselineLabel} reference`;
    beforeLabel.textContent = baselineLabel;
    viewer.style.setProperty('--split', `${comparisonSplit}%`);
    range.value = String(comparisonSplit);
    range.setAttribute(
      'aria-valuetext',
      `${comparisonSplit}% ${baselineLabel}, ${100 - comparisonSplit}% method result`,
    );
  };
  return figure;
}

const comparisonTiles = comparisonMethods.map(createComparisonTile);
document.querySelector('#comparison-grid').replaceChildren(...comparisonTiles);
createIcons({ icons: { MoveHorizontal } });

function updateComparison() {
  const scene = comparisonScenes[comparisonSceneIndex];
  comparisonTiles.forEach((tile) => tile.updateComparison(scene));
  document.querySelector('#comparison-scene-position').textContent =
    `${comparisonSceneIndex + 1} / ${comparisonScenes.length}`;
}
function moveComparisonScene(direction) {
  comparisonSceneIndex = (comparisonSceneIndex + direction + comparisonScenes.length) % comparisonScenes.length;
  updateComparison();
}
document.querySelector('#previous-comparison-scene').addEventListener('click', () => moveComparisonScene(-1));
document.querySelector('#next-comparison-scene').addEventListener('click', () => moveComparisonScene(1));
document.querySelector('#comparison-panel').addEventListener('keydown', (event) => {
  if (event.target.matches('input, button, select')) return;
  if (event.key === 'ArrowLeft') moveComparisonScene(-1);
  else if (event.key === 'ArrowRight') moveComparisonScene(1);
  else return;
  event.preventDefault();
});
baseline.addEventListener('change', updateComparison);
updateComparison();

// Values transcribed from the manuscript's 3D-FRONT and ScanNet++ tables.
const benchmarks = {
  front: [
    ['VGGT-Ω + TSDF', 0.2934, 0.4596, 0.5433, 0.7363, 0.5906, 0.1548, 0.4873, 0.8679, 20.9899, 0.6188, 0.8568],
    ['Murre', 0.5295, 0.2426, 0.4729, 0.4572, 0.8847, 0.2397, 0.5273, 0.8332, 22.6896, 0.6671, 0.8542],
    ['MonoSDF', 0.2558, 0.4936, 0.5730, 0.9056, 0.6052, 0.1616, 0.2566, 0.9161, 18.2223, 0.3560, 0.9062],
    ['FineRecon', 0.2448, 0.5301, 0.6252, 0.8126, 0.5578, 0.1490, 0.3398, 0.8906, 17.6099, 0.4419, 0.8845],
    ['GenRecon', 0.1861, 0.6196, 0.6128, 0.9587, 0.5348, 0.1666, 0.2548, 0.9490, 17.9822, 0.3139, 0.9543],
    ['WorldRecon', 0.1583, 0.7271, 0.6839, 0.9589, 0.3910, 0.1126, 0.1966, 0.9582, 16.4044, 0.2951, 0.9601],
  ],
  scannet: [
    ['VGGT-Ω + TSDF', 0.1121, 0.7467, 0.7036, 0.8737, 0.3984, 0.1433, 0.3907, 0.8991, 25.4852, 0.5075, 0.8888],
    ['Murre', 0.1756, 0.5640, 0.6222, 0.5567, 0.6619, 0.1863, 0.5587, 0.8690, 28.4193, 0.5642, 0.8761],
    ['MonoSDF', 0.1665, 0.6224, 0.6913, 0.9670, 0.6293, 0.3043, 0.2705, 0.9273, 23.7527, 0.3861, 0.9016],
    ['FineRecon', 0.1259, 0.6861, 0.7226, 0.9388, 0.4405, 0.1673, 0.2707, 0.9183, 22.6830, 0.4043, 0.8886],
    ['GenRecon', 0.1227, 0.5901, 0.5969, 0.9722, 0.6837, 0.3048, 0.3862, 0.9291, 31.5722, 0.4711, 0.9172],
    ['WorldRecon', 0.0638, 0.8363, 0.7840, 0.9918, 0.3331, 0.0992, 0.2139, 0.9522, 20.0429, 0.3631, 0.9320],
  ],
};
function renderBenchmark(dataset) {
  const rows = benchmarks[dataset];
  const lowerIsBetter = new Set([1, 5, 6, 7, 9, 10]);
  const rankings = Array.from({ length: 11 }, (_, index) => {
    const column = index + 1;
    const direction = lowerIsBetter.has(column) ? 1 : -1;
    return [...new Set(rows.map((row) => row[column]))].sort((a, b) => (a - b) * direction);
  });
  const body = document.querySelector('#benchmark-body');
  body.replaceChildren(...rows.map((row) => {
    const tr = document.createElement('tr');
    const ours = row[0] === 'WorldRecon';
    if (ours) tr.className = 'ours';
    row.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = index === 0 ? value : value.toFixed(4);
      if (index > 0) {
        if (value === rankings[index - 1][0]) cell.className = 'best';
        else if (value === rankings[index - 1][1]) cell.className = 'second';
      } else if (ours) {
        const label = document.createElement('span');
        label.className = 'ours-label';
        label.textContent = '(Ours)';
        cell.append(label);
        cell.className = 'best';
      }
      tr.append(cell);
    });
    return tr;
  }));
  const isFront = dataset === 'front';
  document.querySelector('#benchmark-panel').setAttribute('aria-labelledby', `tab-${dataset}`);
  document.querySelector('#dataset-note').textContent = isFront
    ? '30 synthetic indoor scenes from 3D-FRONT.'
    : '30 real-world indoor scenes from ScanNet++. No real-world training data.';
  document.querySelector('#benchmark-caption').textContent = isFront
    ? '3D-FRONT: evaluation on 30 synthetic indoor scenes'
    : 'ScanNet++: evaluation on 30 real-world indoor scenes';
  const callout = document.querySelector('#result-callout');
  if (!callout) return;
  callout.replaceChildren('WorldRecon improves F-score by ');
  const strong = document.createElement('strong');
  strong.textContent = isFront ? '17.3%' : '12.0%';
  callout.append(strong, ` over the strongest baseline on ${isFront ? '3D-FRONT' : 'ScanNet++'}.`);
}
wireTabs('[data-dataset]', (button) => renderBenchmark(button.dataset.dataset));
renderBenchmark('front');

const video = document.querySelector('#demo-video');
const videoError = document.querySelector('#video-error');
const chapters = [...document.querySelectorAll('[data-video-time]')];
chapters.forEach((button) => {
  button.addEventListener('click', async () => {
    video.currentTime = Number(button.dataset.videoTime);
    try {
      await video.play();
      videoError.hidden = true;
    } catch {
      videoError.hidden = false;
    }
  });
});
video.addEventListener('timeupdate', () => {
  const activeIndex = chapters.findLastIndex((button) => Number(button.dataset.videoTime) <= video.currentTime);
  chapters.forEach((button, index) => {
    if (index === activeIndex) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
});
video.addEventListener('error', () => { videoError.hidden = false; });
video.querySelector('source').addEventListener('error', () => { videoError.hidden = false; });

const dialog = document.querySelector('#image-dialog');
const dialogImage = document.querySelector('#dialog-image');
const zoomButton = document.querySelector('#zoom-figure');
const originalFigures = {
  'teaser_refined.webp': 'teaser_refined.png',
  'pipeline.webp': 'pipeline.pdf',
  'comparison.webp': 'comparison.pdf',
  'largescale.webp': 'largescale.pdf',
};
function resetFigureZoom() {
  dialog.classList.remove('actual-size');
  zoomButton.setAttribute('aria-pressed', 'false');
  zoomButton.setAttribute('aria-label', 'View image at actual size');
  zoomButton.dataset.tooltip = 'Actual size';
}
zoomButton.addEventListener('click', () => {
  const actualSize = dialog.classList.toggle('actual-size');
  zoomButton.setAttribute('aria-pressed', String(actualSize));
  zoomButton.setAttribute('aria-label', actualSize ? 'Fit image to window' : 'View image at actual size');
  zoomButton.dataset.tooltip = actualSize ? 'Fit to window' : 'Actual size';
});
document.querySelectorAll('[data-image]').forEach((button) => {
  button.addEventListener('click', () => {
    resetFigureZoom();
    dialogImage.src = asset(`highres/${button.dataset.image}`);
    dialogImage.alt = button.dataset.caption;
    const original = originalFigures[button.dataset.image] || button.dataset.image;
    document.querySelector('#download-figure').href = asset(`highres/${original}`);
    document.querySelector('#dialog-caption').textContent = button.dataset.caption;
    dialog.showModal();
  });
});
dialog.addEventListener('close', resetFigureZoom);
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});
