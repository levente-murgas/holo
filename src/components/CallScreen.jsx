// Live call: shown while a call rings or runs. Fades out (stays rendered, so the video keeps playing)
// while the phone is in the stand, where the stage shows the other person as a hologram.

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Move3d } from 'lucide-react';
import { formatDuration } from '../../js/call-logic.js';
import { useStore } from '../store.js';
import { remoteVideo, answer, hangup, toggleMute, askMotion } from '../controllers/call.js';
import { Chip, cn } from './ui.jsx';

function useTick(on) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
}

function statusText(v, name) {
  switch (v.phase) {
    case 'outgoing': return 'Calling…';
    case 'incoming': return 'Holo call';
    case 'connecting': return 'Connecting…';
    case 'active': return formatDuration(Date.now() - v.startedAt);
    case 'ended': return v.reason;
    default: return '';
  }
}

function hintText(v, name) {
  if (v.phase !== 'active' && v.phase !== 'connecting') return '';
  if (v.remoteInStand) return name + ' is watching you in the stand. Hold the phone so they can see you.';
  return 'Lay the phone face down in the stand to see ' + name + ' as a hologram.';
}

function Round({ label, className, children, ...props }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" aria-label={label} className={cn('press grid size-16 place-items-center rounded-full [&_svg]:size-7', className)} {...props}>
        {children}
      </button>
      <span className="text-meta text-muted-foreground">{label}</span>
    </div>
  );
}

export function CallScreen() {
  const v = useStore((s) => s.call);
  const who = useStore((s) => s.callWith);
  const motionAsk = useStore((s) => s.callMotion);
  const error = useStore((s) => s.callError);
  const box = useRef(null), self = useRef(null);

  const phase = v ? v.phase : 'idle';
  const inCall = phase === 'connecting' || phase === 'active';
  const show = phase !== 'idle' || !!error;
  const name = who ? who.name : '';
  useTick(phase === 'active');

  useEffect(() => { if (box.current && !box.current.contains(remoteVideo)) box.current.prepend(remoteVideo); }, []);
  useEffect(() => {
    const el = self.current, stream = (v && v.localStream) || null;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  });

  const remoteShown = !!(v && v.remoteReady && !v.remoteInStand);

  return (
    <section
      hidden={!show}
      className={cn(
        'fixed inset-0 z-30 flex flex-col justify-end bg-black px-5 pt-safe pb-safe transition-opacity duration-500',
        inCall && v.inStand && 'pointer-events-none opacity-0',
      )}
    >
      <div
        ref={box}
        className={cn('absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_video]:transition-opacity [&_video]:duration-500', !remoteShown && '[&_video]:opacity-0')}
      />
      <video
        ref={self} muted playsInline autoPlay
        hidden={!(v && v.localStream) || (v && v.inStand)}
        className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 h-36 w-28 -scale-x-100 rounded-2xl bg-neutral-900 object-cover shadow-[0_0_0_.5px_rgb(255_255_255/.25),0_12px_30px_-10px_rgb(0_0_0/.8)]"
      />

      {/* who and how long: under the avatar while there's no picture, at the top over the video once there is */}
      <div className={cn(
        'absolute inset-x-0 flex flex-col items-center px-6 text-center [text-shadow:0_1px_8px_rgb(0_0_0/.8)]',
        remoteShown ? 'top-[max(20px,env(safe-area-inset-top))]' : 'top-[18vh]',
      )}>
        {!remoteShown && (
          <div className={cn(
            'mb-6 grid size-28 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#f3dca8,#b98d3e_55%,#5a4319)] text-5xl font-medium text-primary-foreground [text-shadow:none]',
            'shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_0_0_1px_rgb(255_255_255/.12)]',
            (phase === 'incoming' || phase === 'outgoing') && 'beam',
          )}>
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h2 className="text-metric-m font-medium tracking-[-0.02em]">{name}</h2>
        <p className="tabular mt-1 max-w-[320px] text-item text-muted-foreground">{error || (v && statusText(v, name))}</p>
      </div>

      <div className="relative mb-8 text-center [text-shadow:0_1px_8px_rgb(0_0_0/.8)]">
        {v && hintText(v, name) && <p className="mx-auto max-w-[320px] text-body text-muted-foreground">{hintText(v, name)}</p>}
        {motionAsk && (
          <Chip className="mt-4" onClick={askMotion}><Move3d /> Allow motion, so Holo notices the stand</Chip>
        )}
      </div>

      {v && (
        <div className="relative mx-auto mb-4 flex w-full max-w-[360px] justify-around">
          {inCall && (
            <Round label={v.muted ? 'Unmute' : 'Mute'} onClick={toggleMute} className={v.muted ? 'bg-white text-black' : 'glass-round text-foreground'}>
              {v.muted ? <MicOff /> : <Mic />}
            </Round>
          )}
          {phase !== 'ended' && (
            <Round label={phase === 'incoming' ? 'Decline' : 'End'} onClick={hangup} className="bg-bad text-white">
              <PhoneOff />
            </Round>
          )}
          {phase === 'incoming' && (
            <Round label="Answer" onClick={answer} className="bg-good text-white">
              <Phone />
            </Round>
          )}
        </div>
      )}
    </section>
  );
}
