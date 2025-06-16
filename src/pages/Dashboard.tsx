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
  Scatter,
  ScatterChart,
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

// --- 6) Gross Subscription per Class ---
const classDataGross = useMemo(() => {
  const totals = data.reduce<Record<string, number>>((acc, r) => {
    if (!r.class || !r.subscription_amount) return acc;
    acc[r.class] = (acc[r.class] || 0) + r.subscription_amount;
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

/**
 * 7) Investor-level scatter data (filtered by current `data`)
 */
const investorScatter = useMemo(() => {
  interface Agg { totalSub: number; weightedFeeSum: number; slSeries: Set<string>; }
  const map: Record<string, Agg> = {};

  data.forEach(r => {
    if (!r.investor || r.subscription_amount == null || r.percent_mgmt_fee == null) return;
    const sub = r.subscription_amount;
    const feePct = r.percent_mgmt_fee * 100;    // turn into pct
    const inv = r.investor;

    if (!map[inv]) {
      map[inv] = { totalSub: 0, weightedFeeSum: 0, slSeries: new Set() };
    }

    map[inv].totalSub        += sub;
    map[inv].weightedFeeSum  += sub * feePct;
    if (r.side_letter?.trim()) {
      map[inv].slSeries.add(r.sheet_name);
    }
  });

  return Object.entries(map).map(([investor, agg]) => ({
    investor,
    sub:    agg.totalSub,
    feePct: agg.totalSub
      ? agg.weightedFeeSum / agg.totalSub
      : 0,
    series: Array.from(agg.slSeries),        // e.g. ["Series A","Series B"]
    hasSL:  agg.slSeries.size > 0,
  }));
}, [data]);

interface ScatterRow {
  investor: string;
  sub: number;
  feePct: number;
  series: string[];
  hasSL: boolean;
}

/** VERBOSE debugging tooltip for the investor scatter */
const InvestorTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
}) => {
  console.log('[IT] render → active:', active, ' label:', label);
  console.log('[IT] payload →', payload);

  if (!active || !payload || payload.length === 0) {
    console.log('[IT] inactive or no payload → null');
    return null;
  }

  // Extract our row object
  const raw = payload[0].payload as ScatterRow | undefined;
  console.log('[IT] raw data →', raw);
  if (!raw) {
    console.log('[IT] raw undefined → null');
    return null;
  }

  const { investor, sub, feePct, series, hasSL } = raw;
  console.log('[IT] SUCCESS → rendering for', investor);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        padding: 8,
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        fontSize: 14,
        color: '#222',
      }}
    >
      <strong>
        {investor} {hasSL ? '(SL)' : ''}
      </strong>
      <br />
      <em style={{ color: '#64748b' }}>
        Series:{' '}
        {series.length > 0 ? series.join(', ') : 'No side-letter'}
      </em>
      <br />
      <span style={{ color: '#8884d8' }}>Gross Sub:</span>{' '}
      <span style={{ color: '#8884d8' }}>
        {currencyFormatter.format(sub)}
      </span>
      <br />
      <span style={{ color: '#EF4444' }}>Mgmt Fee:</span>{' '}
      <span style={{ color: '#EF4444' }}>
        {feePct.toFixed(2)}%
      </span>
    </div>
  );
};

const subDomain = useMemo<[number,number]>(() => {
  const max = Math.max(0, ...investorScatter.map(d => d.sub));
  return [0, niceCeil(max)];
}, [investorScatter]);

const feeDomain = useMemo<[number,number]>(() => {
  const allFees = investorScatter.map(d => d.feePct);
  const min = Math.min(...allFees);
  const max = Math.max(...allFees);
  // pad by 1 point each side:
  return [Math.floor(min) - 1, Math.ceil(max) + 1];
}, [investorScatter]);




// ── 1) helper: round up to a “nice” ceiling ──
function niceCeil(n: number): number {
  if (n >= 1_000_000) return Math.ceil(n / 1_000_000) * 1_000_000;
  if (n >=   1_000) return Math.ceil(n /   1_000) *   1_000;
  return Math.ceil(n /     100) *     100;
}

// ── 2) helper: round down to a “nice” floor ──
function niceFloor(n: number): number {
  if (n <= -1_000_000) return Math.floor(n / 1_000_000) * 1_000_000;
  if (n <=   -1_000) return Math.floor(n /   1_000) *   1_000;
  return Math.floor(n /     100) *     100;
}

// ── 3) derive domains ──
const paretoDomainLeft = useMemo<[number, number]>(() => {
  const max = Math.max(0, ...paretoData.map(d => d.amount));
  return [0, niceCeil(max)];
}, [paretoData]);

const waterfallDomain = useMemo<[number, number]>(() => {
  const vals = waterfallData.map(d => d.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  return [niceFloor(min), niceCeil(max)];
}, [waterfallData]);

const histDomain = useMemo<[number, number]>(() => {
  const max = Math.max(0, ...histData.map(d => d.count));
  return [0, niceCeil(max)];
}, [histData]);

const spvDomain = useMemo<[number, number]>(() => {
  const max = Math.max(0, ...top5SPV.map(d => d.value));
  return [0, niceCeil(max)];
}, [top5SPV]);

const classDomain = useMemo<[number, number]>(() => {
  const max = Math.max(0, ...classData.map(d => d.value));
  return [0, niceCeil(max)];
}, [classData]);

const classGrossDomain = useMemo<[number, number]>(() => {
  const max = Math.max(0, ...classDataGross.map(d => d.value));
  return [0, niceCeil(max)];
}, [classDataGross]);


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
  <h3>Top 5 SPVs by Gross Subscription</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart
      data={top5SPV}
      margin={{ top: 20, right: 20, bottom: 20, left: 80 }} // ← extra left margin for label
    >
      <CartesianGrid strokeDasharray="3 3" />

      <XAxis dataKey="name" />

<YAxis
  domain={spvDomain}
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


{/* 5) Net Subscription per Class */}
<section style={{ marginBottom: 32 }}>
  <h3>Net Subscription per Class</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart
      data={classData}
      margin={{ top: 20, right: 20, bottom: 20, left: 80 }}  // extra left for the label
    >
      <CartesianGrid strokeDasharray="3 3" />

      <XAxis dataKey="name" />

      <YAxis
        domain={classDomain}
        tickFormatter={value => compactFormatter.format(value)}
        label={{
          value: 'Net Subscription ($)',
          angle: -90,
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle' },
        }}
      />

      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />

      <Bar dataKey="value" fill="#FFBB28" />
    </BarChart>
  </ResponsiveContainer>
</section>

{/* 6) Gross Subscription per Class */}
<section style={{ marginBottom: 32 }}>
  <h3>Gross Subscription per Class</h3>
  <ResponsiveContainer width="100%" height={300}>
    <BarChart
      data={classDataGross}
      margin={{ top: 20, right: 20, bottom: 20, left: 80 }}  // extra left for the label
    >
      <CartesianGrid strokeDasharray="3 3" />

      <XAxis dataKey="name" />

      <YAxis
        domain={classGrossDomain}
        tickFormatter={value => compactFormatter.format(value)}
        label={{
          value: 'Net Subscription ($)',
          angle: -90,
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle' },
        }}
      />

      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />

      <Bar dataKey="value" fill="#32a852" />
    </BarChart>
  </ResponsiveContainer>
</section>

{/* 7) Investor-level mgmt-fee vs gross subscription */}
<section style={{ marginBottom: 32 }}>
  <h3>Investor Fee Breaks (per Investor)</h3>
  <ResponsiveContainer width="100%" height={360}>
    <ScatterChart
      margin={{ top: 20, right: 40, bottom: 40, left: 80 }}
    >
      <CartesianGrid strokeDasharray="3 3" />

      {/* X = Gross Subscription */}
      <XAxis
        type="number"
        dataKey="sub"
        domain={subDomain}
        tickFormatter={v => compactFormatter.format(v)}
        label={{
          value: 'Gross Subscription',
          position: 'insideBottom',
          offset: -40,
          style: { textAnchor: 'middle' },
        }}
      />

      {/* Y = Mgmt-Fee % */}
      <YAxis
        type="number"
        dataKey="feePct"
        domain={feeDomain}
        tickFormatter={v => `${v.toFixed(2)}%`}
        label={{
          value: 'Mgmt Fee (%)',
          angle: -90,
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle' },
        }}
      />

      <Tooltip
        content={<InvestorTooltip />}
        cursor={{ strokeDasharray: '3 3' }}
      />


      <Legend />

      {/* Standard vs Side-Letter */}
      <Scatter
        name="Standard Terms"
        data={investorScatter.filter(d => !d.hasSL)}
        fill="#94a3b8"
      />
      <Scatter
        name="With Side Letter"
        data={investorScatter.filter(d => d.hasSL)}
        fill="#4ade80"
      />
    </ScatterChart>
  </ResponsiveContainer>
</section>




    </div>
  );
}
