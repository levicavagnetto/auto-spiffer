# Design

## Context

CSS `overflow-hidden` rounds the renderer card but does not clip the separate native `WebContentsView`. Both ProRewards and Enter claims use the same native view. Rounding the native view also rounds the webpage, which is not the intended visual treatment.

## Decision

Set the native view border radius to zero when positioning it. Add a 16 px tall bottom bar after each screen's website slot. The bar uses the card surface color and a top border; the existing rounded, clipped card provides its lower corners. The site's bounds continue to follow the slot and therefore end above the new bar.

## Verification

In an Electron test, intercept `setBorderRadius` on the view and confirm it receives zero. Check the bottom bar sits directly below the website slot. The same view is reused on Enter claims.
