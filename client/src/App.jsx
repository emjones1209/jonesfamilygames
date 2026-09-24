import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
// Multiplayer is unfinished and hidden: SocketProvider (context/SocketContext) and
// MultiplayerLobby are kept for later but not mounted, so no socket is opened.
import { FullPageLoader } from "./components/LoadingSpinner";

// Pages
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import WelcomePage from "./pages/WelcomePage";

// Games
import TriviaGame from "./games/trivia/TriviaGame";
import SolitaireGame from "./games/solitaire/SolitaireGame";
import HeartsGame from "./games/hearts/HeartsGame";
import SpadesGame from "./games/spades/SpadesGame";
import RookGame from "./games/rook/RookGame";
import CanastaGame from "./games/canasta/CanastaGame";
import BridgeGame from "./games/bridge/BridgeGame";
import Golf6Game from "./games/golf6/Golf6Game";
import JigsawGame from "./games/jigsaw/JigsawGame";
import Match3Game from "./games/match3/Match3Game";
import MinesweeperGame from "./games/minesweeper/MinesweeperGame";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader text="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader text="Loading..." />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/welcome" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />

      {/* Trivia routes */}
      <Route path="/games/trivia/:category" element={<ProtectedRoute><TriviaGame /></ProtectedRoute>} />

      {/* Card games */}
      <Route path="/games/solitaire" element={<ProtectedRoute><SolitaireGame /></ProtectedRoute>} />
      <Route path="/games/hearts" element={<ProtectedRoute><HeartsGame /></ProtectedRoute>} />
      <Route path="/games/spades" element={<ProtectedRoute><SpadesGame /></ProtectedRoute>} />
      <Route path="/games/rook" element={<ProtectedRoute><RookGame /></ProtectedRoute>} />
      <Route path="/games/canasta" element={<ProtectedRoute><CanastaGame /></ProtectedRoute>} />
      <Route path="/games/bridge" element={<ProtectedRoute><BridgeGame /></ProtectedRoute>} />
      <Route path="/games/golf6" element={<ProtectedRoute><Golf6Game /></ProtectedRoute>} />

      {/* Puzzle, Match3 & Minesweeper */}
      <Route path="/games/jigsaw" element={<ProtectedRoute><JigsawGame /></ProtectedRoute>} />
      <Route path="/games/match3" element={<ProtectedRoute><Match3Game /></ProtectedRoute>} />
      <Route path="/games/minesweeper" element={<ProtectedRoute><MinesweeperGame /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
