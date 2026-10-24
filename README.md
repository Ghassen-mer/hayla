# Hayla website

A single-page site for Hayla, a fictional Omani specialty coffee brand.
Brand decisions live in `../copy/brand-kit.md`.

## Run it

```bash
npm install
npm run dev                   # http://localhost:5173
npm run build -- --base=./    # portable static build in dist/
npx vite preview              # preview the build over HTTP (never open dist/ via file://)
```

## How it works

- `public/film.mp4` is a 15.5 s, 1080p film of a coffee being made (beans, grind,
  brew, pour, cup). It sits fixed behind the page and is scrubbed by scroll:
  scroll down and the cup fills, scroll up and it empties.
- `src/main.js` holds the scroll timeline, commented step by step:
  scroll position becomes story progress (0 to 5), story progress becomes a
  time in the film, and the video seeks there one seek at a time.
- `src/atmosphere.js` + `src/particles.js` draw slow amber motes (steam and
  incense) in a transparent WebGL layer over the film, on desktop only.
- Phones (768px wide or less) get `public/film-mobile.mp4`, a 720px square
  cut of the same film (about 4 MB), pinned in a band at the top of the screen
  with the text scrolling underneath. It scrubs the same way and fades out
  when the menu arrives.
- People with reduced motion turned on, and any visitor whose film fails to
  load, get five still frames (`public/img/stage-*.jpg`) stacked with the text
  instead, and never download a film.

## The table form

Hayla is fictional and its contact details are placeholders, so the
"Save a table" form sends nothing anywhere. It checks the fields and shows a
thank-you message in the page. To make it real, point it at a form service or
change it to a `mailto:` link with a real address.

## Before going live

Replace `https://example.com/` in the `og:url` and `og:image` tags in
`index.html` with the live address.
