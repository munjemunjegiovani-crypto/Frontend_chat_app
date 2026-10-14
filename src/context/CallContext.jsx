import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from './AppContext.jsx';
import { api, fileUrl } from '../lib/api.js';
import { startRing, stopRing } from '../lib/sound.js';
import { showLocalNotification } from '../lib/push.js';
import { duration } from '../lib/format.js';
import { Avatar, Icon } from '../components/ui.jsx';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const DEFAULT_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export function CallProvider({ children }) {
  const { socket, toast, me } = useApp();
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const callRef = useRef(null);
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const queued = useRef([]);
  const iceServers = useRef(DEFAULT_ICE);
  callRef.current = call;

  useEffect(() => {
    if (!me) return;
    api('/config').then((c) => { if (c.iceServers?.length) iceServers.current = c.iceServers; }).catch(() => {});
  }, [me]);

  const update = (patch) => setCall((c) => (c ? { ...c, ...patch } : c));

  const cleanup = useCallback((reason) => {
    stopRing();
    pcRef.current?.getSenders?.().forEach((s) => s.track && s.track.stop());
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    queued.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    if (reason) {
      setCall((c) => (c ? { ...c, status: 'ended', endedReason: reason } : c));
      setTimeout(() => setCall((c) => (c?.status === 'ended' ? null : c)), 1800);
    } else {
      setCall(null);
    }
  }, []);

  const getMedia = async (type) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Calls need a secure (https) connection and a modern browser.');
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: type === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (e) {
      if (type === 'video') {
        // fall back to audio only if there is no camera
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch { /* fall through */ }
      }
      throw new Error(e.name === 'NotAllowedError' ? 'Allow microphone/camera access to make calls.' : 'No microphone or camera found.');
    }
  };

  const createPeer = (callId) => {
    const pc = new RTCPeerConnection({ iceServers: iceServers.current });
    pcRef.current = pc;
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current));
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => { if (!remote.getTracks().includes(t)) remote.addTrack(t); });
      if (!e.streams[0] && !remote.getTracks().includes(e.track)) remote.addTrack(e.track);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('call:signal', { callId, data: { type: 'ice', candidate: e.candidate } });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        setCall((c) => (c && c.status !== 'connected' ? { ...c, status: 'connected', connectedAt: Date.now() } : c));
      } else if (st === 'failed') {
        socket.emit('call:end', { callId });
        cleanup('Connection failed. The network may be blocking calls.');
      }
    };
    return pc;
  };

  const flushCandidates = async () => {
    const pc = pcRef.current;
    for (const c of queued.current) {
      try { await pc.addIceCandidate(c); } catch { /* ignore */ }
    }
    queued.current = [];
  };

  const startCall = useCallback(async (user, type = 'voice') => {
    if (!socket?.connected) return toast('You are offline. Reconnecting…', { error: true });
    if (callRef.current) return toast('You are already on a call.', { error: true });
    setCall({ id: null, peer: user, type, direction: 'outgoing', status: 'preparing' });
    let stream;
    try {
      stream = await getMedia(type);
    } catch (e) {
      setCall(null);
      return toast(e.message, { error: true });
    }
    localRef.current = stream;
    setLocalStream(stream);
    const hasVideo = stream.getVideoTracks().length > 0;
    update({ status: 'ringing', type: hasVideo ? 'video' : type });
    startRing(true);
    socket.emit('call:invite', { toUserId: user.id, type: hasVideo ? 'video' : 'voice' }, (res) => {
      if (res?.error) {
        cleanup(res.error);
        return;
      }
      update({ id: res.callId });
    });
  }, [socket, toast, cleanup]);

  const acceptCall = async () => {
    const c = callRef.current;
    if (!c) return;
    stopRing();
    update({ status: 'connecting' });
    let stream;
    try {
      stream = await getMedia(c.type);
    } catch (e) {
      toast(e.message, { error: true });
      socket.emit('call:decline', { callId: c.id });
      cleanup();
      return;
    }
    localRef.current = stream;
    setLocalStream(stream);
    createPeer(c.id);
    socket.emit('call:accept', { callId: c.id });
  };

  const declineCall = () => {
    const c = callRef.current;
    if (c?.id) socket.emit('call:decline', { callId: c.id });
    cleanup();
  };

  const endCall = () => {
    const c = callRef.current;
    if (c?.id) socket.emit('call:end', { callId: c.id });
    cleanup(c?.status === 'connected' ? 'Call ended' : null);
  };

  const toggleMute = () => {
    const t = localRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    update({ muted: !t.enabled });
  };

  const toggleCamera = () => {
    const t = localRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    update({ cameraOff: !t.enabled });
  };

  const flipCamera = async () => {
    const c = callRef.current;
    const old = localRef.current?.getVideoTracks()[0];
    if (!old) return;
    const facing = c.facing === 'environment' ? 'user' : 'environment';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      const track = s.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((x) => x.track?.kind === 'video');
      await sender?.replaceTrack(track);
      localRef.current.removeTrack(old);
      old.stop();
      localRef.current.addTrack(track);
      setLocalStream(new MediaStream(localRef.current.getTracks()));
      update({ facing });
    } catch {
      toast('Could not switch camera.', { error: true });
    }
  };

  // ---------- socket events ----------
  useEffect(() => {
    if (!socket) return undefined;
    const onIncoming = ({ callId, type, from }) => {
      if (callRef.current) {
        socket.emit('call:decline', { callId });
        return;
      }
      setCall({ id: callId, peer: from, type, direction: 'incoming', status: 'ringing' });
      startRing(false);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        showLocalNotification(`Incoming ${type} call`, { body: `${from.name} is calling you on Kova`, icon: fileUrl(from.avatarId) || '/icon-192.png', tag: `call-${callId}`, requireInteraction: true, data: { url: '/calls' } });
      }
    };
    const onAccepted = async ({ callId, socketId }) => {
      const c = callRef.current;
      if (!c || c.id !== callId) return;
      if (c.direction === 'incoming') {
        if (socketId !== socket.id) cleanup(); // answered on another device
        return;
      }
      stopRing();
      update({ status: 'connecting' });
      const pc = createPeer(callId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:signal', { callId, data: { type: 'offer', sdp: pc.localDescription } });
    };
    const onSignal = async ({ callId, data }) => {
      const c = callRef.current;
      const pc = pcRef.current;
      if (!c || c.id !== callId) return;
      try {
        if (data.type === 'offer' && pc) {
          await pc.setRemoteDescription(data.sdp);
          await flushCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', { callId, data: { type: 'answer', sdp: pc.localDescription } });
        } else if (data.type === 'answer' && pc) {
          await pc.setRemoteDescription(data.sdp);
          await flushCandidates();
        } else if (data.type === 'ice') {
          if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate);
          else queued.current.push(data.candidate);
        }
      } catch (e) {
        console.error('signal error', e);
      }
    };
    const onEnded = ({ callId, status, by }) => {
      const c = callRef.current;
      if (!c || (c.id && c.id !== callId)) return;
      let reason = 'Call ended';
      if (status === 'declined') reason = c.direction === 'outgoing' ? 'Call declined' : null;
      else if (status === 'missed') reason = c.direction === 'outgoing' ? 'No answer' : null;
      if (c.direction === 'incoming' && status === 'missed') toast(`Missed ${c.type} call from ${c.peer.name}`, { icon: 'phone_missed', to: '/calls' });
      if (by === me?.id && c.direction === 'incoming' && status !== 'ended') reason = null;
      cleanup(reason);
    };
    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:signal', onSignal);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:signal', onSignal);
      socket.off('call:ended', onEnded);
    };
  }, [socket, cleanup, toast, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // End the call if the page is closed
  useEffect(() => {
    const onUnload = () => { const c = callRef.current; if (c?.id) socket?.emit('call:end', { callId: c.id }); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [socket]);

  return (
    <CallContext.Provider value={{ call, startCall }}>
      {children}
      {call && (
        <CallScreen
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          onMute={toggleMute}
          onCamera={toggleCamera}
          onFlip={flipCamera}
        />
      )}
    </CallContext.Provider>
  );
}

function MediaView({ stream, muted, className, mirror }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${mirror ? '-scale-x-100' : ''}`} />;
}

function Timer({ since }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tnum">{duration((Date.now() - since) / 1000)}</span>;
}

function CallButton({ icon, label, onClick, active, danger, accept }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <span
        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition active:scale-95 ${
          danger ? 'bg-[#C62828] text-white' : accept ? 'bg-[#C9A86A] text-[#0E1420]' : active ? 'bg-[#FFDB99] text-[#14213D]' : 'bg-white/10 text-white group-hover:bg-white/15'
        }`}
      >
        <Icon name={icon} fill={danger || accept || active} size={26} />
      </span>
      <span className={`text-[12px] ${danger ? 'text-[#FF8A80]' : active || accept ? 'text-[#E5C281] font-semibold' : 'text-white/75'}`}>{label}</span>
    </button>
  );
}

function CallScreen({ call, localStream, remoteStream, onAccept, onDecline, onEnd, onMute, onCamera, onFlip }) {
  const video = call.type === 'video';
  const remoteHasVideo = remoteStream?.getVideoTracks().length > 0;
  const showRemoteVideo = video && remoteHasVideo && call.status === 'connected';
  const statusText = {
    preparing: 'Preparing…',
    ringing: call.direction === 'incoming' ? `Incoming ${call.type} call` : 'Ringing…',
    connecting: 'Connecting…',
    connected: null,
    ended: call.endedReason || 'Call ended',
  }[call.status];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col text-white overflow-hidden bg-[#0B1120] bg-[radial-gradient(ellipse_at_top,#1E2F55_0%,#0B1120_55%,#2A1E0C_130%)] animate-fadeUp">
      {showRemoteVideo && <MediaView stream={remoteStream} className="absolute inset-0 w-full h-full object-cover" />}
      {!showRemoteVideo && remoteStream && <MediaView stream={remoteStream} className="hidden" />}
      {showRemoteVideo && <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />}

      <div className="relative flex items-center justify-between px-5 pt-5 pt-safe">
        <span className="flex items-center gap-2 h-9 px-4 rounded-full bg-white/10 text-[11px] tracking-[0.14em] uppercase text-[#E5C281]">
          <Icon name="lock" size={15} /> {video ? 'Video call' : 'Voice call'} · Direct
        </span>
      </div>

      {video && localStream && call.status !== 'ended' && (
        <div className="absolute top-32 md:top-20 right-4 z-10 w-24 h-36 md:w-40 md:h-56 rounded-2xl overflow-hidden ring-1 ring-[#C9A86A]/50 shadow-2xl bg-black mt-safe">
          <MediaView stream={localStream} muted mirror={call.facing !== 'environment'} className="w-full h-full object-cover" />
          {call.cameraOff && <div className="absolute inset-0 bg-[#14213D] flex items-center justify-center"><Icon name="videocam_off" /></div>}
          <span className="absolute bottom-1.5 left-2 text-[10px] tracking-wider text-white/80">● YOU</span>
        </div>
      )}

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
        {!showRemoteVideo && (
          <div className="relative mb-7">
            {call.status === 'ringing' && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-[#C9A86A] animate-pulseRing" />
                <span className="absolute inset-0 rounded-full border-2 border-[#C9A86A] animate-pulseRing" style={{ animationDelay: '.8s' }} />
              </>
            )}
            <div className="rounded-full p-[3px] bg-gradient-to-br from-[#E5C281] via-[#C9A86A] to-[#6B4E1E] shadow-[0_0_60px_rgba(201,168,106,.35)]">
              <Avatar id={call.peer.avatarId} name={call.peer.name} size={150} className="[&>div]:border-4 [&>div]:border-[#0B1120]" />
            </div>
          </div>
        )}
        <h2 className={`font-serif text-4xl md:text-5xl ${showRemoteVideo ? 'absolute top-6 left-0 right-0 text-2xl md:text-3xl' : ''}`}>{call.peer.name}</h2>
        {!showRemoteVideo && call.peer.username && <p className="text-[#C9A86A] mt-2">@{call.peer.username}</p>}
        <div className={`mt-5 inline-flex items-center gap-2 h-9 px-5 rounded-full bg-white/10 text-sm ${showRemoteVideo ? 'absolute top-16 left-1/2 -translate-x-1/2 mt-0' : ''}`}>
          {call.status === 'connected' ? (
            <><span className="w-2 h-2 rounded-full bg-[#C9A86A]" /><Timer since={call.connectedAt} /> {call.muted && <span className="text-white/60">· muted</span>}</>
          ) : (
            <span className={call.status === 'ended' ? 'text-[#FFB4A9]' : ''}>{statusText}</span>
          )}
        </div>
      </div>

      <div className="relative px-5 pb-8 pb-safe">
        <div className="mx-auto max-w-md rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-5" style={{ marginBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          {call.direction === 'incoming' && call.status === 'ringing' ? (
            <div className="flex items-center justify-around">
              <CallButton icon="call_end" label="Decline" danger onClick={onDecline} />
              <CallButton icon={video ? 'videocam' : 'call'} label="Accept" accept onClick={onAccept} />
            </div>
          ) : (
            <div className="flex items-center justify-around">
              <CallButton icon={call.muted ? 'mic_off' : 'mic'} label={call.muted ? 'Unmute' : 'Mute'} active={call.muted} onClick={onMute} />
              {video && <CallButton icon={call.cameraOff ? 'videocam_off' : 'videocam'} label="Camera" active={call.cameraOff} onClick={onCamera} />}
              {video && <CallButton icon="flip_camera_ios" label="Flip" onClick={onFlip} />}
              <CallButton icon="call_end" label={call.status === 'ended' ? 'Close' : 'End'} danger onClick={onEnd} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
