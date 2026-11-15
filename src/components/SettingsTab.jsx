// Settings tab: notifications, Surprise mode, call testing, the setup, the account.

import { useEffect } from 'react';
import { Bell, Gift, PhoneCall, Wand2, LogOut, Send } from 'lucide-react';
import { useStore } from '../store.js';
import {
  refreshPush, turnOnPush, turnOffPush, testPush, toggleSurprise, toggleSurpriseOwn, toggleCallSelf, signOut,
} from '../controllers/account.js';
import { openSetup } from '../controllers/setup.js';
import { Section, Switch, Row, Note, TabBody } from './ui.jsx';

const PUSH_TEXT = {
  on: 'On for this device',
  off: 'Off for this device',
  blocked: 'Blocked. Allow notifications for Holo in the phone settings, then come back here.',
  unsupported: 'Not available here. On iPhone: Safari → Share → Add to Home Screen, then open Holo from its icon.',
  signin: 'Sign in under Inbox first',
  none: 'Sending is not set up yet',
};

export function SettingsTab() {
  const s = useStore((x) => x.s);
  const push = useStore((x) => x.push);
  const pushStatus = useStore((x) => x.pushStatus);
  const st = useStore((x) => x.inbox);

  useEffect(() => { refreshPush(); }, []);

  return (
    <TabBody>
      <Section title="Notifications">
        <div className="inset">
          <Row icon={<Bell />} title="New holos and calls" note={PUSH_TEXT[push] || '…'}>
            {(push === 'on' || push === 'off') && (
              <Switch label="Notifications" checked={push === 'on'} onCheckedChange={(on) => (on ? turnOnPush() : turnOffPush())} />
            )}
          </Row>
          {push === 'on' && <Row icon={<Send />} title="Send a test notification" onClick={testPush} />}
        </div>
        <Note>{pushStatus}</Note>
      </Section>

      <Section title="Surprise mode">
        <div className="inset">
          <Row icon={<Gift />} title="Surprise mode" note="Messages you receive open only once the phone is face down in the stand">
            <Switch label="Surprise mode" checked={!!s.surprise} onCheckedChange={toggleSurprise} />
          </Row>
          {s.surprise && (
            <Row title="Also for messages I sent" note="Handy for testing alone">
              <Switch label="Also for messages I sent" checked={!!s.surpriseOwn} onCheckedChange={toggleSurpriseOwn} />
            </Row>
          )}
        </div>
      </Section>

      <Section title="Calls">
        <div className="inset">
          <Row icon={<PhoneCall />} title="Test calls between my own devices" note="The Call button rings your other devices signed in as you, instead of your partner">
            <Switch label="Test calls between my own devices" checked={!!s.callSelf} onCheckedChange={toggleCallSelf} />
          </Row>
        </div>
      </Section>

      <Section title="This phone">
        <div className="inset">
          <Row icon={<Wand2 />} title="Run the setup again" onClick={openSetup} />
          {st && st.user && (
            <Row icon={<LogOut />} title="Sign out" note={st.me ? st.me.name + ' · ' + st.user.email : st.user.email} onClick={signOut} />
          )}
        </div>
      </Section>

      <p className="px-1 pb-1 text-caption leading-relaxed text-muted-foreground/70">
        Design after Valet (MIT). Geist by Vercel (OFL). Graphite tones from unslop by Damir Sokolovsky (CC BY 4.0). Icons by Lucide.
      </p>
    </TabBody>
  );
}
