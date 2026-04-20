import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import HostRoomPage from './pages/HostRoomPage.jsx';
import PlayRoomPage from './pages/PlayRoomPage.jsx';
import GameRulesPage from './pages/GameRulesPage.jsx';

function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTopOnNavigate />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/games/:slug" element={<GameRulesPage />} />
      <Route path="/room/:code/host" element={<HostRoomPage />} />
      <Route path="/room/:code/play" element={<PlayRoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
