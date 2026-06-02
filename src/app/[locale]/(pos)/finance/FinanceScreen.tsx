'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AED, AED0 } from '@/lib/format';
import { useToast } from '@/components/Toast';

type Tab = 'dashboard' | 'actuals' | 'unit' | 'vision' | 'owners';
type Scenario = 'worst' | 'average' | 'dream';

// ─── Static FIN data (mirrors design/POS/finance.js) ───────────────────────
const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'] as const;
const r12 = (v: number): number[] => Array(12).fill(v);

const PLAN: Record<string, number[]> = {
  Rent: [0, 0, 0, 0, 0, 50000, 0, 0, 0, 0, 0, 0],
  Internet: r12(1100),
  Phones: r12(300),
  DEWA: [1500, 1500, 1500, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400, 2400],
  Supplies: r12(1500),
  'Manager Salary': r12(3300),
  'Driver Salary': r12(3200),
  Washer: r12(1700),
  Presser: r12(1700),
  Accommodation: r12(2600),
  Bonus: [0, 50, 150, 200, 300, 300, 400, 400, 450, 450, 510, 510],
  'Car Maintenance': r12(500),
  'Car Gas': [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1800, 1800, 1800],
  'Clean Cloud': r12(1270),
  Marketing: r12(517.96),
  Ads: [273, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000],
  'Pest control': [789, 0, 0, 0, 0, 0, 0, 789, 0, 0, 0, 0],
  'Bank Account': r12(250),
};
const LINES = Object.keys(PLAN);
const planTotalForMonth = (m: number): number => LINES.reduce((s, l) => s + PLAN[l][m], 0);

// variable fractions (mirrors design cfg.varFrac)
const VAR_FRAC: Record<string, number> = Object.fromEntries(LINES.map((l) => [l, 0]));
VAR_FRAC['DEWA'] = 0.6;
VAR_FRAC['Supplies'] = 1;
VAR_FRAC['Bonus'] = 1;
VAR_FRAC['Car Gas'] = 1;

const SC: Record<Scenario, { income: number[]; orders: number[]; customers: number[] }> = {
  worst: {
    income: [0, 1000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
    orders: [0, 10, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
    customers: [0, 5, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25],
  },
  average: {
    income: [0, 5000, 15000, 20000, 30000, 30000, 40000, 40000, 45000, 45000, 51000, 51000],
    orders: [0, 50, 150, 200, 300, 300, 400, 400, 450, 450, 510, 510],
    customers: [0, 25, 75, 100, 150, 150, 200, 200, 225, 225, 255, 255],
  },
  dream: {
    income: [0, 5000, 15000, 20000, 30000, 30000, 40000, 50000, 60000, 70000, 80000, 80000],
    orders: [0, 50, 150, 200, 300, 300, 400, 500, 600, 700, 800, 800],
    customers: [0, 25, 75, 100, 150, 150, 200, 250, 300, 350, 400, 400],
  },
};
const scProfit = (s: Scenario, m: number): number => SC[s].income[m] - planTotalForMonth(m);

const OWNERS = ['Kishore', 'Hamdan', 'Quentin', 'Aamir'] as const;

interface Contribution {
  date: string;
  owner: string;
  amount: number;
  note: string;
}
const INITIAL_CONTRIBUTIONS: Contribution[] = [
  { date: '2026-05-30', owner: 'Quentin', amount: 170000, note: 'Fund' },
  { date: '2026-05-30', owner: 'Kishore', amount: 32842.32, note: 'Fund' },
  { date: '2026-05-30', owner: 'Hamdan', amount: 5708.37, note: 'Fund' },
  { date: '2026-05-30', owner: 'Aamir', amount: 176092, note: 'Fund' },
];

const SETTINGS = {
  company: 'Thawb Wa Teeb',
  currency: 'AED — UAE Dirham',
  startMonth: 'May 2026',
  stripePct: 0.029,
  stripeFlat: 1,
  hireThreshold: 0.85,
};

// ─── Per-month actuals (editable) ──────────────────────────────────────────
interface MonthActual {
  income: number;
  orders: number;
  customers: number;
  cardVol: number;
  cardTx: number;
  capacity: number;
  exp: Record<string, number>;
}
const buildInitialActuals = (): MonthActual[] => {
  const arr = MONTHS.map((_, m) => ({
    income: 0,
    orders: 0,
    customers: 0,
    cardVol: 0,
    cardTx: 0,
    capacity: 0,
    exp: Object.fromEntries(LINES.map((l) => [l, PLAN[l][m]])) as Record<string, number>,
  }));
  arr[0].income = 10000;
  arr[0].orders = 100;
  arr[0].customers = 100;
  return arr;
};

const N = (n: number): string => Math.round(n).toLocaleString('en-US');

// ─── Component ─────────────────────────────────────────────────────────────
export default function FinanceScreen() {
  const t = useTranslations('Finance');
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [scenario, setScenario] = useState<Scenario>('average');
  const [month, setMonth] = useState<number>(0);
  const [actuals, setActuals] = useState<MonthActual[]>(buildInitialActuals);
  const [contributions, setContributions] = useState<Contribution[]>(INITIAL_CONTRIBUTIONS);

  const months: string[] = MONTHS.slice();
  const sc = SC[scenario];

  // Derived totals
  const totalInvested = useMemo(
    () => contributions.reduce((s, c) => s + c.amount, 0),
    [contributions],
  );
  const investedBy = (o: string): number =>
    contributions.filter((c) => c.owner === o).reduce((s, c) => s + c.amount, 0);

  // ─── Update helpers (for Actuals tab) ─────────────────────────────────
  const updateActual = (m: number, key: keyof Omit<MonthActual, 'exp'>, value: number): void => {
    setActuals((prev) => {
      const next = prev.slice();
      next[m] = { ...next[m], [key]: value };
      return next;
    });
  };
  const updateExpense = (m: number, line: string, value: number): void => {
    setActuals((prev) => {
      const next = prev.slice();
      next[m] = { ...next[m], exp: { ...next[m].exp, [line]: value } };
      return next;
    });
  };

  /* Design finance.js:279-286 — outer is settings-grid.fin with a left
     sidebar (.set-side) containing .sh + .set-nav and a body (.set-body)
     where the active tab renders. There is NO page-head, no top mtabs;
     the scenario selector lives inside the Dashboard tab only. */
  const TAB_ICONS: Record<Tab, React.ReactNode> = {
    dashboard: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>),
    actuals: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 9v11" /></svg>),
    unit: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5a3 3 0 0 1 6 0M9 14.5a3 3 0 0 0 6 0" /></svg>),
    vision: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>),
    owners: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20c0-2.6-1.5-4.5-3.8-5.2" /></svg>),
  };

  return (
    <div className="settings-grid fin">
      <div className="set-side">
        <div className="sh">{t('sidebarHeading')}</div>
        <div className="set-nav" id="fin-nav">
          {(['dashboard', 'actuals', 'unit', 'vision', 'owners'] as Tab[]).map((tt) => (
            <button key={tt} className={tt === tab ? 'on' : ''} data-tab={tt} onClick={() => setTab(tt)}>
              {TAB_ICONS[tt]}
              {t(`tabs.${tt}` as 'tabs.dashboard')}
            </button>
          ))}
        </div>
      </div>

      <div className="set-body" id="fin-body">
        {tab === 'dashboard' && (
          <Dashboard
            months={months}
            scenario={scenario}
            sc={sc}
            actuals={actuals}
            contributions={contributions}
            totalInvested={totalInvested}
            setScenario={setScenario}
          />
        )}

        {tab === 'actuals' && (
          <Actuals
            month={month}
            setMonth={setMonth}
            actuals={actuals}
            updateActual={updateActual}
            updateExpense={updateExpense}
            onSave={(m) => toast.show(t('actuals.savedMonth', { month: MONTHS[m] }))}
          />
        )}

        {tab === 'unit' && (
          <Unit month={month} setMonth={setMonth} actuals={actuals} />
        )}

        {tab === 'vision' && <Vision />}

        {tab === 'owners' && (
          <Owners
            contributions={contributions}
            setContributions={setContributions}
            totalInvested={totalInvested}
            investedBy={investedBy}
            onAdded={() => toast.show(t('owners.added'))}
            onMissingAmount={() => toast.show(t('owners.enterAmount'))}
          />
        )}
      </div>
    </div>
  );
}

// ─── Dashboard tab (matches design renderDashboard) ──────────────────────
function Dashboard({
  months,
  scenario,
  sc,
  actuals,
  contributions,
  totalInvested,
  setScenario,
}: {
  months: string[];
  scenario: Scenario;
  sc: { income: number[]; orders: number[]; customers: number[] };
  actuals: MonthActual[];
  contributions: Contribution[];
  totalInvested: number;
  setScenario: (s: Scenario) => void;
}) {
  const t = useTranslations('Finance');

  const hasActual = (m: number): boolean =>
    !!(actuals[m].income || actuals[m].orders || actuals[m].customers);
  const actualProfit = (m: number): number => {
    const a = actuals[m];
    const exp = LINES.reduce((s, l) => s + (+a.exp[l] || 0), 0);
    return (+a.income || 0) - exp;
  };

  const planProfitArr = months.map((_, m) => scProfit('average', m));
  const planCum = useMemo(() => {
    let acc = totalInvested;
    return planProfitArr.map((p) => (acc += p));
  }, [planProfitArr, totalInvested]);

  const actCum = useMemo<(number | null)[]>(() => {
    let acc = totalInvested;
    return months.map((_, m) => {
      if (!hasActual(m)) return null;
      acc += actualProfit(m);
      return acc;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actuals, totalInvested, months.length]);

  const incomeAvg = sc.income;
  const expenses = months.map((_, m) => planTotalForMonth(m));
  const lastActual = actCum.filter((v): v is number => v != null).slice(-1)[0] ?? totalInvested;
  const cap = totalInvested;

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="k">{t('kpis.cashInBank')}</div>
          <div className="v">{AED0(lastActual)}</div>
          <div className="d">{t('kpis.cashInBankSub', { capital: AED0(cap) })}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('kpis.capitalInvested')}</div>
          <div className="v">{AED0(cap)}</div>
          <div className="d">{t('kpis.contributionsCount', { count: contributions.length })}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('kpis.planCashEoy')}</div>
          <div className="v">{AED0(planCum[11])}</div>
          <div className="d">{t('kpis.averageScenario')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('kpis.monthlyBurn')}</div>
          <div className="v">{AED0(planTotalForMonth(0))}</div>
          <div className="d">{t('kpis.monthlyBurnSub')}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{t('dashboard.cumulativeBank')}</h3>
        <div className="csub">{t('dashboard.cumulativeBankSub')}</div>
        <LineChart
          labels={months}
          series={[
            { name: t('dashboard.planAvg'), color: '#2A4858', data: planCum },
            { name: t('dashboard.actual'), color: '#16A34A', data: actCum },
          ]}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>
            {t('dashboard.scenarioProjections')}
          </div>
          <div className="sub muted" style={{ fontSize: 12.5 }}>
            {t('dashboard.scenarioProjectionsSub')}
          </div>
        </div>
        <div className="seg">
          {/* Design finance.js:134 — button label is the raw lowercase scenario
              key ('worst'/'average'/'dream'); active class is 'on \${s}'. */}
          {(['worst', 'average', 'dream'] as Scenario[]).map((s) => (
            <button
              key={s}
              className={s === scenario ? `on ${s}` : ''}
              data-sc={s}
              onClick={() => setScenario(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>{t('dashboard.incomeVsExpense')}</h3>
          {/* Design finance.js:137 — csub is `${state.scenario} scenario`, with
              state.scenario lowercase ('worst' | 'average' | 'dream'). */}
          <div className="csub">{t('dashboard.incomeVsExpenseSub', { scenario })}</div>
          <BarPairChart
            labels={months}
            a={{ name: t('dashboard.income'), color: '#2A4858', data: incomeAvg }}
            b={{ name: t('dashboard.expenses'), color: '#DC2626', data: expenses }}
          />
        </div>
        <div className="card">
          <h3>{t('dashboard.ordersCustomers')}</h3>
          <div className="csub">{t('dashboard.ordersCustomersSub', { scenario })}</div>
          <BarPairChart
            labels={months}
            a={{ name: t('dashboard.orders'), color: '#2A4858', data: sc.orders }}
            b={{ name: t('dashboard.customers'), color: '#16A34A', data: sc.customers }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Actuals tab (editable, matches design renderActuals) ────────────────
function Actuals({
  month,
  setMonth,
  actuals,
  updateActual,
  updateExpense,
  onSave,
}: {
  month: number;
  setMonth: (m: number) => void;
  actuals: MonthActual[];
  updateActual: (m: number, key: keyof Omit<MonthActual, 'exp'>, value: number) => void;
  updateExpense: (m: number, line: string, value: number) => void;
  onSave: (m: number) => void;
}) {
  const t = useTranslations('Finance');
  const a = actuals[month];

  /* Design finance.js:148-150 — inputRow card with data-a attribute on the
     input matching the actuals field key. No explicit width on the input. */
  const inputCard = (label: string, key: keyof Omit<MonthActual, 'exp'>, hint: string) => (
    <div className="card" style={{ padding: 16 }}>
      <div
        className="k"
        style={{
          fontSize: 10.5,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--faint)',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <input
        className="inp"
        style={{ marginTop: 8, fontSize: 20, fontWeight: 700, border: 'none', padding: 0 }}
        type="number"
        data-a={key}
        value={a[key]}
        onChange={(e) => updateActual(month, key, +e.target.value || 0)}
      />
      <div className="d" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        {hint}
      </div>
    </div>
  );

  const monthTotal = LINES.reduce((s, l) => s + (+a.exp[l] || 0), 0);
  const monthPlan = planTotalForMonth(month);

  return (
    <>
      {/* Design finance.js:152 — month buttons carry data-m='\${i}'. */}
      <div className="mtabs">
        {MONTHS.map((mo, i) => (
          <button key={mo} className={i === month ? 'on' : ''} data-m={i} onClick={() => setMonth(i)}>
            {mo}
          </button>
        ))}
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        {inputCard(t('actuals.realIncome'), 'income', t('actuals.planHint', { value: N(SC.average.income[month]) }))}
        {inputCard(t('actuals.realOrders'), 'orders', t('actuals.planHint', { value: N(SC.average.orders[month]) }))}
        {inputCard(t('actuals.realCustomers'), 'customers', t('actuals.planHint', { value: N(SC.average.customers[month]) }))}
        {inputCard(t('actuals.cardVolume'), 'cardVol', t('actuals.cardHint'))}
        {inputCard(t('actuals.cardTransactions'), 'cardTx', t('actuals.cardHint'))}
        {inputCard(t('actuals.teamCapacity'), 'capacity', t('actuals.capacityHint'))}
      </div>

      <div className="card flush">
        <div className="ch">
          <h3 style={{ margin: 0 }}>{t('actuals.expensesHeading', { month: MONTHS[month] })}</h3>
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('actuals.expenseLine')}</th>
                <th className="num">{t('actuals.plan')}</th>
                <th className="num">{t('actuals.actual')}</th>
                <th className="num">{t('actuals.variance')}</th>
              </tr>
            </thead>
            <tbody>
              {LINES.map((l) => {
                const plan = PLAN[l][month];
                const act = +a.exp[l] || 0;
                const vr = act - plan;
                const vrClass = vr > 0 ? 'neg' : vr < 0 ? 'pos' : 'muted';
                return (
                  <tr key={l}>
                    <td className="ln">{l}</td>
                    <td className="num tnum muted">{AED(plan)}</td>
                    <td className="num">
                      <input
                        className="inp r tnum"
                        style={{ width: 120, marginLeft: 'auto' }}
                        type="number"
                        data-exp={l}
                        value={a.exp[l]}
                        onChange={(e) => updateExpense(month, l, +e.target.value || 0)}
                      />
                    </td>
                    <td className={`num tnum ${vrClass}`}>
                      {vr > 0 ? '+' : ''}
                      {AED(vr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('actuals.totalRow')}</td>
                <td className="num tnum">{AED(monthPlan)}</td>
                <td className="num tnum">{AED(monthTotal)}</td>
                <td className="num tnum">{AED(monthTotal - monthPlan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-pri" id="save-act" onClick={() => onSave(month)}>
          {t('actuals.saveMonth', { month: MONTHS[month] })}
        </button>
      </div>
    </>
  );
}

// ─── Unit Economics tab (matches design renderUnit) ──────────────────────
function Unit({
  month,
  setMonth,
  actuals,
}: {
  month: number;
  setMonth: (m: number) => void;
  actuals: MonthActual[];
}) {
  const t = useTranslations('Finance');
  const a = actuals[month];

  const orders = +a.orders || 0;
  const customers = +a.customers || 0;
  const basket = orders ? a.income / orders : 0;
  const stripeFee = (+a.cardVol || 0) * SETTINGS.stripePct + (+a.cardTx || 0) * SETTINGS.stripeFlat;
  const varLines: [string, number][] = LINES
    .filter((l) => VAR_FRAC[l] > 0)
    .map((l) => [l, (+a.exp[l] || 0) * VAR_FRAC[l]]);
  const varTotalRaw = varLines.reduce((s, x) => s + x[1], 0) + stripeFee;
  const varPerOrder = orders ? varTotalRaw / orders : 0;
  const contrib = basket - varPerOrder;
  const totalExp = LINES.reduce((s, l) => s + (+a.exp[l] || 0), 0);
  const fixed = totalExp - varLines.reduce((s, x) => s + x[1], 0) - stripeFee;
  const fullyLoaded = orders ? (totalExp + stripeFee) / orders : 0;
  const breakeven: string = contrib > 0 ? Math.ceil(fixed / contrib).toLocaleString('en-US') : '—';
  const util: string = +a.capacity ? `${Math.round((orders / a.capacity) * 100)}%` : '—';
  const cac = customers
    ? ((+a.exp['Ads'] || 0) + (+a.exp['Marketing'] || 0)) / customers
    : 0;

  return (
    <>
      <div className="mtabs">
        {MONTHS.map((mo, i) => (
          <button key={mo} className={i === month ? 'on' : ''} onClick={() => setMonth(i)}>
            {mo}
          </button>
        ))}
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="k">{t('unit.basket')}</div>
          <div className="v">{AED(basket)}</div>
          <div className="d">{t('unit.basketSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.varCostPerOrder')}</div>
          <div className="v">{AED(varPerOrder)}</div>
          <div className="d">{t('unit.varCostPerOrderSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.contribMargin')}</div>
          <div className={`v ${contrib >= 0 ? 'pos' : 'neg'}`}>{AED(contrib)}</div>
          <div className="d">{t('unit.contribMarginSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.fullyLoaded')}</div>
          <div className="v">{AED(fullyLoaded)}</div>
          <div className="d">{t('unit.fullyLoadedSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.breakeven')}</div>
          <div className="v">{breakeven}</div>
          <div className="d">{t('unit.breakevenSub')}</div>
        </div>
        <div className="card kpi">
          <div className="k">{t('unit.utilization')}</div>
          <div className="v">{util}</div>
          <div className="d">{+a.capacity ? t('unit.utilizationSub') : t('unit.utilizationNoCap')}</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card flush">
          <div className="ch">
            <h3 style={{ margin: 0 }}>{t('unit.varBreakdown')}</h3>
            <div className="csub" style={{ margin: '2px 0 0' }}>
              {MONTHS[month]} 2026
            </div>
          </div>
          <table className="tbl">
            <tbody>
              {varLines.map(([l, v]) => (
                <tr key={l}>
                  <td>
                    {l}
                    {VAR_FRAC[l] < 1 ? ` (${Math.round(VAR_FRAC[l] * 100)}%)` : ''}
                  </td>
                  <td className="num tnum">{AED(v)}</td>
                </tr>
              ))}
              <tr>
                <td>{t('unit.stripeFeeRow')}</td>
                <td className="num tnum">{AED(stripeFee)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>{t('unit.varTotalPerOrders', { orders: orders || 0 })}</td>
                <td className="num tnum">{t('unit.perOrder', { value: AED(varPerOrder) })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="card">
          <h3>{t('unit.cacTitle')}</h3>
          <div className="csub">{t('unit.cacSubLine')}</div>
          <div className="big">{AED(cac)}</div>
          <div className="warnbox" style={{ marginTop: 14 }}>
            {t('unit.cacWarning')}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Vision tab (planTable + 3 scenarioTables) ──────────────────────────
function Vision() {
  const t = useTranslations('Finance');

  return (
    <>
      <div className="note" style={{ marginBottom: 14 }}>
        {t('vision.note')}
      </div>

      <div className="card flush" style={{ marginBottom: 16 }}>
        <div className="ch">
          <h3 style={{ margin: 0 }}>{t('vision.plannedExpenses')}</h3>
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('vision.line')}</th>
                {MONTHS.map((m) => (
                  <th key={m} className="num">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINES.map((l) => (
                <tr key={l}>
                  <td className="ln">{l}</td>
                  {PLAN[l].map((v, i) => (
                    <td key={i} className="num tnum">
                      {N(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('vision.totalExpense')}</td>
                {MONTHS.map((_, m) => (
                  <td key={m} className="num tnum">
                    {N(planTotalForMonth(m))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ScenarioTable scenario="worst" />
      <ScenarioTable scenario="average" />
      <ScenarioTable scenario="dream" />
    </>
  );
}

function ScenarioTable({ scenario }: { scenario: Scenario }) {
  const t = useTranslations('Finance');
  const data = SC[scenario];
  const col = scenario === 'worst' ? 'bad' : scenario === 'dream' ? 'ok' : 'mut';

  return (
    <div className="card flush" style={{ marginBottom: 16 }}>
      <div className="ch" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0 }}>{t('vision.scenario')}</h3>
        {/* Design finance.js:229 — pill text is the raw lowercase scenario key. */}
        <span className={`pill ${col}`}>{scenario}</span>
      </div>
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('vision.metric')}</th>
              {MONTHS.map((m) => (
                <th key={m} className="num">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="ln">{t('vision.income')}</td>
              {data.income.map((v, i) => (
                <td key={i} className="num tnum">
                  {N(v)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="ln">{t('vision.orders')}</td>
              {data.orders.map((v, i) => (
                <td key={i} className="num tnum">
                  {N(v)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="ln">{t('vision.customers')}</td>
              {data.customers.map((v, i) => (
                <td key={i} className="num tnum">
                  {N(v)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="ln">{t('vision.profit')}</td>
              {MONTHS.map((_, m) => {
                const p = scProfit(scenario, m);
                return (
                  <td key={m} className="num tnum">
                    <span className={p >= 0 ? 'pos' : 'neg'}>
                      {p < 0 ? '-' : ''}
                      {AED0(Math.abs(p))}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Owners tab (per-owner KPI cards + editable contributions) ─────────
function Owners({
  contributions,
  setContributions,
  totalInvested,
  investedBy,
  onAdded,
  onMissingAmount,
}: {
  contributions: Contribution[];
  setContributions: (cs: Contribution[]) => void;
  totalInvested: number;
  investedBy: (o: string) => number;
  onAdded: () => void;
  onMissingAmount: () => void;
}) {
  const t = useTranslations('Finance');
  const [owner, setOwner] = useState<string>(OWNERS[0]);
  const [date, setDate] = useState<string>('2026-05-31');
  const [amount, setAmount] = useState<string>('');
  const [noteInp, setNoteInp] = useState<string>('');

  const handleAdd = (): void => {
    const amt = parseFloat(amount);
    if (!amt) {
      onMissingAmount();
      return;
    }
    setContributions([
      { date: date || '2026-05-31', owner, amount: amt, note: noteInp },
      ...contributions,
    ]);
    setAmount('');
    setNoteInp('');
    onAdded();
  };

  const handleDelete = (idx: number): void => {
    setContributions(contributions.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {OWNERS.map((o) => (
          <div key={o} className="card kpi">
            <div className="k">{o}</div>
            <div className="v">
              <small>AED</small> {N(investedBy(o))}
            </div>
            <div className="d">{t('owners.investedLabel')}</div>
          </div>
        ))}
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>{t('owners.addTitle')}</h3>
          <div className="csub">{t('owners.addSub')}</div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>{t('owners.owner')}</label>
            <select className="inp" id="c-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="grid g2" style={{ gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>{t('owners.date')}</label>
              <input className="inp" id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('owners.amountAed')}</label>
              <input
                className="inp"
                id="c-amt"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>{t('owners.noteOptional')}</label>
            <input
              className="inp"
              id="c-note"
              placeholder={t('owners.notePlaceholder')}
              value={noteInp}
              onChange={(e) => setNoteInp(e.target.value)}
            />
          </div>
          <button className="btn btn-pri" id="c-add" onClick={handleAdd}>
            {t('owners.addBtn')}
          </button>
        </div>

        <div className="card flush">
          <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{t('owners.contributions')}</h3>
            <span className="pill mut">{t('owners.totalPill', { value: AED0(totalInvested) })}</span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('owners.date')}</th>
                <th>{t('owners.owner')}</th>
                <th className="num">{t('owners.amount')}</th>
                <th>{t('owners.note')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, i) => (
                <tr key={`${c.date}-${c.owner}-${i}`}>
                  <td className="tnum">{c.date}</td>
                  <td className="ln">{c.owner}</td>
                  <td className="num tnum">{AED(c.amount)}</td>
                  <td className="muted">{c.note || '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" data-del={i} onClick={() => handleDelete(i)}>
                      {t('owners.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Charts ─────────────────────────────────────────────────────────────

function LineChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; color: string; data: (number | null)[] }[];
}) {
  /* Design finance.js:76-93 — exact geometry & styling:
     W=760, H=230, pad={l:54, r:12, t:14, b:26}.
     - mn = Math.min(0, ...all) (clamps floor to ≤ 0)
     - grid stroke = var(--border-2), text font-size 9 fill var(--faint),
       format = Math.round(v/1000)+'k'
     - x-labels at y=H-8, font-size 9 fill var(--faint)
     - zero line (only if mn<0) at y(0) stroke var(--border) width 1.2
     - path stroke-width 2, stroke-linejoin round, fill none
     - .legend uses <i> color swatches styled by .fin .legend CSS */
  const W = 760, H = 230;
  const pad = { l: 54, r: 12, t: 14, b: 26 };
  const all = series.flatMap((s) => s.data.filter((v): v is number => v != null));
  const mn = Math.min(0, ...all);
  const mx = Math.max(...all, 1);
  const rng = (mx - mn) || 1;
  const xAt = (i: number) => pad.l + (W - pad.l - pad.r) * (i / Math.max(1, labels.length - 1));
  const yAt = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - mn) / rng);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        {[0, 0.25, 0.5, 0.75, 1].map((tt, i) => {
          const v = mn + rng * tt;
          const y = yAt(v);
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--border-2)" />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--faint)">
                {Math.round(v / 1000)}k
              </text>
            </g>
          );
        })}
        {mn < 0 && (
          <line x1={pad.l} x2={W - pad.r} y1={yAt(0)} y2={yAt(0)} stroke="var(--border)" strokeWidth={1.2} />
        )}
        {series.map((s, si) => {
          let d = '';
          let started = false;
          const dots: React.ReactNode[] = [];
          s.data.forEach((v, i) => {
            if (v == null) return;
            const px = xAt(i);
            const py = yAt(v);
            d += (started ? 'L' : 'M') + ' ' + px + ' ' + py + ' ';
            started = true;
            dots.push(<circle key={i} cx={px} cy={py} r={2.6} fill={s.color} />);
          });
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {dots}
            </g>
          );
        })}
        {labels.map((m, i) => (
          <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--faint)">
            {m}
          </text>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </>
  );
}

function BarPairChart({
  labels,
  a,
  b,
}: {
  labels: string[];
  a: { name: string; color: string; data: number[] };
  b: { name: string; color: string; data: number[] };
}) {
  const W = 760,
    H = 230,
    pad = { l: 48, r: 12, t: 14, b: 26 };
  const mx = Math.max(...a.data, ...b.data, 1);
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / labels.length;
  const bw = (W - pad.l - pad.r) / labels.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / mx);
  const h = (v: number) => (H - pad.t - pad.b) * (v / mx);

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.5, 1].map((p, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y(mx * p)} x2={W - pad.r} y2={y(mx * p)} stroke="var(--border-2)" />
            <text x={pad.l - 8} y={y(mx * p) + 3} textAnchor="end" fontSize="9" fill="var(--faint)">
              {Math.round((mx * p) / 1000)}k
            </text>
          </g>
        ))}
        {labels.map((m, i) => {
          const cx = x(i) + bw * 0.18;
          const w = bw * 0.28;
          return (
            <g key={i}>
              <rect x={cx} y={y(a.data[i])} width={w} height={h(a.data[i])} rx="2" fill={a.color} />
              <rect x={cx + w + 2} y={y(b.data[i])} width={w} height={h(b.data[i])} rx="2" fill={b.color} />
              <text x={x(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--faint)">
                {m}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: a.color }} /> {a.name}
        </span>
        <span>
          <i style={{ background: b.color }} /> {b.name}
        </span>
      </div>
    </>
  );
}
