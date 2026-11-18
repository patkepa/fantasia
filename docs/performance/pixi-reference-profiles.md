# Pixi renderer reference profiles

The historical renderer benchmark used a fixed 1280×720 CSS-pixel viewport. Each generated fixture fixed the
seed and requested cell count. The legacy fixture was a map saved in version 1.139.4.

## Reference desktop

- Chromium stable, hardware acceleration enabled
- 1280×720 viewport
- device scale factor 1 unless a DPR-specific run is being recorded
- at least 8 logical CPU cores and 8 GB reported device memory
- no CPU throttling

## Constrained profile

- Chromium stable with 4× CPU throttling
- 1280×720 viewport
- device scale factor 2
- renderer memory policy overridden to the 2 GB device-memory class
- reduced motion enabled

Record the exact browser version, user agent, logical CPU count, reported device memory, DPR, selected Pixi backend,
canvas dimensions, and renderer resolution in every report. Reference results are only comparable when fixture,
viewport, browser major version, and profile match.

## Historical report

The [renderer benchmark report](../../artifacts/renderer-benchmark-report.json) records the active layer set,
browser, Pixi version, selected GPU backend, fixture, canvas resolution, and resource accounting. Each fixture
ran against the production Pixi renderer twice, serially. The GPU phase measured CPU submission of pending
Pixi resource uploads.
