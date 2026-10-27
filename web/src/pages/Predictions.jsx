import { useState } from "react";
import {
  ArrowUpRight,
  Download,
  History,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, downloadBlob } from "../api";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  Notice,
  PageHeading,
  RevenueChart,
} from "../components";
import { useToast } from "../hooks";
import { useResource } from "../hooks";
import { day, money, timestamp } from "../utils";

export default function Predictions() {
  const models = useResource("/ml/models");
  const history = useResource("/predictions");
  const [modelId, setModelId] = useState("");
  const [runId, setRunId] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const notify = useToast();
  if ((models.loading && !models.data) || (history.loading && !history.data))
    return <Loading />;
  if (models.error || history.error)
    return (
      <ErrorState
        message={models.error || history.error}
        retry={() => {
          models.reload();
          history.reload();
        }}
      />
    );
  const allModels = models.data || [];
  const latest = allModels.filter(
    (model) => model.metadata.batch_id === allModels[0]?.metadata.batch_id,
  );
  const model =
    allModels.find((item) => item.id === modelId) ||
    latest.find((item) => item.metadata.recommended) ||
    latest[0];
  const runs = history.data || [];
  const run = runs.find((item) => item.id === runId) || runs[0];
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("/predictions", {
        method: "POST",
        body: { model_id: model.id },
      });
      setRunId(result.id);
      history.reload();
      notify("Your seven-day forecast is ready and saved.");
    } catch (error) {
      setError(error.message);
      models.reload();
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(
        await api(`/predictions/${run.id}/export`, { raw: true }),
        `forecast-${run.id.slice(0, 8)}.csv`,
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE FORESIGHT"
        title="Make room for what’s next."
        description="Seven daily revenue estimates, grounded in your shop’s history."
      >
        {run && (
          <Button variant="secondary" busy={exporting} onClick={exportCsv}>
            <Download size={16} />
            Export CSV
          </Button>
        )}
      </PageHeading>
      <section className="card forecast-controls">
        <div>
          <label htmlFor="forecast-model">Your forecasting model</label>
          <select
            id="forecast-model"
            value={model?.id || ""}
            onChange={(event) => setModelId(event.target.value)}
            disabled={!allModels.length}
          >
            <option value="" disabled>
              Train a model first
            </option>
            {allModels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.model_name}
                {item.metadata.recommended ? " · recommended" : ""}
                {item.stale ? " · retrain needed" : ""} ·{" "}
                {timestamp(item.trained_at)}
              </option>
            ))}
          </select>
        </div>
        <Button busy={busy} disabled={!model || model.stale} onClick={generate}>
          <Sparkles size={17} />
          Generate 7-day forecast
        </Button>
      </section>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {model?.stale && (
        <Notice>
          Sales history has changed. <Link to="/training">Retrain models</Link>{" "}
          to include your latest data before forecasting.
        </Notice>
      )}
      {!allModels.length && (
        <Notice>
          Your history needs a trained model first.{" "}
          <Link to="/training">Go to model training</Link> to compare algorithms
          and save your first model.
        </Notice>
      )}
      {run ? (
        <>
          <div className="forecast-heading">
            <div>
              <Badge tone="green">
                <Sparkles size={12} />
                SEVEN DAYS AHEAD
              </Badge>
              <h2>A little glimpse of the week.</h2>
              <p>
                {day(run.predictions[0].date, { year: "numeric" })} –{" "}
                {day(run.predictions[6].date, { year: "numeric" })} · Generated{" "}
                {timestamp(run.created_at)}
              </p>
            </div>
            <div className="forecast-total">
              <span>Estimated 7-day revenue</span>
              <strong>{money(run.total)}</strong>
            </div>
          </div>
          {run.synthetic && (
            <div className="dataset-label">
              <span className="status-dot amber-dot" />
              This forecast was trained on synthetic demonstration data.
            </div>
          )}
          <section className="card">
            <div className="card-header">
              <div>
                <h2>The week, day by day.</h2>
                <p>
                  {run.model_name} · History through{" "}
                  {day(run.training_end_date, { year: "numeric" })}
                </p>
              </div>
              <Badge tone="neutral">Test MAE {money(run.mae)}</Badge>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-dash" />
                Predicted revenue
              </span>
              {run.predictions.some((item) => item.actual != null) && (
                <span>
                  <i className="legend-dot" />
                  Actual revenue
                </span>
              )}
            </div>
            <RevenueChart
              history={run.predictions
                .filter((item) => item.actual != null)
                .map((item) => ({ date: item.date, revenue: item.actual }))}
              forecast={run.predictions}
              height={255}
            />
            <div className="forecast-days">
              {run.predictions.map((item) => (
                <div className="forecast-day" key={item.date}>
                  <span>
                    {day(item.date, {
                      weekday: "short",
                      month: undefined,
                      day: undefined,
                    })}
                  </span>
                  <small>{day(item.date)}</small>
                  <strong>{money(item.revenue)}</strong>
                  {item.actual != null && (
                    <small>Actual {money(item.actual)}</small>
                  )}
                </div>
              ))}
            </div>
            <div className="forecast-note">
              <TrendingUp size={17} />
              <p>
                These are estimates, not guaranteed revenue. Forecasts use
                recursive predictions; negative outputs are set to zero. MAE
                measures average daily error on unseen historical test dates.
              </p>
            </div>
          </section>
        </>
      ) : (
        <section className="card">
          <Empty
            title="The next chapter is waiting."
            description="Choose a trained model and generate seven daily forecasts. Each run stays linked to its original model."
            icon={Sparkles}
          >
            {!model && (
              <Link className="button secondary" to="/training">
                Train your first model
                <ArrowUpRight size={16} />
              </Link>
            )}
          </Empty>
        </section>
      )}
      <section className="card table-card">
        <div className="card-header">
          <div>
            <h2>Your previous looks ahead</h2>
            <p>
              Saved forecast runs retain their original model and timestamp.
            </p>
          </div>
          <History size={21} className="muted" />
        </div>
        {runs.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>CREATED</th>
                  <th>FORECAST PERIOD</th>
                  <th>MODEL</th>
                  <th>ESTIMATED TOTAL</th>
                  <th>VIEW</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((item) => (
                  <tr
                    key={item.id}
                    className={run?.id === item.id ? "selected-row" : ""}
                  >
                    <td>{timestamp(item.created_at)}</td>
                    <td>
                      {day(item.predictions[0].date)} –{" "}
                      {day(item.predictions[6].date)}
                    </td>
                    <td>{item.model_name}</td>
                    <td className="tabular">
                      <strong>{money(item.total)}</strong>
                    </td>
                    <td>
                      <button
                        className="inline-button"
                        onClick={() => setRunId(item.id)}
                      >
                        {run?.id === item.id ? "Viewing" : "View forecast"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No saved forecasts yet"
            description="Your next seven-day forecast will appear here."
            icon={History}
          />
        )}
      </section>
    </>
  );
}
