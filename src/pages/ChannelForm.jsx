import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fileUrl, uploadFile } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Confirm, Icon, PaneHeader, Spinner } from '../components/ui.jsx';
import { refreshChannels } from './ChannelList.jsx';

export default function ChannelForm({ edit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!edit) return;
    api(`/channels/${id}`).then((c) => {
      if (!c.isOwner) navigate(`/channels/${id}`, { replace: true });
      setName(c.name);
      setDescription(c.description);
      if (c.avatarId) setAvatar({ id: c.avatarId, url: fileUrl(c.avatarId) });
    }).catch(() => navigate('/channels'));
  }, [edit, id, navigate]);

  const save = async () => {
    setBusy(true);
    try {
      let avatarId = avatar?.id || null;
      if (avatar?.file) avatarId = (await uploadFile(avatar.file)).id;
      const c = edit
        ? await api(`/channels/${id}`, { method: 'PATCH', body: { name, description, avatarId } })
        : await api('/channels', { method: 'POST', body: { name, description, avatarId } });
      refreshChannels();
      toast(edit ? 'Channel updated' : `“${c.name}” is live`, { icon: 'hub' });
      navigate(`/channels/${c.id}`, { replace: true });
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
      <PaneHeader title={edit ? 'Edit channel' : 'New channel'} eyebrow="Channels" back />
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="card p-6">
          <div className="flex flex-col items-center">
            <button onClick={() => fileRef.current.click()} className="relative" aria-label="Channel photo">
              {avatar ? (
                <img src={avatar.url} alt="" className="w-28 h-28 rounded-full object-cover ring-2 ring-gold" />
              ) : (
                <span className="w-28 h-28 rounded-full bg-[#14213D] text-[#C9A86A] flex items-center justify-center ring-2 ring-gold/50"><Icon name="add_a_photo" size={36} /></span>
              )}
              <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-gold text-[#0E1420] flex items-center justify-center shadow"><Icon name="edit" size={16} /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) setAvatar({ file: f, url: URL.createObjectURL(f) }); }} />
          </div>
          <label className="block mt-6">
            <span className="block text-label-md text-ink/80 mb-1.5">Channel name</span>
            <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fritz Gio Dev Diaries" autoFocus={!edit} />
          </label>
          <label className="block mt-4">
            <span className="block text-label-md text-ink/80 mb-1.5">Description</span>
            <textarea className="field !h-28 py-3 resize-none" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Tell people what you will post about" />
          </label>
          <div className="mt-5 p-4 rounded-xl bg-soft/70 text-sm text-muted flex gap-3">
            <Icon name="info" className="text-gold-ink" />
            <span>Anyone on Gochat can find and follow your channel. Only you can post; followers can react and comment, and you’ll see comments in your Activity inbox.</span>
          </div>
          <button className="btn-primary w-full h-[52px] mt-6" disabled={!name.trim() || busy} onClick={save}>
            {busy ? <Spinner size={18} /> : edit ? 'Save changes' : <>Create channel <Icon name="arrow_forward" size={20} /></>}
          </button>
        </div>
        {edit && (
          <button className="w-full mt-4 h-12 rounded-xl bg-danger-soft text-danger font-medium" onClick={() => setConfirm(true)}>Delete channel</button>
        )}
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete this channel?" text="All posts and comments will be permanently removed." confirmLabel="Delete" danger
        onConfirm={async () => { await api(`/channels/${id}`, { method: 'DELETE' }); refreshChannels(); navigate('/channels', { replace: true }); }} />
    </div>
  );
}
