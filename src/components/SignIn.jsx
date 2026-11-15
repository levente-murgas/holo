// Sign in with an emailed code (the Inbox tab and the setup share this).

import { useState } from 'react';
import { Mail, KeyRound } from 'lucide-react';
import { useStore } from '../store.js';
import { sendCode, verifyCode } from '../controllers/inbox.js';
import { Button, Input, Note } from './ui.jsx';

export function SignIn() {
  const st = useStore((s) => s.inbox);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function onSend() {
    const e = email.trim(); if (!e) return;
    setBusy(true); setStatus('Sending…');
    try { setStatus(await sendCode(e)); setSent(true); }
    catch (err) { setStatus('Could not send: ' + (err.message || err)); }
    setBusy(false);
  }

  async function onVerify() {
    const e = email.trim(), c = code.replace(/\s/g, ''); if (!e || !c) return;
    setBusy(true);
    try { await verifyCode(e, c); setStatus('Signed in'); setCode(''); setSent(false); }
    catch (err) { setStatus(err.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-2.5">
      <Input type="email" autoComplete="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {!sent ? (
        <Button block variant="primary" disabled={busy || !email.trim()} onClick={onSend}><Mail /> Email me a code</Button>
      ) : (
        <>
          <Input
            inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="Code from the email"
            value={code} onChange={(e) => setCode(e.target.value)}
          />
          <Button block variant="primary" disabled={busy || !code.trim()} onClick={onVerify}><KeyRound /> Sign in</Button>
          <Button block variant="ghost" size="sm" disabled={busy} onClick={onSend}>Send a new code</Button>
        </>
      )}
      <Note>{st && st.notMember ? 'Signed in as ' + st.user.email + ', but this email is not on Holo\'s members list.' : status}</Note>
    </div>
  );
}
