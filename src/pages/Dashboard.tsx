import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../api/supabase';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { SeriesRow } from '../types/series';
import { TooltipProps } from 'recharts';

export default function DashboardCharts() {
  // --- Filters State ---
  const [data, setData] = useState<SeriesRow[]>([]);
  const [filters, setFilters] = useState({
    timePeriod: 'all',
    fund: '',
    spv: '',
    class: '',
    investor: '',
  });

  // Formatter for USD
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


  // --- Fetch Data ---
  useEffect(() => {
    async function fetchData() {
      let query = supabase
        .from('series_data')
        .select('*')
        .eq('table_type', 'tblSeries');
      if (filters.fund) query = query.eq('fund', filters.fund);
      if (filters.spv) query = query.eq('spv', filters.spv);
      if (filters.class) query = query.eq('class', filters.class);
      if (filters.investor)
        query = query.ilike('investor', `%${filters.investor}%`);
      if (filters.timePeriod !== 'all') {
        const date = new Date();
        if (filters.timePeriod === 'lastMonth') date.setMonth(date.getMonth() - 1);
        if (filters.timePeriod === 'lastYear') date.setFullYear(date.getFullYear() - 1);
        query = query.gte('inserted_at', date.toISOString());
      }
      const { data: rows, error } = await query;
      if (error) console.error(error);
      else setData(rows as SeriesRow[]);
    }
    fetchData();
  }, [filters]);

  const [excludeZeros, setExcludeZeros] = useState(false);

   // --- Filtered Data for Zero Exclusion ---
  const filteredData = useMemo(() => {
    return excludeZeros
      ? data.filter(r =>
          (r.percent_acq_fee || 0) > 0 ||
          (r.percent_broker_fee || 0) > 0 ||
          (r.percent_spv_reserve || 0) > 0 ||
          (r.percent_mgmt_fee || 0) > 0 ||
          (r.percent_reserve_fee || 0) > 0 ||
          (r.loan_fee_percent || 0) > 0
        )
      : data;
  }, [data, excludeZeros]);

  // --- 1) Investor-concentration Pareto ---
const paretoData = useMemo(() => {
  // 1) Sum subscription per investor
  const totals = data.reduce<Record<string, number>>((acc, r) => {
    if (!r.investor) return acc;
    acc[r.investor] = (acc[r.investor] || 0) + (r.subscription_amount ?? 0);
    return acc;
  }, {});

  // 2) Turn into array and sort descending
  const arr = Object.entries(totals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // 3) Compute cumulative %
  const total = arr.reduce((sum, d) => sum + d.amount, 0);
  let running = 0;
  return arr.map(d => {
    running += d.amount;
    return {
      ...d,
      cumulativePercent: +(running / total * 100).toFixed(2),
    };
  });
}, [data]);

/** VERBOSE debugging tooltip */
const ParetoTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
}) => {
  // ─────────── 1. ENTRY ───────────
  console.log('[TT] render  →  active:', active, ' label:', label);
  console.log('[TT] payload →', payload);

  if (!active) {
    console.log('[TT] inactive → returning null');
    return null;
  }
  if (!payload || payload.length === 0) {
    console.log('[TT] no payload → returning null');
    return null;
  }

  // payload[0].payload should be { name, amount, cumulativePercent }
  const raw = payload[0].payload as
    | { name?: string; amount?: number; cumulativePercent?: number }
    | undefined;

  console.log('[TT] raw data row →', raw);

  if (!raw) {
    console.log('[TT] raw = undefined → returning null');
    return null;
  }

  const { name, amount, cumulativePercent } = raw;

  if (
    name === undefined ||
    amount === undefined ||
    cumulativePercent === undefined
  ) {
    console.log('[TT] missing field(s) →', { name, amount, cumulativePercent });
    return null;
  }

  // ─────────── 2. SUCCESS ───────────
  console.log('[TT] SUCCESS → rendering tooltip for', name);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        padding: 8,
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        lineHeight: 1.5,
        color: '#222',
      }}
    >
    <strong>{name}</strong>
    <br />
    <span style={{ color: '#8884d8' /* same purple as your bars */ }}>
      Subscription:
    </span>{' '}
    <span style={{ color: '#8884d8' }}>
      {currencyFormatter.format(amount)}
    </span>
    <br />
    <span style={{ color: '#FF8042' /* same orange as your line */ }}>
      Cumulative %:
    </span>{' '}
    <span style={{ color: '#FF8042' }}>
      {cumulativePercent.toFixed(2)}%
    </span>
  </div>
  );
};




// --- 2) Portfolio-level fee waterfall ---
  const feeSums = useMemo(() => {
    const totalSub = filteredData.reduce((sum, r) => sum + (r.subscription_amount || 0), 0);
    if (totalSub === 0) {
      return {
        acqPct: 0,
        brokerPct: 0,
        mgmtPct: 0,
        reservePct: 0,
        spvReservePct: 0,
        loanFeePct: 0,
        netPct: 100,
        acqChargedPct: 0,
        brokerChargedPct: 0,
        mgmtChargedPct: 0,
        reserveChargedPct: 0,
        spvReserveChargedPct: 0,
        loanFeeChargedPct: 0,
      };
    }

    // Calculate capital subject to each fee
    const acqCapital = filteredData.reduce((s, r) => s + ((r.percent_acq_fee || 0) > 0 ? r.subscription_amount || 0 : 0), 0);
    const brokerCapital = filteredData.reduce((s, r) => s + ((r.percent_broker_fee || 0) > 0 ? r.subscription_amount || 0 : 0), 0);
    const mgmtCapital = filteredData.reduce((s, r) => s + ((r.percent_mgmt_fee || 0) > 0 ? r.subscription_amount || 0 : 0), 0);
    const reserveCapital = filteredData.reduce((s, r) => s + ((r.percent_reserve_fee || 0) > 0 ? r.subscription_amount || 0 : 0), 0);
    const spvReserveCapital = filteredData.reduce((s, r) => s + ((r.percent_spv_reserve || 0) > 0 ? r.subscription_amount || 0 : 0), 0);
    const loanFeeCapital = filteredData.reduce((s, r) => s + ((r.loan_fee_percent || 0) > 0 ? r.subscription_amount || 0 : 0), 0);

    // Compute each $ amount
    const acq$ = filteredData.reduce((s, r) => s + (r.subscription_amount || 0) * (r.percent_acq_fee || 0), 0);
    const broker$ = filteredData.reduce((s, r) => s + (r.subscription_amount || 0) * (r.percent_broker_fee || 0), 0);
    const mgmt$ = filteredData.reduce((s, r) => s + (r.subscription_amount || 0) * (r.percent_mgmt_fee || 0), 0);
    const reserve$ = filteredData.reduce((s, r) => s + (r.subscription_amount || 0) * (r.percent_reserve_fee || 0), 0);
    const spvReserve$ = filteredData.reduce((s, r) => s + (r.subscription_amount || 0) * (r.percent_spv_reserve || 0), 0);
    const loanFee$ = filteredData.reduce((s, r) => s + (r.subscription_amount || 0) * (r.loan_fee_percent || 0), 0);

    // Convert to %
    const acqPct = (acq$ / totalSub) * 100;
    const brokerPct = (broker$ / totalSub) * 100;
    const mgmtPct = (mgmt$ / totalSub) * 100;
    const reservePct = (reserve$ / totalSub) * 100;
    const spvReservePct = (spvReserve$ / totalSub) * 100;
    const loanFeePct = (loanFee$ / totalSub) * 100;

    // Percentage of capital charged
    const acqChargedPct = (acqCapital / totalSub) * 100;
    const brokerChargedPct = (brokerCapital / totalSub) * 100;
    const mgmtChargedPct = (mgmtCapital / totalSub) * 100;
    const reserveChargedPct = (reserveCapital / totalSub) * 100;
    const spvReserveChargedPct = (spvReserveCapital / totalSub) * 100;
    const loanFeeChargedPct = (loanFeeCapital / totalSub) * 100;

    // Net = remainder of the 100%
    const totalFeesPct = acqPct + brokerPct + mgmtPct + reservePct + spvReservePct + loanFeePct;
    const netPct = 100 - totalFeesPct;

    return {
      acqPct,
      brokerPct,
      mgmtPct,
      reservePct,
      spvReservePct,
      loanFeePct,
      netPct,
      acqChargedPct,
      brokerChargedPct,
      mgmtChargedPct,
      reserveChargedPct,
      spvReserveChargedPct,
      loanFeeChargedPct,
    };
  }, [filteredData]);

  const waterfallData = useMemo(() => {
    const {
      acqPct,
      brokerPct,
      mgmtPct,
      reservePct,
      spvReservePct,
      loanFeePct,
      netPct,
      acqChargedPct,
      brokerChargedPct,
      mgmtChargedPct,
      reserveChargedPct,
      spvReserveChargedPct,
      loanFeeChargedPct,
    } = feeSums;

    return [
      { name: 'Commitment', value: 100, chargedPct: 100 },
      { name: 'Acquisition Fee', value: -acqPct, chargedPct: acqChargedPct },
      { name: 'Broker Fee', value: -brokerPct, chargedPct: brokerChargedPct },
      { name: 'Management Fee', value: -mgmtPct, chargedPct: mgmtChargedPct },
      { name: 'Fund Reserve', value: -reservePct, chargedPct: reserveChargedPct },
      { name: 'SPV Reserve', value: -spvReservePct, chargedPct: spvReserveChargedPct },
      { name: 'Loan Fee', value: -loanFeePct, chargedPct: loanFeeChargedPct },
      { name: 'Net Subscription', value: netPct, chargedPct: 100 },
    ];
  }, [feeSums]);

// ───── DEBUG LOGS ─────
console.log('▶ feeSums:', feeSums);
console.log('▶ waterfallData:', waterfallData);
// ────────────────────────


  // --- 3) Ownership distribution histogram ---
  const histData = useMemo(() => {
    const bins = [
      { name: '0–1%', min: 0, max: 1, count: 0 },
      { name: '1–5%', min: 1, max: 5, count: 0 },
      { name: '5–10%', min: 5, max: 10, count: 0 },
      { name: '>10%', min: 10, max: Infinity, count: 0 },
    ];
    data.forEach(r => {
      const pct = (r.percent_ownership || 0) * 100;
      const bin = bins.find(b => pct >= b.min && pct < b.max) || bins[3];
      bin.count += 1;
    });
    return bins;
  }, [data]);

  console.log('Rows in query:', data.length);
console.log('Rows summed in bins:', histData.reduce((s,b)=>s+b.count,0));




  // --- 4) Top-5 by SPV ---
  const top5SPV = useMemo(() => {
    const totals = data.reduce<Record<string, number>>((acc, r) => {
      if (!r.spv || !r.subscription_amount) return acc;
      acc[r.spv] = (acc[r.spv] || 0) + r.subscription_amount;
      return acc;
    }, {});
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

// --- 5) Net Subscription per Class ---
const classData = useMemo(() => {
  const totals = data.reduce<Record<string, number>>((acc, r) => {
    if (!r.class || !r.net_subscription) return acc;
    acc[r.class] = (acc[r.class] || 0) + r.net_subscription;
    return acc;
  }, {});

  // turn into array, then sort biggest → smallest
  return Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}, [data]);


  // use the built-in “compact” notation for K/M suffixes
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});


return (
  <div style={{ padding: 16 }}>
    {/* Filters */}
    <div style={{ marginBottom: 16 }}>
      <select
        value={filters.timePeriod}
        onChange={e => setFilters({ ...filters, timePeriod: e.target.value })}
      >
        <option value="all">All Time</option>
        <option value="lastMonth">Last Month</option>
        <option value="lastYear">Last Year</option>
      </select>
      <input
        placeholder="Fund"
        value={filters.fund}
        onChange={e => setFilters({ ...filters, fund: e.target.value })}
        style={{ marginLeft: 8 }}
      />
      <input
        placeholder="SPV"
        value={filters.spv}
        onChange={e => setFilters({ ...filters, spv: e.target.value })}
        style={{ marginLeft: 8 }}
      />
      <input
        placeholder="Class"
        value={filters.class}
        onChange={e => setFilters({ ...filters, class: e.target.value })}
        style={{ marginLeft: 8 }}
      />
      <input
        placeholder="Investor"
        value={filters.investor}
        onChange={e => setFilters({ ...filters, investor: e.target.value })}
        style={{ marginLeft: 8 }}
      />
    </div>

    {/* 1) Pareto */}
    <section style={{ marginBottom: 32 }}>
      <h3>Who really funds us?</h3>
      <p>80/20 view of capital by investor.</p>
<ResponsiveContainer width="100%" height={300}>
<ComposedChart
  data={paretoData}
  margin={{ top: 20, right: 50, bottom: 20, left: 80 }}  // ← was 20
>

    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" tick={false} axisLine={false} height={0} />
<YAxis
  yAxisId="left"
  width={80}
  tickMargin={8}
  tickFormatter={(value) => currencyFormatter.format(value)}  // ← formats 100000 → $100,000.00
  label={{
    value: 'Amount ($)',
    angle: -90,
    position: 'insideLeft',
    offset: -65,
    style: { textAnchor: 'middle' },
  }}
/>

    <YAxis
      yAxisId="right"
      orientation="right"
      domain={[0, 100]}
      label={{ value: 'Cumulative %', angle: 90, position: 'insideRight' }}
    />
 <Tooltip content={<ParetoTooltip />} />

    <Legend />
    <Bar
      yAxisId="left"
      dataKey="amount"
      name="Subscription"
      fill="#8884d8"
    />
    <Line
      yAxisId="right"
      dataKey="cumulativePercent"
      name="Cumulative %"
      stroke="#FF8042"
      dot
    />
  </ComposedChart>
</ResponsiveContainer>
    </section>

      {/* 2) Waterfall */}
      <section style={{ marginBottom: 32 }}>
        <h3>Where does every $1 go?</h3>
        <p>Fee drag waterfall for $100 of commitments.</p>
        {filteredData.length === 0 || feeSums.acqPct === 0 && feeSums.brokerPct === 0 && feeSums.mgmtPct === 0 && feeSums.reservePct === 0 ? (
          <div>No data available to display the waterfall chart.</div>
        ) : (
<ResponsiveContainer width="100%" height={300}>
  <ComposedChart
    data={waterfallData}
    margin={{ top: 20, right: 20, bottom: 20, left: 50 }}  // ← give more left-gutter for label
    stackOffset="sign"
  >
    <CartesianGrid strokeDasharray="3 3" />

    <XAxis dataKey="name" />

    <YAxis
      // 1) auto-scale to min/max (so negatives show up)
      domain={['dataMin', 'dataMax']}
      // 2) render ticks like "−0.07%" or "100.00%"
      tickFormatter={(value) => `${value.toFixed(2)}%`}
      // 3) axis label
      label={{
        value: '% of Commitment',
        angle: -90,
        position: 'insideLeft',
        offset: -30,
        style: { textAnchor: 'middle' },
      }}
    />

    <Tooltip formatter={(v: number) => `${v.toFixed(2)} %`} />
    <Legend />

    <Bar
      dataKey="chargedPct"
      fill="#d3d3d3"
      name="% of Capital Charged"
      barSize={10}
      opacity={0.5}
    />
    <Bar
      dataKey="value"
      fill="#82ca9d"
      name="% of Commitment"
      barSize={20}
    />
  </ComposedChart>
</ResponsiveContainer>

        )}
      </section>

      {/* 3) Histogram */}
      <section style={{ marginBottom: 32 }}>
        <h3>Ownership distribution</h3>
        <p>Frequency of % ownership stakes.</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={histData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" label={{ value: '% Ownership Bin', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </section>

{/* 4) Top-5 SPV */}
<section style={{ marginBottom: 32 }}>
  <h3>Top 5 SPVs by Subscription</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart
      data={top5SPV}
      margin={{ top: 20, right: 20, bottom: 20, left: 80 }} // ← extra left margin for label
    >
      <CartesianGrid strokeDasharray="3 3" />

      <XAxis dataKey="name" />

<YAxis
  domain={[1_000_000, 30_000_000]}
  tickFormatter={(value) => compactFormatter.format(value)}
  label={{
    value: 'Subscription ($)',
    angle: -90,
    position: 'insideLeft',
    offset: -10,
    style: { textAnchor: 'middle' },
  }}
/>


      <Tooltip
        formatter={(value: number) => currencyFormatter.format(value)}
      />

      <Bar dataKey="value" fill="#8884d8" name="Subscription" />
    </BarChart>
  </ResponsiveContainer>
</section>


      {/* 5) Subscription per Class */}
      <section>
        <h3>Net Subscription per Class</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={classData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Bar dataKey="value" fill="#FFBB28" />
          </BarChart>
        </ResponsiveContainer>
      </section>

    </div>
  );
}
