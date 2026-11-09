// Things that can be shown: the video element (and loading a file into it), the test pattern, the message card.

export const video = document.createElement('video');
video.setAttribute('playsinline', '');
video.playsInline = true; video.loop = true; video.muted = true; video.preload = 'auto';

export const videoState = { ready: false };

// Load a picked/recorded file into the video element. onStatus(text) reports progress to the UI.
export function loadVideoFile(file, { muted, onStatus }) {
  try { if (video.src) URL.revokeObjectURL(video.src); } catch (_) { /* ignore */ }
  videoState.ready = false;
  onStatus('Loading ' + file.name + '…');
  video.src = URL.createObjectURL(file);
  video.muted = muted;
  video.onloadeddata = () => {
    videoState.ready = true;
    onStatus(file.name + ' · ' + video.videoWidth + '×' + video.videoHeight + ' · ' + Math.round(video.duration || 0) + 's');
  };
  video.onerror = () => onStatus('Could not play that file. Try a .mov or .mp4 from the camera.');
  video.play().catch(() => onStatus('Tap “Play / pause” to start.'));
}

// Test pattern: asymmetric so rotation and mirroring are obvious.
export const testPattern = (() => {
  const cv = document.createElement('canvas'); cv.width = 420; cv.height = 520;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 420, 520);
  c.strokeStyle = '#5ef0ff'; c.fillStyle = '#5ef0ff'; c.lineWidth = 10; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(210, 190); c.lineTo(210, 40); c.moveTo(150, 100); c.lineTo(210, 40); c.lineTo(270, 100); c.stroke();
  c.font = '700 46px -apple-system,Helvetica,Arial,sans-serif'; c.textAlign = 'center'; c.fillText('TOP', 210, 250);
  c.font = '800 96px -apple-system,Helvetica,Arial,sans-serif'; c.fillStyle = '#ff6ad5'; c.fillText('HOLO', 210, 380);
  c.fillStyle = '#ffe066'; c.beginPath(); c.arc(70, 470, 26, 0, Math.PI * 2); c.fill();
  c.font = '600 24px -apple-system,Helvetica,Arial,sans-serif'; c.textAlign = 'left'; c.fillText('← left', 110, 478);
  return { c: cv, w: 420, h: 520 };
})();

// Message card: pulsing heart plus up to three lines of text.
const msgC = document.createElement('canvas'); msgC.width = 600; msgC.height = 560;

function heart(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * 0.3);
  c.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  c.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  c.closePath();
}

export function renderMessage(t, text) {
  const c = msgC.getContext('2d'), pulse = 1 + 0.06 * Math.sin(t / 260);
  c.fillStyle = '#000'; c.fillRect(0, 0, 600, 560);
  c.save(); c.translate(300, 150); c.scale(pulse, pulse);
  c.shadowColor = '#ff3d8b'; c.shadowBlur = 40; c.fillStyle = '#ff5fa2'; heart(c, 0, -90, 180); c.fill(); c.restore();
  const words = (text || '').split(/\s+/); let lines = [], line = '';
  c.font = '700 58px -apple-system,Helvetica,Arial,sans-serif';
  words.forEach((w) => {
    const tst = line ? line + ' ' + w : w;
    if (c.measureText(tst).width > 540 && line) { lines.push(line); line = w; } else line = tst;
  });
  if (line) lines.push(line);
  lines = lines.slice(0, 3);
  c.textAlign = 'center'; c.shadowColor = '#5ef0ff'; c.shadowBlur = 24; c.fillStyle = '#d9fbff';
  lines.forEach((l, i) => c.fillText(l, 300, 340 + i * 70));
  c.shadowBlur = 0;
  return { c: msgC, w: 600, h: 560 };
}
