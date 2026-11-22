// background music, synthesised live (no audio files): a calm loop for the house, a tense one for games
import { Snd } from './games.js';
const KEY = 'home3d_music';
const load = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
// chord progressions (MIDI notes)
const CALM = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];        // Cmaj7 Am7 Fmaj7 G7
const TENSE = [[57, 60, 64], [57, 60, 63], [53, 56, 60], [52, 55, 59, 58]];                   // Am, Adim-ish, Fm, E with a sour note
export const Music = {
  on: load(), mood: 'calm', gain: null, timer: null, next: 0, step: 0,
  start() {
    Snd.init(); const c = Snd.ctx; if (!c) return;
    if (!this.gain) { this.gain = c.createGain(); this.gain.gain.value = 0; this.gain.connect(Snd.master); }
    if (!this.timer) { this.next = c.currentTime + .1; this.timer = setInterval(() => this.tick(), 100); }
    this.gain.gain.cancelScheduledValues(c.currentTime); this.gain.gain.linearRampToValueAtTime(this.on ? (this.mood === 'tense' ? .55 : .4) : 0, c.currentTime + 1.2);
  },
  setMood(m) { if (m === this.mood) return; this.mood = m; this.step = 0; if (this.gain) this.start(); },
  toggle() {
    this.on = !this.on; try { localStorage.setItem(KEY, this.on ? '1' : '0'); } catch (e) { }
    this.start(); return this.on;
  },
  note(f, t, dur, type = 'sine', vol = .1, attack = .02) {
    const c = Snd.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + dur + .05);
  },
  tick() {
    const c = Snd.ctx; if (!c || !this.on) { if (c) this.next = c.currentTime + .1; return; }
    const tense = this.mood === 'tense', beat = tense ? 60 / 64 : 60 / 84;   // seconds per beat
    while (this.next < c.currentTime + .4) {
      const t = this.next, s = this.step, bar = Math.floor(s / 8) % 4, ch = (tense ? TENSE : CALM)[bar], eighth = s % 8;
      if (!tense) {
        if (eighth === 0) { ch.forEach(n => this.note(mtof(n - 12), t, beat * 4.2, 'triangle', .035, .4)); this.note(mtof(ch[0] - 24), t, beat * 3.8, 'sine', .09, .05); }
        const arp = [0, 1, 2, 3, 2, 1, 2, 3][eighth]; if (eighth !== 7 || Math.random() < .5) this.note(mtof(ch[arp % ch.length] + 12), t, beat * .9, 'sine', .045);
      } else {
        if (eighth === 0) { ch.forEach(n => this.note(mtof(n - 12), t, beat * 4.5, 'sawtooth', .012, 1.2)); this.note(mtof(ch[0] - 24), t, beat * 4, 'sine', .12, .3); }
        if (eighth % 2 === 0) this.note(mtof(ch[0] - 24), t, beat * .35, 'sine', eighth === 0 ? .16 : .08, .01);   // heartbeat pulse
        if (Math.random() < .07) this.note(mtof(ch[Math.floor(Math.random() * ch.length)] + 24 + (Math.random() < .5 ? 1 : 0)), t, beat * 3, 'sine', .025, .8); // eerie high note
      }
      this.step++; this.next += beat / 2;
    }
  },
};
