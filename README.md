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
  cut of the same film (about 6 MB), pinned in a band at the top of the screen
  with the text scrolling underneath. It scrubs the same way and fades out
  when the menu arrives.
  Every frame of the phone cut is a keyframe, so each scroll step decodes one
  frame instead of up to eight; that is what keeps scrubbing smooth on
  mid-range Android. Re-encode it the same way if the film ever changes:
  from a square cut of the new film, run
  `ffmpeg -i square.mp4 -an -vf scale=720:720:flags=lanczos -c:v libx264 -profile:v main -pix_fmt yuv420p -g 1 -bf 0 -crf 26 -preset slow -tune film -movflags +faststart film-mobile.mp4`.
  Phones also skip the
  particle layer, which competed with the video for the GPU.
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
