/**
 * dataShapes.js — Mock ocean data.
 * Loaded as a plain <script> tag — exposes everything on window.OceanData.
 *
 * Replace with real API data later; keep the same object shape so
 * controls.js and ui.js need no changes.
 */

(function () {
  'use strict';

  // ── AXIS DEFINITIONS ──────────────────────────────────────

  /** Depth levels in metres (0 = surface, 2000 = deep). */
  const DEPTH_LEVELS = [0, 100, 200, 500, 1000, 2000];

  /** Simulated monthly time steps. */
  const TIME_STEPS = [
    '2024-01-01',
    '2024-02-01',
    '2024-03-01',
    '2024-04-01',
    '2024-05-01',
    '2024-06-01',
  ];

  const LAT_RANGE = { min: 20, max: 50, count: 7 };
  const LON_RANGE = { min: -60, max: -20, count: 9 };

  // ── HELPERS ───────────────────────────────────────────────

  function seededRand(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Generate one lat×lon slice of values.
   * @returns {number[][]}  [latIndex][lonIndex]
   */
  function makeSlice(variable, depthIndex, timeIndex) {
    const nLat = LAT_RANGE.count;
    const nLon = LON_RANGE.count;
    const slice = [];

    for (let li = 0; li < nLat; li++) {
      const row = [];
      for (let lo = 0; lo < nLon; lo++) {
        const seed = variable === 'temperature'
          ? li * 100 + lo + depthIndex * 1000 + timeIndex * 10000
          : li * 200 + lo + depthIndex * 2000 + timeIndex * 20000;

        const noise = seededRand(seed) * 2 - 1;
        let value;

        if (variable === 'temperature') {
          const baseTemp      = lerp(28, 5, depthIndex / (DEPTH_LEVELS.length - 1));
          const latGradient   = lerp(4, -4, li / (nLat - 1));
          const seasonalShift = Math.sin((timeIndex / TIME_STEPS.length) * Math.PI) * 3;
          value = baseTemp + latGradient + seasonalShift + noise;
        } else {
          const baseSal     = lerp(35.5, 34.0, depthIndex / (DEPTH_LEVELS.length - 1));
          const latGradient = lerp(-0.5, 0.5, li / (nLat - 1));
          value = baseSal + latGradient + noise * 0.5;
        }

        row.push(parseFloat(value.toFixed(3)));
      }
      slice.push(row);
    }
    return slice;
  }

  /**
   * Full 4-D grid: GRID_DATA[timeIndex][depthIndex][variable] → number[][]
   *
   * Access pattern:
   *   const slice = GRID_DATA[timeIndex][depthIndex]['temperature'];
   *   const val   = slice[latIndex][lonIndex];
   */
  const GRID_DATA = TIME_STEPS.map(function (_, ti) {
    return DEPTH_LEVELS.map(function (_, di) {
      return {
        temperature: makeSlice('temperature', di, ti),
        salinity:    makeSlice('salinity',    di, ti),
      };
    });
  });

  // ── ARGO FLOATS ───────────────────────────────────────────

  /**
   * Each float: { id, lat, lon, deployedDate, profile[] }
   * profile[i]: { depth, modelTemp, obsTemp, modelSal, obsSal }
   */
  const ARGO_FLOATS = [
    {
      id: 'ARGO-001',
      lat: 32.5,
      lon: -45.0,
      deployedDate: '2024-01-15',
      profile: DEPTH_LEVELS.map(function (depth, di) {
        const n = DEPTH_LEVELS.length - 1;
        return {
          depth:     depth,
          modelTemp: parseFloat((lerp(24, 4, di / n) + (seededRand(di * 11) - 0.5) * 1.5).toFixed(2)),
          obsTemp:   parseFloat((lerp(24, 4, di / n) + (seededRand(di * 13) - 0.5) * 2.0).toFixed(2)),
          modelSal:  parseFloat((lerp(36.0, 34.5, di / n) + (seededRand(di * 17) - 0.5) * 0.3).toFixed(3)),
          obsSal:    parseFloat((lerp(36.0, 34.5, di / n) + (seededRand(di * 19) - 0.5) * 0.5).toFixed(3)),
        };
      }),
    },
    {
      id: 'ARGO-002',
      lat: 40.1,
      lon: -30.7,
      deployedDate: '2024-02-03',
      profile: DEPTH_LEVELS.map(function (depth, di) {
        const n = DEPTH_LEVELS.length - 1;
        return {
          depth:     depth,
          modelTemp: parseFloat((lerp(18, 3, di / n) + (seededRand(di * 23) - 0.5) * 1.5).toFixed(2)),
          obsTemp:   parseFloat((lerp(18, 3, di / n) + (seededRand(di * 29) - 0.5) * 2.0).toFixed(2)),
          modelSal:  parseFloat((lerp(35.5, 34.2, di / n) + (seededRand(di * 31) - 0.5) * 0.3).toFixed(3)),
          obsSal:    parseFloat((lerp(35.5, 34.2, di / n) + (seededRand(di * 37) - 0.5) * 0.5).toFixed(3)),
        };
      }),
    },
    {
      id: 'ARGO-003',
      lat: 25.8,
      lon: -52.3,
      deployedDate: '2024-03-11',
      profile: DEPTH_LEVELS.map(function (depth, di) {
        const n = DEPTH_LEVELS.length - 1;
        return {
          depth:     depth,
          modelTemp: parseFloat((lerp(27, 6, di / n) + (seededRand(di * 41) - 0.5) * 1.5).toFixed(2)),
          obsTemp:   parseFloat((lerp(27, 6, di / n) + (seededRand(di * 43) - 0.5) * 2.0).toFixed(2)),
          modelSal:  parseFloat((lerp(36.8, 34.8, di / n) + (seededRand(di * 47) - 0.5) * 0.3).toFixed(3)),
          obsSal:    parseFloat((lerp(36.8, 34.8, di / n) + (seededRand(di * 53) - 0.5) * 0.5).toFixed(3)),
        };
      }),
    },
  ];

  // ── VARIABLE METADATA ─────────────────────────────────────

  /**
   * VARIABLE_META — display info + colorbar config per variable.
   *
   * NOTE FOR TEAMMATE (scene.js):
   * colorStops are the CSS colors for the data range low → high.
   * Use the same ramp in your Three.js material vertex colours so
   * this sidebar legend matches the 3D plane render.
   */
  const VARIABLE_META = {
    temperature: {
      label:      'Temperature',
      unit:       '°C',
      min:        0,
      max:        30,
      colorStops: ['#0d3b8e', '#2196f3', '#4caf50', '#ffeb3b', '#f44336'],
    },
    salinity: {
      label:      'Salinity',
      unit:       'PSU',
      min:        33,
      max:        38,
      colorStops: ['#1a237e', '#3949ab', '#64b5f6', '#e0f7fa', '#ffffff'],
    },
  };

  // ── EXPORT on window ──────────────────────────────────────
  window.OceanData = {
    DEPTH_LEVELS,
    TIME_STEPS,
    LAT_RANGE,
    LON_RANGE,
    GRID_DATA,
    ARGO_FLOATS,
    VARIABLE_META,
  };

  console.log('[dataShapes] loaded —',
    TIME_STEPS.length, 'time steps ×',
    DEPTH_LEVELS.length, 'depth levels ×',
    LAT_RANGE.count, '×', LON_RANGE.count, 'grid');

}());
