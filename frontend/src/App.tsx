import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ImportExcelPage from './pages/ImportExcelPage';
import SpecItemDetailPage from './pages/SpecItemDetailPage';
import SpecItemsPage from './pages/SpecItemsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="spec-items" element={<SpecItemsPage />} />
        <Route path="spec-items/:id" element={<SpecItemDetailPage />} />
        <Route path="import-excel" element={<ImportExcelPage />} />
      </Route>
    </Routes>
  );
}
