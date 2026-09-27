import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FullPageLoader } from "./components/LoadingSpinner";
import { AppUpdater } from "./components/AppUpdater";   // keeps the saved app up to date

// Pages
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import WelcomePage from "./pages/WelcomePage";
import PlayTogetherPage from "./pages/PlayTogetherPage";
import TablePage from "./pages/TablePage";

// Games
import TriviaGame from "./games/trivia/TriviaGame";
import SolitaireGame from "./games/solitaire/SolitaireGame";
import HeartsGame from "./games/hearts/HeartsGame";
import SpadesGame from "./games/spades/SpadesGame";
import RookGame from "./games/rook/RookGame";
import CanastaGame from "./games/canasta/CanastaGame";
import HandFootGame from "./games/handfoot/HandFootGame";
import MexicanTrainGame from "./games/train/MexicanTrainGame";
import DiceGame from "./games/dice/DiceGame";
import BridgeGame from "./games/bridge/BridgeGame";
import EuchreGame from "./games/euchre/EuchreGame";
import Golf6Game from "./games/golf6/Golf6Game";
import JigsawGame from "./games/jigsaw/JigsawGame";
import Match3Game from "./games/match3/Match3Game";
import MinesweeperGame from "./games/minesweeper/MinesweeperGame";
import Game2048 from "./games/g2048/Game2048";
import WordSearchGame from "./games/wordsearch/WordSearchGame";

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
      <Route path="/together" element={<ProtectedRoute><PlayTogetherPage /></ProtectedRoute>} />
      <Route path="/together/:code" element={<ProtectedRoute><TablePage /></ProtectedRoute>} />

      {/* Trivia routes */}
      <Route path="/games/trivia/:category" element={<ProtectedRoute><TriviaGame /></ProtectedRoute>} />

      {/* Card games */}
      <Route path="/games/solitaire" element={<ProtectedRoute><SolitaireGame /></ProtectedRoute>} />
      <Route path="/games/hearts" element={<ProtectedRoute><HeartsGame /></ProtectedRoute>} />
      <Route path="/games/spades" element={<ProtectedRoute><SpadesGame /></ProtectedRoute>} />
      <Route path="/games/rook" element={<ProtectedRoute><RookGame /></ProtectedRoute>} />
      <Route path="/games/canasta" element={<ProtectedRoute><CanastaGame /></ProtectedRoute>} />
      <Route path="/games/handfoot" element={<ProtectedRoute><HandFootGame /></ProtectedRoute>} />
      <Route path="/games/train" element={<ProtectedRoute><MexicanTrainGame /></ProtectedRoute>} />
      <Route path="/games/dice" element={<ProtectedRoute><DiceGame /></ProtectedRoute>} />
      <Route path="/games/bridge" element={<ProtectedRoute><BridgeGame /></ProtectedRoute>} />
      <Route path="/games/euchre" element={<ProtectedRoute><EuchreGame /></ProtectedRoute>} />
      <Route path="/games/golf6" element={<ProtectedRoute><Golf6Game /></ProtectedRoute>} />

      {/* Puzzles */}
      <Route path="/games/jigsaw" element={<ProtectedRoute><JigsawGame /></ProtectedRoute>} />
      <Route path="/games/match3" element={<ProtectedRoute><Match3Game /></ProtectedRoute>} />
      <Route path="/games/minesweeper" element={<ProtectedRoute><MinesweeperGame /></ProtectedRoute>} />
      <Route path="/games/2048" element={<ProtectedRoute><Game2048 /></ProtectedRoute>} />
      <Route path="/games/wordsearch" element={<ProtectedRoute><WordSearchGame /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <AppUpdater />
      </AuthProvider>
    </BrowserRouter>
  );
}
