import { useState } from "react";
import {
  ArrowRight,
  Check,
  FlaskConical,
  History,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
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
import { useAuth, useToast } from "../hooks";
import { useResource } from "../hooks";
import { day, money, number, timestamp } from "../utils";

export default function Training() {
  const { user } = useAuth();
  const isAdministrator = user.role === "administrator";
  const dataset = useResource("/ml/dataset");
  const models = useResource("/ml/models");
  const [busy, setBusy] = useState(false);
  const [confirmZero, setConfirmZero] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const notify = useToast();
  const train = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("/ml/train", {
        method: "POST",
        body: {
          missing_policy: confirmZero ? "zero" : "reject",
          confirm_complete: confirmZero,
        },
      });
      setSelectedId(
        result.models.find((model) => model.metadata.recommended).id,
      );
      models.reload();
      dataset.reload();
      notify(
        "Four models trained and evaluated. Your recommendation is ready.",
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  if ((dataset.loading && !dataset.data) || (models.loading && !models.data))
    return <Loading />;
  if (dataset.error || models.error)
    return (
      <ErrorState
        message={dataset.error || models.error}
        retry={() => {
          dataset.reload();
          models.reload();
        }}
      />
    );
  const quality = dataset.data;
  const all = models.data || [];
  const latest = all.filter(
    (model) => model.metadata.batch_id === all[0]?.metadata.batch_id,
  );
  const selected =
    all.find((model) => model.id === selectedId) ||
    latest.find((model) => model.metadata.recommended) ||
    latest[0];
  const enough = quality?.calendar_days >= 90 && quality?.observed_days >= 60;
  const points = selected?.metadata.test_points || [];
  const splits = selected?.metadata.splits;
  return (
    <>
      <PageHeading
        eyebrow="LEARN FROM A LITTLE HISTORY"
        title="Find the patterns. Look ahead."
        description="Compare four models. Choose with evidence. Keep every version."
      >
        <Button
          busy={busy}
          disabled={!isAdministrator || !enough || (quality.missing_days > 0 && !confirmZero)}
          onClick={train}
        >
          <Play size={16} />
          {busy
            ? "Training your models…"
            : all.length
              ? "Retrain models"
              : "Train models"}
        </Button>
      </PageHeading>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <Notice tone="green">
          Training and evaluating four models on chronological splits. This may
          take a few seconds. Keep this page open.
        </Notice>
      )}
      {quality?.synthetic && (
        <div className="dataset-label">
          <span className="status-dot amber-dot" />
          Synthetic classroom dataset · Metrics describe this sample data, not
          real-world performance.
        </div>
      )}
      <section className="card dataset-card">
        <div className="card-header">
          <div>
            <h2>Your forecasting foundation</h2>
            <p>{quality?.note}</p>
          </div>
          <Badge tone={enough ? "green" : "amber"}>
            {enough ? "Enough history" : "More history needed"}
          </Badge>
        </div>
        <div className="dataset-stats">
          <div>
            <span>Observed sales days</span>
            <strong>
              {number(quality?.observed_days)}
              <small>days</small>
            </strong>
          </div>
          <div>
            <span>Historical coverage</span>
            <strong className="date-coverage">
              {quality?.start_date
                ? `${day(quality.start_date)} – ${day(quality.end_date, { year: "numeric" })}`
                : "No data yet"}
            </strong>
          </div>
          <div>
            <span>Missing calendar days</span>
            <strong>
              {number(quality?.missing_days)}
              <small>days</small>
            </strong>
          </div>
          <div>
            <span>Currency & target</span>
            <strong className="date-coverage">USD · Daily revenue</strong>
          </div>
        </div>
        {!enough && (
          <Notice>
            Start with 90 calendar days and at least 60 observed sales days.{" "}
            <Link to="/imports">Import more history</Link> or load sample data
            from the overview.
          </Notice>
        )}
        {quality?.missing_days > 0 && (
          <div className="missing-policy">
            <Notice>
              Some calendar dates have no records:{" "}
              {quality.missing_dates.slice(0, 8).join(", ")}
              {quality.missing_days > 8 ? "…" : ""}. Missing records are not
              automatically treated as zero.
            </Notice>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmZero}
                onChange={(event) => setConfirmZero(event.target.checked)}
              />
              I confirm these were operating days with complete records and zero
              revenue. Fill missing dates with zero.
            </label>
          </div>
        )}
      </section>
      <div className="training-explainer">
        <span className="explainer-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>A fair comparison, in the right order.</strong>
          <p>
            The earliest 70% trains the models. The next 15% selects the
            recommendation. The final 15% reports unseen test performance.
          </p>
        </div>
      </div>
      <div className="split-bar">
        <div className="train">
          <span>Training</span>
          <strong>70%</strong>
          {splits && (
            <small>
              {day(splits.train[0])} – {day(splits.train[1])}
            </small>
          )}
        </div>
        <div className="validation">
          <span>Validation</span>
          <strong>15%</strong>
          {splits && (
            <small>
              {day(splits.validation[0])} – {day(splits.validation[1])}
            </small>
          )}
        </div>
        <div className="test">
          <span>Test</span>
          <strong>15%</strong>
          {splits && (
            <small>
              {day(splits.test[0])} – {day(splits.test[1])}
            </small>
          )}
        </div>
      </div>
      <section className="card table-card">
        <div className="card-header">
          <div>
            <h2>A little healthy competition</h2>
            <p>
              Lower error is better. Recommendation is based on validation MAE.
            </p>
          </div>
          <Badge tone="neutral">{latest.length || 4} MODELS</Badge>
        </div>
        {latest.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MODEL</th>
                  <th>VALIDATION MAE</th>
                  <th>TEST MAE</th>
                  <th>TEST RMSE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {[...latest]
                  .sort(
                    (a, b) =>
                      a.metadata.validation_mae - b.metadata.validation_mae,
                  )
                  .map((model) => (
                    <tr
                      key={model.id}
                      className={
                        selected?.id === model.id ? "selected-row" : ""
                      }
                    >
                      <td>
                        <button
                          className="model-name"
                          onClick={() => setSelectedId(model.id)}
                        >
                          <span className="model-icon">
                            <FlaskConical size={17} />
                          </span>
                          {model.model_name}
                        </button>
                      </td>
                      <td className="tabular">
                        {money(model.metadata.validation_mae)}
                      </td>
                      <td className="tabular">
                        <strong>{money(model.mae)}</strong>
                      </td>
                      <td className="tabular">{money(model.rmse)}</td>
                      <td>
                        {model.stale ? (
                          <Badge tone="amber">Retrain needed</Badge>
                        ) : model.metadata.recommended ? (
                          <Badge>
                            <Sparkles size={12} />
                            Recommended
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Compared</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="A little learning starts here"
            description="Once your history is ready, train and compare the historical average, previous-week baseline, linear regression, and random forest."
            icon={FlaskConical}
          />
        )}
      </section>
      {selected && (
        <>
          <section className="card">
            <div className="card-header">
              <div>
                <h2>How close did it get?</h2>
                <p>
                  {selected.model_name} · Actual versus predicted revenue on
                  unseen test dates.
                </p>
              </div>
              <Link className="button secondary" to="/predictions">
                Create forecast
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="evaluation-metrics">
              <div>
                <span>Test MAE</span>
                <strong>{money(selected.mae)}</strong>
                <small>Average absolute error per day</small>
              </div>
              <div>
                <span>Test RMSE</span>
                <strong>{money(selected.rmse)}</strong>
                <small>Gives larger misses more weight</small>
              </div>
              <div>
                <span>Test WAPE</span>
                <strong>
                  {selected.metadata.test_wape == null
                    ? "—"
                    : `${selected.metadata.test_wape.toFixed(1)}%`}
                </strong>
                <small>Error relative to total revenue</small>
              </div>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-dot" />
                Actual revenue
              </span>
              <span>
                <i className="legend-dash" />
                Predicted revenue
              </span>
            </div>
            <RevenueChart
              evaluation
              history={points.map((point) => ({
                date: point.date,
                revenue: point.actual,
              }))}
              forecast={points.map((point) => ({
                date: point.date,
                revenue: point.predicted,
              }))}
            />
            <div className="model-notes">
              <p>
                <Check size={15} />
                {selected.metadata.evaluation}
              </p>
              <p>
                <Check size={15} />
                After evaluation, the saved forecasting model is fitted to the
                full history. Negative outputs are clamped to zero.
              </p>
              <p>
                <Check size={15} />
                Trained {timestamp(selected.trained_at)} · Seed{" "}
                {selected.metadata.random_seed} ·{" "}
                {selected.metadata.filled_days} zero-filled dates
              </p>
            </div>
          </section>
          <details className="card model-history">
            <summary>
              <History size={18} />
              <strong>Saved model versions</strong>
              <span>{all.length} models retained</span>
            </summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MODEL</th>
                    <th>TRAINED</th>
                    <th>COVERAGE</th>
                    <th>TEST MAE</th>
                    <th>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((model) => (
                    <tr key={model.id}>
                      <td>{model.model_name}</td>
                      <td className="muted">{timestamp(model.trained_at)}</td>
                      <td>
                        {day(model.training_start_date)} –{" "}
                        {day(model.training_end_date)}
                      </td>
                      <td>{money(model.mae)}</td>
                      <td>
                        <button
                          className="inline-button"
                          onClick={() => setSelectedId(model.id)}
                        >
                          Inspect model
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
