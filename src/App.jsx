import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './context/AppContext.jsx';
import Section from './components/Layout.jsx';
import Toasts from './components/Toasts.jsx';
import { Logo, Spinner, EmptyState } from './components/ui.jsx';
import Welcome from './pages/Welcome.jsx';
import ChatList from './pages/ChatList.jsx';
import Conversation from './pages/Conversation.jsx';
import NewChat from './pages/NewChat.jsx';
import NewGroup from './pages/NewGroup.jsx';
import GroupInfo from './pages/GroupInfo.jsx';
import ContactProfile from './pages/ContactProfile.jsx';
import JoinGroup from './pages/JoinGroup.jsx';
import ChannelList from './pages/ChannelList.jsx';
import ChannelPage from './pages/ChannelPage.jsx';
import ChannelForm from './pages/ChannelForm.jsx';
import PostPage from './pages/PostPage.jsx';
import Activity from './pages/Activity.jsx';
import CallList from './pages/CallList.jsx';
import MomentList from './pages/MomentList.jsx';
import MomentViewer from './pages/MomentViewer.jsx';
import SettingsMenu from './pages/SettingsMenu.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function Boot() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center gap-6 bg-canvas">
      <Logo size={64} />
      <div className="font-serif text-3xl tracking-wide text-ink">GOCHAT</div>
      <Spinner />
      {slow && <p className="text-sm text-muted text-center max-w-xs px-6">Waking up the Gochat server… on the free plan this can take up to a minute the first time.</p>}
    </div>
  );
}

const chatEmpty = (
  <EmptyState
    icon="forum"
    title="Your correspondence"
    text="Choose a conversation on the left, or start a new one. Messages arrive the moment they are sent."
    quote="Words composed with care endure like bronze."
  />
);

export default function App() {
  const { me, booting } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const go = (e) => navigate(e.detail);
    window.addEventListener('gochat:navigate', go);
    return () => window.removeEventListener('gochat:navigate', go);
  }, [navigate]);

  if (booting) return <Boot />;
  if (!me) {
    return (
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="*" element={<Navigate to="/welcome" replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }

  const chats = <ChatList />;
  const channels = <ChannelList />;
  const calls = <CallList />;
  const moments = <MomentList />;
  const settings = <SettingsMenu />;

  return (
    <>
      <Routes>
        <Route path="/welcome" element={<Navigate to={location.state?.from || '/'} replace />} />
        <Route path="/" element={<Section list={chats} detail={chatEmpty} />} />
        <Route path="/chat/:id" element={<Section list={chats} detail={<Conversation />} showDetail />} />
        <Route path="/chat/:id/info" element={<Section list={chats} detail={<GroupInfo />} showDetail />} />
        <Route path="/user/:id" element={<Section list={chats} detail={<ContactProfile />} showDetail />} />
        <Route path="/new" element={<Section list={chats} detail={<NewChat />} showDetail />} />
        <Route path="/new-group" element={<Section list={chats} detail={<NewGroup />} showDetail />} />
        <Route path="/join/:code" element={<Section list={chats} detail={<JoinGroup />} showDetail />} />
        <Route path="/activity" element={<Section list={channels} detail={<Activity />} showDetail />} />

        <Route path="/channels" element={<Section list={channels} detail={
          <EmptyState icon="hub" title="Channels" text="Follow channels to receive their posts, or create your own and share updates with everyone who follows you." />
        } />} />
        <Route path="/channels/new" element={<Section list={channels} detail={<ChannelForm />} showDetail />} />
        <Route path="/channels/:id" element={<Section list={channels} detail={<ChannelPage />} showDetail />} />
        <Route path="/channels/:id/edit" element={<Section list={channels} detail={<ChannelForm edit />} showDetail />} />
        <Route path="/posts/:id" element={<Section list={channels} detail={<PostPage />} showDetail />} />

        <Route path="/calls" element={<Section list={calls} detail={
          <EmptyState icon="call" title="Voice & video calls" text="Open a chat and tap the phone or camera icon to call. Calls go directly between your devices." />
        } />} />

        <Route path="/moments" element={<Section list={moments} detail={
          <EmptyState icon="auto_awesome" title="Moments" text="Share a photo, video or a few words with your contacts. Moments disappear after 24 hours." />
        } />} />
        <Route path="/moments/:userId" element={<Section list={moments} detail={<MomentViewer />} showDetail immersive />} />

        <Route path="/settings" element={<Section list={settings} detail={<SettingsPage section="appearance" desktopDefault />} />} />
        <Route path="/settings/:section" element={<Section list={settings} detail={<SettingsPage />} showDetail />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </>
  );
}
