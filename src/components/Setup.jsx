// First-time setup: one card per step, sliding along. The stand step drops the card to the bottom so the
// test pattern shows behind it (and can hide it altogether, to look at the reflection).

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Download, Mail, Bell, ScanLine, Gift, RotateCw, FlipHorizontal2, EyeOff } from 'lucide-react';
import { STEPS } from '../../js/setup-logic.js';
import { canPromptInstall, promptInstall } from '../../js/pwa.js';
import { useStore } from '../store.js';
import { nextSetup, finishSetup, peekSetup, setupPushOn, setupPushLater, setupSurpriseNext, platform } from '../controllers/setup.js';
import { rotate, toggle } from '../controllers/stage.js';
import { toggleSurprise } from '../controllers/account.js';
import { Button, Chip, Note, Row, Switch, cn } from './ui.jsx';
import { SignIn } from './SignIn.jsx';

const INSTALL_HOW = {
  ios: 'In Safari, tap the Share button (the square with the arrow), scroll down and tap “Add to Home Screen”, then “Add”.',
  android: 'In Chrome, open the menu (⋮) and tap “Install app” or “Add to Home screen”.',
  desktop: '',
};

// The same switch as in Settings.
function SurpriseSwitch() {
  const on = useStore((x) => !!x.s.surprise);
  return (
    <div className="inset mt-5">
      <Row icon={<Gift />} title="Surprise mode" note="Holos open only once the phone is face down in the stand">
        <Switch label="Surprise mode" checked={on} onCheckedChange={toggleSurprise} />
      </Row>
    </div>
  );
}

function Badge({ children, heart }) {
  return (
    <div className={cn(
      'mb-5 grid size-14 place-items-center rounded-2xl [&_svg]:size-7',
      heart ? 'text-heart' : 'glass-round text-primary',
    )}>
      {children}
    </div>
  );
}

function Title({ children }) { return <h2 className="text-metric-m leading-tight font-medium tracking-[-0.02em]">{children}</h2>; }
function Text({ children }) { return <p className="mt-2.5 text-item leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">{children}</p>; }
const Actions = ({ children }) => <div className="mt-6 space-y-2">{children}</div>;

function Step({ id }) {
  const [pushNote, setPushNote] = useState('');

  switch (id) {
    case 'welcome': return (
      <>
        <Badge heart><Heart className="fill-current" /></Badge>
        <Title>Welcome to Holo</Title>
        <Text>Your phone becomes a little hologram. You send each other short clips and messages, and they appear floating in the stand. Setting it up takes about three minutes.</Text>
        <Actions><Button block size="lg" variant="primary" onClick={nextSetup}>Let's start</Button></Actions>
      </>
    );
    case 'install': return (
      <>
        <Badge><Download /></Badge>
        <Title>Put Holo on your home screen</Title>
        <Text>{INSTALL_HOW[platform]} Holo then opens full screen, keeps the screen on, and can send you notifications.</Text>
        <Text>{platform === 'ios' ? 'Then open Holo from its new icon: the setup continues there.' : 'Then open Holo from its new icon.'}</Text>
        <Actions>
          {canPromptInstall() && (
            <Button block size="lg" variant="primary" onClick={async () => { if (await promptInstall()) nextSetup(); }}>Install Holo</Button>
          )}
          <Button block variant="tonal" onClick={nextSetup}>Continue here instead</Button>
        </Actions>
      </>
    );
    case 'signin': return (
      <>
        <Badge><Mail /></Badge>
        <Title>Sign in</Title>
        <Text>Use the email address Holo was set up with. You'll get a code by email; you only do this once on this phone.</Text>
        <div className="mt-5"><SignIn /></div>
        <Actions><Button block variant="ghost" size="sm" onClick={nextSetup}>Later</Button></Actions>
      </>
    );
    case 'notify': return (
      <>
        <Badge><Bell /></Badge>
        <Title>Get a buzz when something arrives</Title>
        <Text>Holo can tell you when a new holo, message or call comes in, even while it's closed</Text>
        <Actions>
          <Button block size="lg" variant="primary" onClick={async () => setPushNote(await setupPushOn())}>Turn on notifications</Button>
          <Note>{pushNote}</Note>
          <Button block variant="ghost" size="sm" onClick={setupPushLater}>Not now</Button>
        </Actions>
      </>
    );
    case 'stand': return <Stand />;
    case 'surprise': return (
      <>
        <Badge><Gift /></Badge>
        <Title>Surprise mode</Title>
        <Text>A holo you receive stays hidden until the phone is lying face down in the stand, so you see it as a hologram first. It's on by default; you can change it here or any time in Settings.</Text>
        <SurpriseSwitch />
        <Actions>
          <Button block size="lg" variant="primary" onClick={setupSurpriseNext}>Continue</Button>
        </Actions>
      </>
    );
    default: return (
      <>
        <Badge heart><Heart className="fill-current" /></Badge>
        <Title>All set</Title>
        <Text>Tap anywhere on the hologram to show or hide the controls. New holos arrive in the <b>Inbox</b>; notifications, Surprise mode and this setup are in <b>Settings</b>.</Text>
        <Actions><Button block size="lg" variant="primary" onClick={finishSetup}>Start Holo</Button></Actions>
      </>
    );
  }
}

function Stand() {
  const s = useStore((x) => x.s);
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="glass-round grid size-10 place-items-center rounded-xl text-primary [&_svg]:size-5"><ScanLine /></span>
        <h2 className="text-metric-s font-medium">Line up the stand</h2>
      </div>
      <Text>Brightness all the way up, phone face down in the stand. In the reflection, <b>miss you already</b> should read normally and the right way up. If not, take the phone out and tap Rotate or Mirror.</Text>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip onClick={rotate}><RotateCw /> Rotate {s.rot}°</Chip>
        <Chip on={s.mirror} onClick={() => toggle('mirror')}><FlipHorizontal2 /> Mirror</Chip>
        <Chip onClick={(e) => { e.stopPropagation(); peekSetup(true); }}><EyeOff /> Hide this card</Chip>
      </div>
      <Actions><Button block size="lg" variant="primary" onClick={nextSetup}>It looks right</Button></Actions>
    </>
  );
}

export function Setup() {
  const step = useStore((x) => x.setup);
  const peek = useStore((x) => x.setupPeek);
  if (!step) return null;
  const stand = step === 'stand';
  const at = STEPS.indexOf(step);

  return (
    <div
      className={cn(
        'fixed inset-0 z-10 flex justify-center px-4 pt-safe pb-safe',
        stand ? 'items-end' : 'scroll items-center bg-black',
      )}
      onClick={(e) => { if (peek && e.target === e.currentTarget) peekSetup(false); }}
    >
      <AnimatePresence mode="wait">
        {!peek && (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={cn('relative w-full max-w-[420px]', stand && 'glass-float rounded-surface p-5')}
          >
            <div className="mb-8 flex items-center justify-between" hidden={stand}>
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <span key={s} className={cn('h-1 rounded-full transition-all duration-300', i <= at ? 'w-5 bg-primary' : 'w-2.5 bg-fill-2')} />
                ))}
              </div>
              {step !== 'done' && <Button variant="ghost" size="sm" onClick={finishSetup}>Skip setup</Button>}
            </div>
            <Step id={step} />
          </motion.div>
        )}
      </AnimatePresence>
      {peek && (
        <button type="button" onClick={() => peekSetup(false)} className="glass-round fixed bottom-[max(24px,env(safe-area-inset-bottom))] rounded-full px-4 py-2 text-meta text-muted-foreground">
          Tap to bring the card back
        </button>
      )}
    </div>
  );
}
