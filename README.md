# Shafiuddin Syed — Portfolio & Projects

Personal portfolio and project hub hosted on GitHub Pages.

## Live Site
https://sshafiuddin.pages.dev (the old github.io address redirects here)

## Structure

```
/               → Portfolio site (index.html)
/iqama/         → Iqama Times prayer schedule app
```

## Other Projects
- **Wiki Jeopardy** → https://sshafiuddin-dev.github.io/wiki-jeopardy/

## Tech Stack
- HTML, CSS, JavaScript
- GitHub Pages (static hosting)
- Open-Meteo (weather backdrop and city search for Iqama Times, no key needed)
- mp3quran.net (reciters, surahs and recitation audio for the Quran tab of Iqama Times, no key needed)
- Motion (self-hosted in `vendor/`, used by the portfolio and by the Quran player through `iqama/motion.js`)
- GitHub Actions (copies ISCJ iqama times into `iqama/iqama.json` daily; test with `node scripts/selfcheck.mjs`)
