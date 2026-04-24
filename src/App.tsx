import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Commandes from './pages/Commandes'
import NouvelleCommande from './pages/NouvelleCommande'
import Recettes from './pages/Recettes'
import Clients from './pages/Clients'
import Finances from './pages/Finances'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/tableau-de-bord" replace />} />
        <Route path="/tableau-de-bord" element={<Dashboard />} />
        <Route path="/commandes" element={<Commandes />} />
        <Route path="/commandes/nouvelle" element={<NouvelleCommande />} />
        <Route path="/recettes" element={<Recettes />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/finances" element={<Finances />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
