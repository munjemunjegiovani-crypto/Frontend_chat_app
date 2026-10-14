import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, EmptyState, Icon, Spinner } from '../components/ui.jsx';

export default function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { upsertConversation, toast } = useApp();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/conversations/join/${code}`).then(setInfo).catch((e) => setError(e.message)); }, [code]);
  if (error) return <EmptyState icon="link_off" title="Invite unavailable" text={error} action={<button className="btn-outline" onClick={() => navigate('/')}>Go to chats</button>} />;
  if (!info) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
  const join = async () => {
    setBusy(true);
    try {
      const c = await api(`/conversations/join/${code}`, { method: 'POST' });
      upsertConversation(c);
      navigate(`/chat/${c.id}`, { replace: true });
    } catch (e) {
      toast(e.message, { error: true });
      setBusy(false);
    }
  };
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="card p-8 max-w-sm w-full text-center">
        <span className="eyebrow">Group invitation</span>
        <div className="flex justify-center my-5"><Avatar id={info.avatarId} name={info.name} size={96} group ring /></div>
        <h2 className="font-serif text-3xl text-ink">{info.name}</h2>
        <p className="text-sm text-muted mt-1">{info.memberCount} members</p>
        {info.description && <p className="font-serif italic text-gold-ink mt-4">“{info.description}”</p>}
        {info.isMember ? (
          <button className="btn-primary w-full mt-7" onClick={() => navigate(`/chat/${info.id}`)}>Open group <Icon name="arrow_forward" size={18} /></button>
        ) : (
          <button className="btn-primary w-full mt-7" onClick={join} disabled={busy}>{busy ? <Spinner size={16} /> : <>Join group <Icon name="group_add" size={18} /></>}</button>
        )}
      </div>
    </div>
  );
}
