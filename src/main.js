// Hayla: how the scroll story works
// ---------------------------------------------------------------------------
// Behind the page sits one fixed, full-screen <video> of a coffee being made.
// It never plays on its own. Instead, every time you scroll we work out how far
// through the story you are and jump the video to the matching moment.
// Scroll down and the cup fills; scroll back up and it empties again.
//
// The pieces, in order:
//   1. Lenis smooths the scroll and tells GSAP ScrollTrigger when it moves.
//   2. storyProgress() turns the scroll position into a number from 0 to 5,
//      one unit per beat of the story (beans, grind, brew, pour, cup).
//   3. filmTimeFor() turns that number into a time in the film, so each beat
//      gets an equal share of scrolling even though the film spends more
//      seconds on some stages than others.
//   4. requestSeek() moves the video there without flooding the browser.
// Phones get a lighter square cut of the same film, pinned at the top of the
// screen with the text scrolling underneath. People who prefer reduced motion
// skip all of this and get five still frames, one above each block of text.
// ---------------------------------------------------------------------------

import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

if ("scrollRestoration" in history) history.scrollRestoration = "manual"; // the story always starts at the beans

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Must match the media query on .bg-video in style.css exactly.
const STATIC_HERO = matchMedia("(prefers-reduced-motion: reduce)");
const PHONE = matchMedia("(max-width: 768px)").matches;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
const goStatic = () => document.body.classList.add("is-static");
if (STATIC_HERO.matches) goStatic();

// ---- 1. Smooth scrolling ---------------------------------------------------
// Lenis eases the wheel; on each of its frames we let ScrollTrigger recalculate.
// GSAP's ticker drives Lenis so both share a single animation frame.
let lenis = null;
if (!REDUCED) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// In-page links go through Lenis so they glide instead of jumping.
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView();
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
});

// ---- 2. Where are we in the story? ----------------------------------------
// We pin five "keypoints" on the page, measured where the middle of the
// screen sits:
//   story top          -> 0      (the first beans start to fall)
//   centre of beat 1   -> 0.5    (beans mid-tumble)
//   centre of beat 2   -> 1.5    ...one per beat...
//   centre of beat 5   -> 4.5
//   end of the story   -> 5      (the cup at rest)
// Between two keypoints we interpolate in a straight line.
const story = document.getElementById("story");
const beats = [...document.querySelectorAll(".beat")];
let keys = [];

function measureKeys() {
  const pageY = (el) => el.getBoundingClientRect().top + window.scrollY;
  const top = pageY(story);
  // On phones the film band is on screen from the first moment, so the beans
  // start as soon as you scroll. That also spreads the busiest stretch of the
  // film (4 s of falling beans) over almost twice the scroll distance.
  keys = [{ y: PHONE ? Math.min(top, innerHeight / 2) : top, u: 0 }];
  beats.forEach((b, i) => keys.push({ y: pageY(b) + b.offsetHeight / 2, u: i + 0.5 }));
  keys.push({ y: top + story.offsetHeight - innerHeight / 2, u: beats.length });
}

function storyProgress() {
  // ScrollTrigger can fire onUpdate before onRefresh when the story already
  // peeks onto the first screen (seen on an Honor 9X in Chrome). Without this
  // keys[] is empty, the read below throws, and the rest of the script, the
  // film included, never runs.
  if (!keys.length) measureKeys();
  const y = window.scrollY + innerHeight / 2; // the middle of the screen, in page coordinates
  if (y <= keys[0].y) return 0;
  for (let i = 1; i < keys.length; i++) {
    if (y <= keys[i].y) {
      const a = keys[i - 1], b = keys[i];
      return a.u + ((y - a.y) / (b.y - a.y)) * (b.u - a.u);
    }
  }
  return beats.length;
}

// ---- 3. Story progress -> film time ----------------------------------------
// Where each stage starts and ends in the film, in seconds:
// beans 0-4, grind 4-7.4, brew 7.4-9, pour 9-12.5, cup 12.5 to the end.
const STAGE_TIMES = [0, 4.0, 7.4, 9.0, 12.5, 15.4];

function filmTimeFor(u) {
  const i = Math.min(Math.floor(u), STAGE_TIMES.length - 2); // which stage we are in
  const f = u - i;                                           // how far through it, 0 to 1
  return STAGE_TIMES[i] + f * (STAGE_TIMES[i + 1] - STAGE_TIMES[i]);
}

// ---- 4. Moving the video without flooding the browser ----------------------
// Setting video.currentTime starts a "seek". If we set it again before the
// previous seek finishes, browsers stutter. So we keep at most one seek in
// flight and remember only the latest wanted time.
const bgVideo = document.getElementById("bgv");
let seekBusy = false, pendingTime = null, lastVideoT = -1;

let seekWatchdog = 0;
function requestSeek(t) {
  if (!bgVideo.duration) return;
  t = Math.min(t, bgVideo.duration - 0.05);
  if (Math.abs(t - lastVideoT) < 0.008) return;   // already there
  if (seekBusy) { pendingTime = t; return; }       // wait for the current seek
  seekBusy = true; lastVideoT = t; bgVideo.currentTime = t;
  // Some older Android decoders occasionally never fire "seeked". Without this
  // the film would freeze on its first frame for the rest of the visit.
  clearTimeout(seekWatchdog);
  seekWatchdog = setTimeout(() => {
    seekBusy = false;
    if (pendingTime !== null) { const p = pendingTime; pendingTime = null; requestSeek(p); }
  }, 1000);
}
bgVideo.addEventListener("seeked", () => {
  clearTimeout(seekWatchdog);
  seekBusy = false;
  if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
});
bgVideo.addEventListener("error", () => { seekBusy = false; pendingTime = null; failVideo(); });

function failVideo() {
  document.body.classList.add("video-failed");
  goStatic();                // no film: show the five still frames instead
  ScrollTrigger.refresh();
}

// ---- The signature gauge: a slim glass tube that fills as the story plays ----
const gaugeFill = document.querySelector(".gauge__fill");
const gaugeLabels = [...document.querySelectorAll(".gauge__labels li")];

// On phones the scroll is the finger's own (Lenis only smooths the mouse
// wheel), so a quick flick asks for a big jump in the film in one go and it
// looks like a stutter. There the film eases towards the wanted moment over a
// few frames instead, the way Lenis eases the scroll on desktop. This also
// makes the film glide into place, rather than snap, if it finishes loading
// after you have already scrolled.
let filmTarget = 0, filmShown = 0;
if (PHONE) {
  gsap.ticker.add(() => {
    if (!bgVideo.duration || document.body.classList.contains("is-static")) return;
    const d = filmTarget - filmShown;
    if (Math.abs(d) < 0.004) return;
    filmShown = Math.abs(d) < 0.02 ? filmTarget : filmShown + d * 0.22;
    requestSeek(filmShown);
  });
}

// Phones: the film runs at one steady speed for the whole story, the same
// number of frames for every centimetre scrolled. Matching each paragraph to
// its stage made some stretches crawl (the 1.6 s brew spread over a whole
// paragraph looked stuck) and others rush (4 s of beans in the same space).
// The paragraphs still arrive roughly with their stage; smoothness wins.
function steadyFilmTime() {
  if (!keys.length) measureKeys();
  const start = keys[0].y, end = keys[keys.length - 1].y;
  const y = window.scrollY + innerHeight / 2;
  const f = Math.min(1, Math.max(0, (y - start) / (end - start)));
  return f * STAGE_TIMES[STAGE_TIMES.length - 1];
}

// One function runs on every scroll update and keeps film + gauge in sync.
function updateStory() {
  const u = storyProgress();
  if (PHONE) filmTarget = steadyFilmTime();
  else if (!document.body.classList.contains("is-static")) requestSeek(filmTimeFor(u));
  gsap.set(gaugeFill, { scaleY: u / beats.length });           // transform only, cheap
  const active = Math.min(beats.length - 1, Math.floor(u));
  gaugeLabels.forEach((li, i) => li.classList.toggle("is-on", i <= active && u > 0));
}

ScrollTrigger.create({
  trigger: story,
  start: "top bottom",
  end: "bottom top",
  onUpdate: updateStory,
  onRefresh: () => { measureKeys(); updateStory(); },
});
// The gauge shows only while the story fills the screen.
ScrollTrigger.create({
  trigger: story, start: "top 40%", end: "bottom 60%",
  onToggle: (self) => document.body.classList.toggle("in-story", self.isActive),
});

// Load the film as a Blob so seeking works even on hosts without HTTP Range
// support (common on shared hosting). Phones get the 720px square cut (6 MB
// instead of 11 MB, every frame a keyframe so seeks stay cheap); reduced-motion visitors never download either.
async function initVideo() {
  if (document.body.classList.contains("is-static")) return;
  try {
    // Relative paths, so the site also works from a subfolder (GitHub Pages).
    const res = await fetch(PHONE ? "film-mobile.mp4" : "film.mp4");
    if (!res.ok) throw new Error(res.status);
    const blob = await res.blob();
    // The HTML says preload="none" so nothing downloads before we decide which
    // cut to use. Now the whole file is already in memory, so switch to "auto":
    // older Android browsers (e.g. Huawei/Honor) honour "none" even after
    // load() and never decode the metadata, leaving the film stuck.
    bgVideo.preload = "auto";
    bgVideo.muted = true;   // the attribute alone is not enough on some Android browsers
    bgVideo.src = URL.createObjectURL(blob);
    // If the film is still not usable after a while (decoder refused it,
    // browser stalled), show the five still frames instead of a frozen poster.
    const giveUp = setTimeout(() => { if (!bgVideo.duration) failVideo(); }, 8000);
    bgVideo.addEventListener("loadeddata", () => {
      clearTimeout(giveUp);
      // iOS Safari only paints seeked frames once a muted video has played,
      // so play it for an instant and pause straight away. Android paints
      // seeked frames without this, and some Android browsers (Huawei's
      // included) open their own floating/fullscreen player on play(), so
      // only do it on iOS.
      if (IOS) bgVideo.play().then(() => bgVideo.pause()).catch(() => {});
      // Wake the phone's decoder now with one tiny seek, so the first swipe
      // does not pay for starting it (that showed up as a hitch at the top).
      if (PHONE) requestSeek(0.04);
      document.body.classList.add("video-ready");
      updateStory();
    }, { once: true });
    bgVideo.load();
  } catch { failVideo(); }
}
initVideo();

// On phones the film sits in a band above the text, so it fades out once the
// story is over and the menu scrolls up.
ScrollTrigger.create({
  trigger: story, start: "bottom 75%",
  onEnter: () => document.body.classList.add("past-story"),
  onLeaveBack: () => document.body.classList.remove("past-story"),
});

// ---- Text reveals and the dimmer -------------------------------------------
if (!REDUCED) {
  // Each beat's copy rises in as it enters (opacity + transform only).
  beats.forEach((beat) => {
    gsap.fromTo(beat.querySelector(".beat__copy"), { autoAlpha: 0, y: 48 }, {
      autoAlpha: 1, y: 0, duration: 0.9, ease: "power2.out",
      scrollTrigger: { trigger: beat, start: "top 70%", toggleActions: "play none none reverse" },
    });
  });
  gsap.utils.toArray(".menu .item, .facts > div").forEach((el) => {
    gsap.fromTo(el, { autoAlpha: 0, y: 24 }, {
      autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
    });
  });
}

// After the story the film dims so the menu reads cleanly over it.
// Only this scrub ever touches .stage-dim (a second tween would break it).
gsap.to(".stage-dim", {
  opacity: 0.82, ease: "none",
  scrollTrigger: { trigger: story, start: "bottom 90%", end: "bottom 30%", scrub: true },
});

// The "Scroll to brew" hint fades once the visitor starts scrolling.
gsap.to(".scroll-hint", {
  autoAlpha: 0, ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true },
});

// ---- Live atmosphere (desktop only; three.js loads after the text paints)
// Phones skip it: a WebGL layer redrawn every frame competes with the video
// decoder for the same GPU, which made scrubbing lag on mid-range Android.
if (!PHONE && !document.body.classList.contains("is-static")) {
  import("./atmosphere.js").then(({ initAtmosphere }) => initAtmosphere({ lenis }));
}

// ---- Table request form ------------------------------------------------------
// Hayla is fictional, so nothing is sent anywhere: the form only confirms.
const form = document.getElementById("book");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const done = form.querySelector(".book__done");
  if (!form.checkValidity()) {
    done.textContent = "Please add your name, the number of guests and a day.";
    form.querySelector(":invalid")?.focus();
    return;
  }
  const name = form.elements.name.value.trim().split(" ")[0];
  done.textContent = `Thank you, ${name}. This is a demo site, so no booking was sent, but in real life we would call you to confirm.`;
  form.classList.add("is-done");
});

window.__haylaRan = true;

// ---- Diagnostics: add ?debug to the address to see what the film is doing ----
if (/[?&]debug\b/.test(location.search)) {
  const box = document.getElementById("dbg") || document.body.appendChild(document.createElement("pre"));
  box.style.cssText ="position:fixed;left:6px;right:6px;bottom:6px;z-index:9999;margin:0;padding:8px;" +
    "background:rgba(0,0,0,.85);color:#9f9;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:none;border-radius:4px";
  const log = [];
  const counts = {};
  ["loadstart","loadedmetadata","loadeddata","canplay","seeking","seeked","stalled","suspend","waiting","error","emptied","abort"]
    .forEach((ev) => bgVideo.addEventListener(ev, () => {
      counts[ev] = (counts[ev] || 0) + 1;
      if (counts[ev] <= 2) log.push(`${(performance.now() / 1000).toFixed(1)}s ${ev}`);
    }));
  window.addEventListener("error", (e) => log.push("JS error: " + e.message));
  const cs = getComputedStyle(bgVideo);
  const render = () => {
    const r = bgVideo.getBoundingClientRect();
    box.textContent = [
      "debug v3 (main code running)",
      ...(window.__dbgErrors || []).slice(-3).map((e) => "error: " + e),
      navigator.userAgent.replace(/^Mozilla\/5\.0 /, ""),
      `screen ${innerWidth}x${innerHeight} dpr ${devicePixelRatio}  phone ${PHONE}  reducedMotion ${REDUCED}  iOS ${IOS}`,
      `body: ${document.body.className || "(none)"}`,
      `h264: ${bgVideo.canPlayType('video/mp4; codecs="avc1.64001F"') || "no"}  src: ${bgVideo.src ? bgVideo.src.slice(0, 5) : "(none)"}`,
      `ready ${bgVideo.readyState} net ${bgVideo.networkState} dur ${bgVideo.duration} t ${bgVideo.currentTime.toFixed(2)} err ${bgVideo.error ? bgVideo.error.code + " " + bgVideo.error.message : "-"}`,
      `video box ${Math.round(r.width)}x${Math.round(r.height)} display ${cs.display} opacity ${getComputedStyle(bgVideo).opacity}`,
      `seeked x${counts.seeked || 0}  seeking x${counts.seeking || 0}`,
      ...log.slice(-8),
    ].join("\n");
  };
  setInterval(render, 400);
}

if (import.meta.env.DEV) { window.__bgv = bgVideo; window.__lenis = lenis; window.__ST = ScrollTrigger; window.__story = { storyProgress, filmTimeFor }; }
