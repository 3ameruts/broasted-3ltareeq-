import TM from './timing.json';
// بروستد عالطريق: red, mustard, cream, warm darks
export const C = {
  red: '#e0263a', redDeep: '#b21017', redDark: '#7d0a10', mustard: '#fcb712', cream: '#fbf5ea',
  ink: '#2a2528', night: '#1a1517', ok: '#2fbf6f', brown: '#5a2a0c',
};
export const F = { fun: '"Lalezar", "Tajawal", sans-serif', head: '"Tajawal", sans-serif', body: '"IBM Plex Sans Arabic", sans-serif', num: '"Cairo", sans-serif' };
// the edit is locked to the music: beat n (0 = the drop)
export const FPS = TM.fps, BEAT = TM.beat, DROP = TM.drop;
export const b = (n: number) => DROP + n * BEAT;
export const fr = (sec: number) => Math.round(sec * FPS);
