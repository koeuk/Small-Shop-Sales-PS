import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  DollarSign,
  Layers3,
  Plus,
  Sparkles,
  Sprout,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  Badge,
  Button,
  CardLink,
  Empty,
  ErrorState,
  Loading,
  Notice,
  PageHeading,
  RevenueChart,
} from "../components";
import { useAuth, useToast } from "../hooks";
import { useResource } from "../hooks";
import { day, money, number } from "../utils";

function Stat({ title, value, icon: Icon, children, highlight = false }) {
  return (
    <article className={`stat-card ${highlight ? "highlight" : ""}`}>
      <div className="stat-label">
        {title}
        <span className="stat-icon">
          <Icon size={18} strokeWidth={1.5} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-note">{children}</div>
    </article>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useResource("/dashboard");
  const { config, user } = useAuth();
  const notify = useToast();
  const [seeding, setSeeding] = useState(false);
  const [period, setPeriod] = useState(30);
  const seed = async () => {
    setSeeding(true);
    try {
      const result = await api("/demo/seed", { method: "POST" });
      notify(result.message);
      reload();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSeeding(false);
    }
  };
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  if (!data) return null;
  const forecast = data.forecast;
  const change = data.change_percent;
  const days = data.quality.observed_days;
  const ready = days >= 90 && data.quality.missing_days === 0;
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE PERSPECTIVE"
        title="Your shop, a little clearer."
        description="The story so far. A thoughtful look at what’s next."
      >
        <Link className="button secondary" to="/imports">
          <Upload size={16} />
          Import sales
        </Link>
        <Link className="button primary" to="/sales?new=1">
          <Plus size={17} />
          Add a sale
        </Link>
      </PageHeading>
      {!data.sales_count && config?.mode === "demo" && (
        <div className="welcome-banner">
          <div>
            <span className="welcome-icon">
              <Sprout size={25} />
            </span>
            <div>
              <strong>Let’s give your shop a little history.</strong>
              <p>
                Explore the full flow with 180 days of clearly labeled synthetic
                sales.
              </p>
            </div>
          </div>
          <Button busy={seeding} disabled={user.role !== "administrator"} onClick={seed}>
            Load sample data
            <ArrowUpRight size={17} />
          </Button>
        </div>
      )}
      {data.quality.synthetic && (
        <div className="dataset-label">
          <span className="status-dot amber-dot" />
          Synthetic demonstration data · Revenue and forecasts are for classroom
          demonstration.
        </div>
      )}
      <div className="stats-grid">
        <Stat
          title="Revenue · last 30 days"
          value={money(data.revenue_30d)}
          icon={DollarSign}
          highlight
        >
          {change !== null ? (
            <>
              <span className={`change ${change < 0 ? "negative" : ""}`}>
                {change >= 0 ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownLeft size={13} />
                )}
                {Math.abs(change).toFixed(1)}%
              </span>
              vs. previous 30 days
            </>
          ) : (
            "Your recorded revenue in USD"
          )}
        </Stat>
        <Stat
          title="Average daily revenue"
          value={money(data.average_daily)}
          icon={CalendarDays}
        >
          Revenue divided by 30 calendar days
        </Stat>
        <Stat
          title="Items sold · last 30 days"
          value={number(data.units_30d)}
          icon={Layers3}
        >
          {number(data.product_count)} active products in your shop
        </Stat>
        <Stat
          title="Next 7 days · forecast"
          value={forecast ? money(forecast.total) : "—"}
          icon={TrendingUp}
        >
          {forecast ? (
            <>
              <span className="tiny-dot" />
              {forecast.model_name}
            </>
          ) : (
            <Link to="/training">Train your first model ↗</Link>
          )}
        </Stat>
      </div>
      <div className="dashboard-grid">
        <section className="card revenue-card">
          <div className="card-header">
            <div>
              <h2>Every day tells a story.</h2>
              <p>Daily revenue, with a little foresight.</p>
            </div>
            <div className="segmented" aria-label="Chart period">
              {[30, 90].map((value) => (
                <button
                  key={value}
                  className={period === value ? "active" : ""}
                  onClick={() => setPeriod(value)}
                >
                  {value} days
                </button>
              ))}
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot" />
              Actual revenue
            </span>
            <span>
              <i className="legend-dash" />
              Forecast
            </span>
            <span className="legend-unit">USD</span>
          </div>
          <RevenueChart
            history={data.daily.slice(-period)}
            forecast={forecast?.predictions || []}
          />
          <div className="chart-footer">
            <span>
              <span className="status-dot" />
              {data.quality.start_date
                ? `${day(data.quality.start_date)} – ${day(data.quality.end_date, { year: "numeric" })}`
                : "Waiting for sales history"}
            </span>
            <CardLink to="/sales">View sales records</CardLink>
          </div>
        </section>
        <section className="forecast-card">
          <div className="forecast-card-top">
            <span className="forecast-symbol">
              <Sparkles size={21} strokeWidth={1.5} />
            </span>
            <Badge tone="light">A LOOK AHEAD</Badge>
          </div>
          <h2>
            A little foresight.
            <br />
            <em>A lot of possibility.</em>
          </h2>
          <p>
            {forecast
              ? "Your next seven days, estimated from the patterns in your sales."
              : "Turn your sales history into a thoughtful seven-day revenue forecast."}
          </p>
          <div className="forecast-amount">
            {forecast ? money(forecast.total) : "What comes next?"}
            <small>
              {forecast
                ? "estimated revenue · next 7 days"
                : "Start with 90 days of sales history"}
            </small>
          </div>
          {forecast && (
            <div className="mini-bars" aria-hidden="true">
              {forecast.predictions.map((item) => (
                <div key={item.date}>
                  <span
                    style={{
                      height: `${Math.max(8, (Number(item.revenue) / Math.max(...forecast.predictions.map((row) => Number(row.revenue)), 1)) * 65)}px`,
                    }}
                  />
                  <small>
                    {day(item.date, {
                      weekday: "narrow",
                      month: undefined,
                      day: undefined,
                    })}
                  </small>
                </div>
              ))}
            </div>
          )}
          <Link
            className="button cream"
            to={data.model ? "/predictions" : "/training"}
          >
            {data.model ? "Explore your forecast" : "Train your first model"}
            <ArrowUpRight size={16} />
          </Link>
          <small className="forecast-disclaimer">
            Estimates to guide you. Future revenue may vary.
          </small>
        </section>
        <section className="card">
          <div className="card-header">
            <div>
              <h2>The little bestsellers</h2>
              <p>Your top products over the last 30 days.</p>
            </div>
            <CardLink to="/products">All products</CardLink>
          </div>
          {data.top_products.length ? (
            <div className="bestsellers">
              {data.top_products.map((item, index) => (
                <div className="bestseller" key={item.name}>
                  <span className="product-rank">0{index + 1}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{number(item.quantity)} items sold</small>
                  </div>
                  <span className="product-revenue">{money(item.revenue)}</span>
                  <div className="product-track">
                    <span
                      style={{
                        width: `${(Number(item.revenue) / Number(data.top_products[0].revenue)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your bestsellers will appear here"
              description="Record your sales to see what your customers love."
            />
          )}
        </section>
        <section className="card health-card">
          <div className="card-header">
            <div>
              <h2>Good data. Better perspective.</h2>
              <p>A quick check on your forecasting foundation.</p>
            </div>
            <span className="health-icon">
              <Sprout size={23} />
            </span>
          </div>
          <div className="health-row">
            <span>Historical coverage</span>
            <strong>
              {number(days)} days{" "}
              <Badge tone={days >= 90 ? "green" : "amber"}>
                {days >= 90 ? "Ready" : "90 recommended"}
              </Badge>
            </strong>
          </div>
          <div className="coverage-track">
            <span style={{ width: `${Math.min((days / 90) * 100, 100)}%` }} />
          </div>
          <div className="health-row">
            <span>Missing calendar days</span>
            <strong>
              {data.quality.missing_days}
              {!data.quality.missing_days && <Check size={15} />}
            </strong>
          </div>
          <div className="health-row">
            <span>Latest model</span>
            <strong>
              {data.model ? (
                <Badge tone={data.model.stale ? "amber" : "green"}>
                  {data.model.stale
                    ? "Retraining needed"
                    : data.model.model_name}
                </Badge>
              ) : (
                "Not trained yet"
              )}
            </strong>
          </div>
          <div className="health-bottom">
            <span>
              {ready
                ? "Your history is ready for model training."
                : "Consistent daily records make a clearer forecast."}
            </span>
            <Link to="/training" aria-label="View model training">
              <ChevronRight size={20} />
            </Link>
          </div>
        </section>
      </div>
      {data.model?.stale && (
        <Notice>
          Sales changed after the latest model was trained. Retrain to use your
          updated history.
        </Notice>
      )}
    </>
  );
}
