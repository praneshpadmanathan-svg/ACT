# Rank highlight and type correction

The supplied screenshot shows the selection outline offset left of the badge
and label. Each absolutely positioned rung now has an explicit width matching
its button, so its percentage translation centres the correct box. The aura
is centred inside a fixed-width art slot instead of contributing its oversized
footprint to the item's intrinsic width. All ranks share the same art-slot
height and label baseline. Hover no longer shifts the button.

Rank names use bold Inter at a larger size, normal casing and normal tracking.
XP, expand and state labels are enlarged. Locked status dims only the artwork,
not the text or focus outline. Track spacing and vertical headroom accommodate
the larger labels and font-size preference. Narrow screens scroll the ladder.

Verified with production build and the existing test suite. Screenshot guided
the diagnosis; a rendered after-image is not included in this change.
