import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import CatalogPage from './pages/CatalogPage';
import ClientDetailPage from './pages/ClientDetailPage';
import ClientsPage from './pages/ClientsPage';
import DashboardPage from './pages/DashboardPage';
import ImportExcelPage from './pages/ImportExcelPage';
import SpecDetailPage from './pages/SpecDetailPage';
import SpecItemDetailPage from './pages/SpecItemDetailPage';
import SpecItemsPage from './pages/SpecItemsPage';
import SpecsPage from './pages/SpecsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:cliente" element={<ClientDetailPage />} />
        <Route path="specs" element={<SpecsPage />} />
        <Route path="specs/:id" element={<SpecDetailPage />} />
        <Route path="catalog-items" element={<CatalogPage />} />
        <Route path="spec-items" element={<SpecItemsPage />} />
        <Route path="spec-items/:id" element={<SpecItemDetailPage />} />
        <Route path="import-excel" element={<ImportExcelPage />} />
      </Route>
    </Routes>
  );
}
