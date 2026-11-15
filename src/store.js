// One small store for everything the screens show. The engines (js/) stay plain modules; the controllers
// (src/controllers/) call them and write what changed here; React components read it with useStore().

import { useSyncExternalStore } from 'react';
import { S, save } from '../js/settings.js';

let state = {
  s: {},                 // a copy of the settings (js/settings.js S), replaced on every change so React notices
  controls: true,        // the sheet and dock over the stage (tap the stage to hide or show them)
  hint: false,           // "tap anywhere for controls", briefly, after hiding them
  tab: 'holo',           // holo | inbox | call | settings
  holoPage: null,        // the Hologram tab's open page: null (the gallery) | message | video | gif
  gif: { item: null, ready: false, loading: false, status: '' },       // the chosen GIPHY GIF
  sticker: { item: null, ready: false, loading: false, status: '' },   // the chosen GIPHY sticker
  video: { ready: false, file: false, status: '' },
  playing: false,        // the video element is playing

  configured: true,      // js/config.js filled in
  inbox: null,           // inbox state from js/inbox.js: { user, me, partner, members, messages, unseen, error, notMember }
  inboxStatus: '',
  sending: false,

  push: null,            // this device's notifications: on | off | blocked | unsupported | signin | none
  pushStatus: '',
  pushDialog: false,     // asked once per device after the first sign-in

  call: null,            // the call engine's view: { phase, reason, startedAt, muted, inStand, remoteInStand, localStream, remoteReady }
  callWith: null,        // the member a call goes to (the partner, or yourself when testing)
  callMotion: false,     // show "allow motion" (iPhone refused the automatic request)
  callError: '',

  surprise: null,        // { from, how } while a surprise waits for the stand
  setup: null,           // the first-time setup's current step, or null when closed
  setupPeek: false,      // the stand step's card hidden, to look at the stage
};

const subs = new Set();

export const getState = () => state;

export function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}

export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

/** Read part of the state; the component re-renders when that part changes. Return a slice or a primitive. */
export const useStore = (pick) => useSyncExternalStore(subscribe, () => pick(state));

/** Change settings: the engines read S directly, the screens read the copy. */
export function setSettings(patch) {
  Object.assign(S, patch);
  save();
  set({ s: { ...S } });
}

export const refreshSettings = () => set({ s: { ...S } });
