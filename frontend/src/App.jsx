import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import UnsubscribePage from './pages/UnsubscribePage.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-space-bg text-space-text">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
        </Routes>
      </main>
    </div>
  );
}
