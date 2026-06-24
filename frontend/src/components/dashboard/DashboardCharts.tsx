import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardStats } from '../../api/specItemsApi';
import ChartCard from './ChartCard';
import { Grid } from '@mui/material';
import { stepTokens } from '../../theme/tokens';

const CHART_COLORS = [stepTokens.primary, stepTokens.secondary, stepTokens.primaryLight, '#5B8DEF', '#7AD7E8'];

interface DashboardChartsProps {
  stats: DashboardStats;
}

export default function DashboardCharts({ stats }: DashboardChartsProps) {
  const familyData = stats.quality_by_family.slice(0, 10).map((row) => ({
    name: row.item_type.length > 18 ? `${row.item_type.slice(0, 18)}…` : row.item_type,
    total: row.total,
  }));

  const clientsData = stats.clients_summary.slice(0, 8).map((row) => ({
    name: row.cliente.length > 14 ? `${row.cliente.slice(0, 14)}…` : row.cliente,
    total: row.total_occurrences,
  }));

  const weightDistribution = [
    { name: 'Com peso', value: stats.distribution.with_weight },
    { name: 'Sem peso', value: stats.distribution.without_weight },
  ];

  const alterdataDistribution = [
    { name: 'Com AlterDataID', value: stats.distribution.with_alterdata_id },
    { name: 'Sem AlterDataID', value: stats.distribution.without_alterdata_id },
  ];

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} lg={6}>
        <ChartCard title="Itens produtivos por família" subtitle="Top 10 famílias (escopo produtivo STEP)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={familyData} layout="vertical" margin={{ left: 20, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={stepTokens.border} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill={stepTokens.primary} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid item xs={12} lg={6}>
        <ChartCard title="Top clientes por ocorrências" subtitle="Volume em specs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={clientsData}>
              <CartesianGrid strokeDasharray="3 3" stroke={stepTokens.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill={stepTokens.secondary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <ChartCard title="Qualidade geral: peso" subtitle="Com peso x sem peso">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={weightDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {weightDistribution.map((_, index) => (
                  <Cell key={`w-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <ChartCard title="Qualidade geral: AlterDataID" subtitle="Com ID x sem ID">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={alterdataDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {alterdataDistribution.map((_, index) => (
                  <Cell key={`a-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
    </Grid>
  );
}
