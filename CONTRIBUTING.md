# Contributing

## Adding or fixing words

Words live in `data/hiragana.json` and `data/katakana.json`, one entry per line:

```json
{"kana":"さくら","kanji":"桜","meaning":"cherry blossom","jlpt":5}
```

| Field     | Required | Notes |
|-----------|----------|-------|
| `kana`    | yes      | The word as it's practised. Hiragana only in the hiragana deck, katakana only in the katakana deck. Use a normal space between words in a phrase (ちょっと まって ください). |
| `meaning` | yes      | Short English meaning. Separate senses with `;`. |
| `jlpt`    | no       | JLPT level, 5 (N5, easiest) to 1 (N1). Leave it out for everyday words that aren't on the JLPT lists; those are introduced with N5. |
| `kanji`   | no       | How the word is usually written, shown next to the meaning. Separate same-sounding words with `・`. |
| `reading` | no       | Only when the kana alone would give the wrong rōmaji, usually because of a particle: `{"kana":"これは なんですか","reading":"kore wa nan desu ka",...}`. |

The rōmaji shown to learners is generated from the kana (Hepburn with macrons), and reading
difficulty is worked out from the kana too, so you don't need to write either.

Then run:

```bash
npm test
```

The data tests check that every entry is complete, has no duplicates, uses only one script, has
balanced brackets, and accepts its own reading.

New words are introduced level by level (N5 first), then by reading difficulty, in a fixed shuffled
order. Adding words changes that order slightly, which is fine.

### Updating from the JLPT lists

`scripts/import-jlpt.mjs` merges the CSV files from
[open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (`src/n5.csv` … `src/n1.csv`)
into the decks. Existing entries keep their meaning and kanji and only gain a level; new words are
added. Running it twice changes nothing.

```bash
node scripts/import-jlpt.mjs path/to/folder-with-csv-files
```

## Changing the app

- There's no build step. Edit the files and reload.
- Run `npm test` before committing.
- If you add a file the app loads, add it to `ASSETS` in `sw.js` (a test checks this).
- When you release a change, bump the version in `sw.js`, `src/app.js` and `package.json` (a test
  checks they match). Installed copies then download the new files and offer a **Reload** button.
- If you add Japanese text with new kanji to the interface, rebuild the fonts so they include it:
  `python3 scripts/build-fonts.py path/to/original-ttf-files` (needs `pip install fonttools brotli`;
  the script lists where to get the original fonts).
- Pixel-art scenes are drawn in code in `src/scenes.js`. Add `?season=spring` (or summer, autumn,
  winter) to the address to preview another season.
