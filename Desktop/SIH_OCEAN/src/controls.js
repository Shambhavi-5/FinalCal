/**
 * controls.js — Application state, control wiring, animation, and profile chart.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTERFACE WITH scene.js  (teammate's file)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1.  window.updateSlicePlane(depth, variable, gridSlice)
 *     Called every time state changes (slider, dropdown, animation tick).
 *     gridSlice is a 2-D number array [latIndex][lonIndex].
 *     scene.js must expose this on window before — or at any point after —
 *     the page loads; controls.js guards against it being absent.
 *
 * 2.  CustomEvent "argoMarkerClick" dispatched on window
 *     scene.js fires this when the user clicks an Argo marker.
 *     event.detail must be a full Argo float object (shape: dataShapes.js).
 *       window.dispatchEvent(new CustomEvent('argoMarkerClick', { detail: floatObj }));
 *
 * 3.  CustomEvent "sceneReady" dispatched on window  [optional]
 *     scene.js fires this once the Three.js renderer has mounted, so
 *     controls.js can hide the dev-mode placeholder overlay.
 *       window.dispatchEvent(new Event('sceneReady'));
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const {
    GRID_DATA, DEPTH_LEVELS, TIME_STEPS, ARGO_FLOATS, VARIABLE_META,
  } = window.OceanData;

  const UI = window.OceanUI;

  // ── SHARED STATE ───────────────────────────────────────────────────────────
  //
  // Single source of truth for the entire UI + scene.
  // All controls read from and write to this object,
  // then call applyStateToScene().

  var currentState = {
    depth:      DEPTH_LEVELS[0],      // metres
    depthIndex: 0,                    // index into DEPTH_LEVELS
    variable:   'temperature',        // 'temperature' | 'salinity'
    timeIndex:  0,                    // index into TIME_STEPS
  };

  // ── SCENE BRIDGE ──────────────────────────────────────────────────────────

  function getCurrentSlice() {
    return GRID_DATA[currentState.timeIndex][currentState.depthIndex][currentState.variable];
  }

  /**
   * applyStateToScene()
   *
   * THE central update function. Every control calls this after mutating
   * currentState. It syncs the UI and calls window.updateSlicePlane().
   *
   * NOTE FOR TEAMMATE (scene.js):
   *   window.updateSlicePlane(depth, variable, gridSlice)
   *   gridSlice = GRID_DATA[timeIndex][depthIndex][variable]
   *   — a 2-D number array you can map onto your plane geometry vertex colours.
   */
  function applyStateToScene() {
    var depth     = currentState.depth;
    var variable  = currentState.variable;
    var timeIndex = currentState.timeIndex;
    var slice     = getCurrentSlice();

    // Sync UI labels / colorbar
    UI.setDepthDisplay(depth);
    UI.setTimeDisplay(timeIndex);
    UI.updateColorbar(variable);

    // Dev log — shows state + a sample grid value each update
    console.log('[controls] applyStateToScene →', {
      depth:           depth,
      variable:        variable,
      date:            TIME_STEPS[timeIndex],
      timeIndex:       timeIndex,
      sliceDimensions: slice.length + ' × ' + slice[0].length,
      sampleValue:     slice[0][0],
    });

    // Call scene.js bridge (safe if scene not loaded yet)
    if (typeof window.updateSlicePlane === 'function') {
      window.updateSlicePlane(depth, variable, slice);
    } else {
      console.debug('[controls] window.updateSlicePlane not ready yet (scene.js not loaded)');
    }
  }

  // ── DEPTH SLIDER ──────────────────────────────────────────────────────────

  var depthSlider = document.getElementById('depth-slider');
  depthSlider.min   = DEPTH_LEVELS[0];
  depthSlider.max   = DEPTH_LEVELS[DEPTH_LEVELS.length - 1];
  depthSlider.value = currentState.depth;

  depthSlider.addEventListener('input', function () {
    var raw = Number(depthSlider.value);

    // Snap to nearest defined depth level
    var snapped = DEPTH_LEVELS.reduce(function (prev, curr) {
      return Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev;
    });

    currentState.depth      = snapped;
    currentState.depthIndex = DEPTH_LEVELS.indexOf(snapped);

    console.log('[controls] depth →', snapped, 'm');
    applyStateToScene();
  });

  // ── VARIABLE DROPDOWN ─────────────────────────────────────────────────────

  var variableSelect = document.getElementById('variable-select');
  variableSelect.value = currentState.variable;

  variableSelect.addEventListener('change', function () {
    currentState.variable = variableSelect.value;
    console.log('[controls] variable →', currentState.variable);
    applyStateToScene();
  });

  // ── TIME ANIMATION ────────────────────────────────────────────────────────

  var timeScrubber      = document.getElementById('time-scrubber');
  var playPauseBtn      = document.getElementById('btn-play-pause');
  var animationInterval = null;
  var isPlaying         = false;

  timeScrubber.max = TIME_STEPS.length - 1;

  function tickTime() {
    currentState.timeIndex = (currentState.timeIndex + 1) % TIME_STEPS.length;
    applyStateToScene();
  }

  function startAnimation() {
    if (isPlaying) return;
    isPlaying = true;
    UI.setPlayState(true);
    animationInterval = setInterval(tickTime, 1000);
    console.log('[controls] animation started');
  }

  function stopAnimation() {
    if (!isPlaying) return;
    isPlaying = false;
    UI.setPlayState(false);
    clearInterval(animationInterval);
    animationInterval = null;
    console.log('[controls] animation stopped');
  }

  playPauseBtn.addEventListener('click', function () {
    isPlaying ? stopAnimation() : startAnimation();
  });

  // Manual scrub: pause and jump to chosen step
  timeScrubber.addEventListener('input', function () {
    stopAnimation();
    currentState.timeIndex = Number(timeScrubber.value);
    console.log('[controls] time scrubbed → index', currentState.timeIndex);
    applyStateToScene();
  });

  // ── PROFILE CHART ─────────────────────────────────────────────────────────

  var chartCanvas  = document.getElementById('profile-chart-canvas');
  var profileChart = null; // Chart.js instance

  /**
   * buildProfileChart()
   * Renders a depth-profile line chart.
   *   - Depth on Y-axis, inverted (deeper = lower on screen)
   *   - Variable value on X-axis
   *   - Two datasets: Model (blue) and Observation (orange dashed)
   *
   * @param {Object} floatData  — Argo float object from dataShapes.js
   * @param {string} variable   — 'temperature' | 'salinity'
   */
  function buildProfileChart(floatData, variable) {
    if (profileChart) {
      profileChart.destroy();
      profileChart = null;
    }

    var meta      = VARIABLE_META[variable];
    var profile   = floatData.profile;
    var depths    = profile.map(function (p) { return p.depth; });
    var modelKey  = variable === 'temperature' ? 'modelTemp' : 'modelSal';
    var obsKey    = variable === 'temperature' ? 'obsTemp'   : 'obsSal';
    var modelVals = profile.map(function (p) { return p[modelKey]; });
    var obsVals   = profile.map(function (p) { return p[obsKey]; });

    profileChart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: depths,
        datasets: [
          {
            label:           'Model',
            data:            modelVals,
            borderColor:     '#00b4d8',
            backgroundColor: 'rgba(0,180,216,0.15)',
            borderWidth:     2,
            pointRadius:     5,
            tension:         0.35,
          },
          {
            label:           'Observation',
            data:            obsVals,
            borderColor:     '#f97316',
            backgroundColor: 'rgba(249,115,22,0.15)',
            borderWidth:     2,
            pointRadius:     5,
            borderDash:      [5, 4],
            tension:         0.35,
          },
        ],
      },
      options: {
        indexAxis: 'y',          // depth on Y-axis
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title:   { display: true, text: 'Depth (m)', color: '#7fb3cc' },
            reverse: true,       // deeper = lower on screen
            ticks:   {
              color: '#7fb3cc',
              callback: function (v) { return v + ' m'; },
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          x: {
            title: { display: true, text: meta.label + ' (' + meta.unit + ')', color: '#7fb3cc' },
            ticks: { color: '#7fb3cc' },
            grid:  { color: 'rgba(255,255,255,0.06)' },
          },
        },
        plugins: {
          legend: {
            labels: { color: '#e0f2fe', boxWidth: 14, padding: 16 },
          },
          tooltip: {
            callbacks: {
              title: function (items) { return 'Depth: ' + items[0].label + ' m'; },
              label: function (item)  {
                return ' ' + item.dataset.label + ': ' + item.raw + ' ' + meta.unit;
              },
            },
          },
        },
      },
    });
  }

  /**
   * openProfileForFloat()
   * Opens the modal and renders the chart for the given Argo float.
   * Called from argoMarkerClick and the demo button.
   *
   * @param {Object} floatData — Argo float object
   */
  function openProfileForFloat(floatData) {
    console.log('[controls] opening profile for', floatData.id);
    UI.openModal(floatData);

    // rAF ensures the modal's CSS transition runs before Chart.js sizes itself
    requestAnimationFrame(function () {
      buildProfileChart(floatData, currentState.variable);
    });
  }

  // ── ARGO MARKER CLICK — scene.js fires this ───────────────────────────────
  //
  // NOTE FOR TEAMMATE (scene.js):
  //   window.dispatchEvent(new CustomEvent('argoMarkerClick', {
  //     detail: argoFloatObject   // shape defined in dataShapes.js
  //   }));

  window.addEventListener('argoMarkerClick', function (event) {
    var floatData = event.detail;
    console.log('[controls] argoMarkerClick received →', floatData.id);
    openProfileForFloat(floatData);
  });

  // ── DEMO PROFILE BUTTON ───────────────────────────────────────────────────

  document.getElementById('btn-demo-profile').addEventListener('click', function () {
    console.log('[controls] demo profile triggered');
    openProfileForFloat(ARGO_FLOATS[0]);
  });

  // ── CLOSE MODAL ───────────────────────────────────────────────────────────

  document.getElementById('btn-close-modal').addEventListener('click', UI.closeModal);

  document.getElementById('modal-overlay').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) UI.closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') UI.closeModal();
  });

  // ── SCENE READY ───────────────────────────────────────────────────────────
  //
  // NOTE FOR TEAMMATE (scene.js):
  //   window.dispatchEvent(new Event('sceneReady'));

  window.addEventListener('sceneReady', function () {
    console.log('[controls] sceneReady — hiding placeholder');
    UI.hidePlaceholder();
  });

  // ── INITIAL RENDER ────────────────────────────────────────────────────────

  applyStateToScene();

  console.log('[controls] initialized. State:', currentState);
  console.log('[controls] TIME_STEPS:', TIME_STEPS);
  console.log('[controls] DEPTH_LEVELS:', DEPTH_LEVELS);
  console.log('[controls] ARGO_FLOATS:', ARGO_FLOATS.map(function (f) { return f.id; }));

}());
