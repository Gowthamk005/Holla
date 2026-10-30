import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { RequireAuth } from "./components/RequireAuth.jsx";
import Feed from "./pages/Feed.jsx";
import Watch from "./pages/Watch.jsx";
import Channel from "./pages/Channel.jsx";
import Login from "./pages/Login.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import Library from "./pages/Library.jsx";
import People from "./pages/People.jsx";
import Messages from "./pages/Messages.jsx";
import Wallet from "./pages/Wallet.jsx";
import Studio from "./pages/Studio.jsx";
import Admin from "./pages/Admin.jsx";
import YouTube from "./pages/YouTube.jsx";
import YouTubeWatch from "./pages/YouTubeWatch.jsx";
import Apps from "./pages/Apps.jsx";
import VideoPlayer from "./pages/VideoPlayer.jsx";
import Create from "./pages/Create.jsx";
import Profile from "./pages/Profile.jsx";
import Settings from "./pages/Settings.jsx";
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Login mode="register" />} />
      <Route element={<Layout />}>
        <Route index element={<Feed mode="home" />} />
        <Route path="trending" element={<Feed mode="trending" />} />
        <Route path="category/:cat" element={<Feed mode="category" />} />
        <Route path="watch/:id" element={<Watch />} />
        <Route path="youtube" element={<YouTube />} />
        <Route path="youtube/:id" element={<YouTubeWatch />} />
        <Route path="apps" element={<Apps />} />
        <Route path="c/:username" element={<Channel />} />
        <Route path="subscriptions" element={<RequireAuth><Subscriptions /></RequireAuth>} />
        <Route path="library/:type" element={<RequireAuth><Library /></RequireAuth>} />
        <Route path="people" element={<RequireAuth><People /></RequireAuth>} />
        <Route path="messages" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="messages/:userId" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
        <Route path="studio" element={<RequireAuth><Studio /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
        <Route path="*" element={<div className="empty"><h2>Page not found</h2></div>} />
        <Route path="/create" element={<RequireAuth><Create /></RequireAuth>} />
           <Route path="me" element={<RequireAuth><Profile /></RequireAuth>} />
   <Route path="settings" element={<RequireAuth><Settings /></RequireAuth>} />
      </Route>
    </Routes>
  );
}
