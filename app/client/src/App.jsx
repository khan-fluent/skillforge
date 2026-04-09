import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Accept from "./pages/Accept.jsx";

import Shell from "./components/Shell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Matrix from "./pages/Matrix.jsx";
import People from "./pages/People.jsx";
import Skills from "./pages/Skills.jsx";
import Gaps from "./pages/Gaps.jsx";
import Certifications from "./pages/Certifications.jsx";
import Chat from "./pages/Chat.jsx";
import Settings from "./pages/Settings.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-fill"><span className="loader"><span /><span /><span /></span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-fill"><span className="loader"><span /><span /><span /></span></div>;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/accept/:token" element={<Accept />} />

      {/* App (signed-in) */}
      <Route path="/app" element={<Protected><Shell /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="matrix" element={<Matrix />} />
        <Route path="people" element={<People />} />
        <Route path="skills" element={<Skills />} />
        <Route path="gaps" element={<Gaps />} />
        <Route path="certifications" element={<Certifications />} />
        <Route path="chat" element={<Chat />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
