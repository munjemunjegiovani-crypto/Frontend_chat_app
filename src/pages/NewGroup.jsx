import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, uploadFile } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Avatar, Icon, PaneHeader, SearchField, Spinner } from '../components/ui.jsx';
import { useUserSearch } from './NewChat.jsx';

export default function NewGroup() {
  const navigate = useNavigate();
  const { upsertConversation, toast } = useApp();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const { results, loading } = useUserSearch(q);

  const toggle = (u) => setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  const create = async () => {
    setBusy(true);
    try {
      let avatarId = null;
      if (avatar) avatarId = (await uploadFile(avatar.file)).id;
      const conv = await api('/conversations/group', {
        method: 'POST',
        body: { name, description, avatarId, memberIds: picked.map((p) => p.id) },
      });
      upsertConversation(conv);
      toast(`“${conv.name}” created`, { icon: 'groups' });
      navigate(`/chat/${conv.id}`, { replace: true });
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PaneHeader
        title={step === 1 ? 'Select members' : 'Group details'}
        eyebrow={`New group · Step ${step} of 2`}
        back={step === 1 ? '/' : undefined}
        actions={
          step === 1 ? (
            <button className="btn-primary !h-10" disabled={!picked.length} onClick={() => setStep(2)}>
              Next <span className="min-w-[20px] h-5 px-1 rounded-full bg-gold text-[#0E1420] text-[11px] flex items-center justify-center">{picked.length}</span>
            </button>
          ) : (
            <button className="btn-outline !h-10" onClick={() => setStep(1)}><Icon name="arrow_back" size={18} /> Members</button>
          )
        }
      />
      {step === 1 ? (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <SearchField value={q} onChange={setQ} placeholder="Search people by name or @username" autoFocus />
            {picked.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-4 mb-2 px-1">
                  <span className="eyebrow flex items-center gap-1.5"><Icon name="verified_user" size={15} /> {picked.length} chosen</span>
                  <button className="text-label-md text-gold-ink" onClick={() => setPicked([])}>Clear</button>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {picked.map((u) => (
                    <span key={u.id} className="flex items-center gap-2 h-10 pl-1 pr-2 rounded-full bg-card border hairline shrink-0">
                      <Avatar id={u.avatarId} name={u.name} size={30} />
                      <span className="text-sm">{u.name.split(' ')[0]}</span>
                      <button onClick={() => toggle(u)} className="text-muted hover:text-ink" aria-label={`Remove ${u.name}`}><Icon name="close" size={16} /></button>
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="flex items-center justify-between mt-5 mb-2 px-1">
              <span className="eyebrow">{q ? 'Search results' : 'Your contacts'}</span>
              {loading && <Spinner size={16} />}
            </div>
            <div className="flex flex-col gap-2">
              {results.map((u) => {
                const on = picked.some((p) => p.id === u.id);
                return (
                  <button key={u.id} onClick={() => toggle(u)} className={`card flex items-center gap-4 px-4 py-3 text-left transition ${on ? '!border-gold/60' : ''}`}>
                    <Avatar id={u.avatarId} name={u.name} size={46} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-serif text-lg text-ink truncate">{u.name}</span>
                      <span className="block text-xs text-muted truncate">@{u.username}</span>
                    </span>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center transition ${on ? 'bg-gold-ink text-white dark:bg-gold dark:text-[#0E1420]' : 'bg-soft'}`}>
                      {on && <Icon name="check" size={18} />}
                    </span>
                  </button>
                );
              })}
              {!loading && !results.length && (
                <p className="text-sm text-muted text-center py-8">{q ? 'No one found.' : 'Search for people to add. Your existing contacts appear here.'}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          <div className="max-w-xl mx-auto px-4 py-6">
            <div className="card p-6">
              <div className="flex flex-col items-center">
                <button onClick={() => fileRef.current.click()} className="relative group" aria-label="Group photo">
                  {avatar ? (
                    <img src={avatar.url} alt="" className="w-28 h-28 rounded-full object-cover ring-2 ring-gold" />
                  ) : (
                    <span className="w-28 h-28 rounded-full bg-[#14213D] text-[#C9A86A] flex items-center justify-center ring-2 ring-gold/50">
                      <Icon name="add_a_photo" size={36} />
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-gold text-[#0E1420] flex items-center justify-center shadow"><Icon name="edit" size={16} /></span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) setAvatar({ file: f, url: URL.createObjectURL(f) }); }} />
                <span className="eyebrow mt-3">Group seal</span>
              </div>
              <label className="block mt-6">
                <span className="block text-label-md text-ink/80 mb-1.5">Group name</span>
                <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. YIBS Software Engineers" autoFocus />
              </label>
              <label className="block mt-4">
                <span className="block text-label-md text-ink/80 mb-1.5">Description <span className="text-muted">(optional)</span></span>
                <textarea className="field !h-24 py-3 resize-none" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about?" />
              </label>
            </div>
            <div className="mt-5">
              <span className="eyebrow px-1">{picked.length} member{picked.length === 1 ? '' : 's'} + you</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {picked.map((u) => (
                  <span key={u.id} className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-card border hairline">
                    <Avatar id={u.avatarId} name={u.name} size={28} /><span className="text-sm">{u.name}</span>
                  </span>
                ))}
              </div>
            </div>
            <button className="btn-primary w-full h-[52px] mt-8" disabled={!name.trim() || busy} onClick={create}>
              {busy ? <Spinner size={18} /> : <>Create group <Icon name="arrow_forward" size={20} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
