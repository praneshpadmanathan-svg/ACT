# Original practice expansion

Adds 593 original focused exercises: English 153, Math 240, Reading 100,
Science 100, with 20 original reading passages and 20 synthetic datasets.
Includes controlled variants; these are not official ACT questions.

All additions live in `src/content/expansion.json`. Existing question and
passage files remain unchanged. The loader appends the batch and the content
validator checks the combined bank. Focused exercises are excluded from timed
assessment sampling. Authoring sources are in `scripts/expand-bank-2000.mjs`
and `scripts/expansion-reading.mjs`.
