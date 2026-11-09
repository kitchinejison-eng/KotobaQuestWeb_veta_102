const CACHE_NAME = 'kotoba-quest-veta-ver16-pc-judgement-1';
// Cache the small application shell during installation. Large photos, sound
// and optional recognition resources are cached only when actually requested.
const APP_SHELL = [
  './',
  './index.html',
  './logo.html',
  './opening-event.html',
  './manifest.webmanifest?v=105',
  './assets/icons/icon-192.png',
  './style.css?v=veta9-profile-dash',
  './difficulty-veta11.css?v=1',
  './title-responsive-beta3.css?v=3',
  './articulation-random-beta4.css?v=4',
  './responsive-beta6.css?v=6',
  './browser-responsive.css?v=89',
  './v47-improvements.css?v=jlect-choice-1',
  './kotoba-dungeon-pixel-veta13.css?v=1',
  './veta14-dungeon.css?v=2',
  './veta14-ui.css?v=2',
  './veta14-theme-sync.js?v=1',
  './fantasy-event-veta13.css?v=1',
  './pronunciation-training.css?v=89',
  './encoding-safe.js',
  './android-bridge-android.js?v=beta91-audio',
  './audio-mixer-v86.js?v=91',
  './kotoba-sound-pack-v2.js?v=2',
  './kotoba-upgrades-v2.js?v=2',
  './copy-handwriting-bank-v2.js?v=jlect-choice-1',
  './learning-mode-veta12.js?v=1',
  './adaptive-learning.js?v=veta12',
  './unified-learning-veta1.js?v=veta12',
  './event-message-sound.js?v=89',
  './offline-conversation-engine.js?v=91',
  './app.js?v=veta16-judgement',
  './user-profile.js?v=veta16-profile',
  './aphasia-modes.js?v=veta2',
  './app-ui.js?v=veta14-theme',
  './generative-ai-chat.js?v=veta16-answer-record',
  './ai-download-gate.js?v=99',
  './ai-download-gate.css?v=99',
  './pictogram-3d.html',
  './fact-bank-veta11.js?v=1',
  './daily-streak.js?v=108',
  './daily-streak.css?v=108',
  './kotoba-dungeon.html',
  './kotoba-dungeon.js?v=veta16-profile',
  './kotoba-dungeon.css',
  './reading-memory.html',
  './kotoba-quest-ud.html',
  './fantasy-v47.js?v=veta11-level100',
  './community-board.js',
  './reading-memory-mode.js',
  './v47-improvements.js?v=veta11-level100',
  './v57-task-rebuild.js?v=beta8-fixes',
  './question-expansion-v10.js?v=veta10-20questions',
  './question-bank-veta11.js?v=100level1',
  './difficulty-veta11.js?v=veta14-level-lock',
  './handwriting-lazy-veta12.js?v=1',
  './pronunciation-training.js?v=veta16-record-status',
  './sounds/tap.mp3'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Warm the same offline assets, but in small batches. Parallel requests
    // for every question image at once can overwhelm slower devices.
    for (let i = 0; i < APP_SHELL.length; i += 6) {
      await Promise.all(APP_SHELL.slice(i, i + 6).map(async path => {
        try {
          const request = new Request(new URL(path, self.registration.scope).href, { cache: 'reload' });
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
        } catch (_) { /* Requested files cache as they are used. */ }
      }));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('kotoba-quest-') && k !== CACHE_NAME).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type !== 'opaque') {
          try { await cache.put(request, response.clone()); } catch (_) {}
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await cache.match(new URL('index.html', self.registration.scope).href, { ignoreSearch: true });
          if (shell) return shell;
        }
        throw error;
      }
    })());
  }
});
