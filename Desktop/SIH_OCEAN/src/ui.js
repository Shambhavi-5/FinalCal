/**
 * ui.js — DOM manipulation helpers.
 * Exposes window.OceanUI. Only touches DOM, never state or scene.
 */

(function () {
  'use strict';

  const { TIME_STEPS, VARIABLE_META } = window.OceanData;

  // ── ELEMENT REFS ──────────────────────────────────────────
  const depthValueDisplay = document.getElementById('depth-value-display');
  const timeLabelEl       = document.getElementById('time-label');
  const playIcon          = document.getElementById('play-icon');
  const playPauseBtn      = document.getElementById('btn-play-pause');
  const colorbar          = document.getElementById('colorbar');
  const colorbarMin       = document.getElementById('colorbar-min');
  const colorbarMax       = document.getElementById('colorbar-max');
  const colorbarUnit      = document.getElementById('colorbar-unit');
  const modalOverlay      = document.getElementById('modal-overlay');
  const modalTitle        = document.getElementById('modal-title');
  const modalSubtitle     = document.getElementById('modal-subtitle');
  const modalFooter       = document.getElementById('modal-footer');
  const statusDot         = document.getElementById('status-dot');
  const statusText        = document.getElementById('status-text');

  // ── DEPTH DISPLAY ──────────────────────────────────────────
  function setDepthDisplay(depthMetres) {
    depthValueDisplay.textContent = depthMetres + ' m';
  }

  // ── TIME DISPLAY ───────────────────────────────────────────
  function setTimeDisplay(timeIndex) {
    const date = TIME_STEPS[timeIndex];
    timeLabelEl.textContent = date + '\u00a0\u00a0·\u00a0\u00a0Step ' +
      (timeIndex + 1) + ' / ' + TIME_STEPS.length;
    document.getElementById('time-scrubber').value = timeIndex;
  }

  // ── PLAY STATE ─────────────────────────────────────────────
  function setPlayState(isPlaying) {
    playIcon.textContent = isPlaying ? '⏸' : '▶';
    playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playPauseBtn.classList.toggle('playing', isPlaying);
    setStatus(isPlaying ? 'Animating' : 'Ready', isPlaying);
  }

  // ── COLORBAR ───────────────────────────────────────────────
  /**
   * NOTE FOR TEAMMATE (scene.js):
   * VARIABLE_META[variable].colorStops should match your 3D colour ramp.
   */
  function updateColorbar(variable) {
    const meta  = VARIABLE_META[variable];
    colorbar.style.background =
      'linear-gradient(to right, ' + meta.colorStops.join(', ') + ')';
    colorbarMin.textContent  = meta.min;
    colorbarMax.textContent  = meta.max;
    colorbarUnit.textContent = meta.label + ' (' + meta.unit + ')';
  }

  // ── STATUS BAR ─────────────────────────────────────────────
  function setStatus(text, active) {
    statusText.textContent = text || 'Ready';
    statusDot.classList.toggle('active', !!active);
  }

  // ── MODAL ──────────────────────────────────────────────────
  function openModal(floatData) {
    modalTitle.textContent    = 'Float ' + floatData.id;
    modalSubtitle.textContent = 'Model vs. Observation · ' + floatData.deployedDate;

    const items = [
      ['Float ID',  floatData.id],
      ['Latitude',  floatData.lat.toFixed(2) + '°'],
      ['Longitude', floatData.lon.toFixed(2) + '°'],
      ['Deployed',  floatData.deployedDate],
    ];

    modalFooter.innerHTML = items.map(function (pair) {
      return '<span class="meta-item">' +
        '<span class="meta-key">' + pair[0] + '</span>' +
        '<span class="meta-val">' + pair[1] + '</span>' +
        '</span>';
    }).join('');

    modalOverlay.setAttribute('aria-hidden', 'false');
    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.setAttribute('aria-hidden', 'true');
    modalOverlay.classList.remove('open');
  }

  // ── PLACEHOLDER ────────────────────────────────────────────
  /**
   * NOTE FOR TEAMMATE (scene.js):
   * Call window.OceanUI.hidePlaceholder() after renderer mounts,
   * or dispatch new Event('sceneReady') on window.
   */
  function hidePlaceholder() {
    const el = document.getElementById('scene-placeholder');
    if (el) el.classList.add('hidden');
    setStatus('Scene active', true);
  }

  // ── EXPORT ─────────────────────────────────────────────────
  window.OceanUI = {
    setDepthDisplay,
    setTimeDisplay,
    setPlayState,
    updateColorbar,
    setStatus,
    openModal,
    closeModal,
    hidePlaceholder,
  };

  console.log('[ui] loaded');
}());
