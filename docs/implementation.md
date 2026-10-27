# Build guide and classroom demonstration

The project implements the requirements in `plan.md`, revised to use **MySQL** and
FastAPI administrator authentication. The UI is called **little shop**.

## 1. Database and sign-in

The API uses SQLAlchemy and PyMySQL. All six tables have UUID identifiers and UTC timestamps. The five shop-data
tables link `owner_id` to `users.id`. All managed accounts share this one shop. Monetary amounts use fixed-precision decimal
columns. MySQL timestamps retain microseconds so model versions and forecast runs
can be ordered correctly.

- `users`: account name/email, Argon2 password hash, role, active state, token version.
- `products`: catalog price, category, archive state, created/updated timestamps.
- `sales`: historical unit price, quantity, server-calculated total, optional import link.
- `data_imports`: file fingerprint, original filename, counts, errors, synthetic flag.
- `ml_models`: algorithm, coverage, test metrics, evaluation metadata, artifact path.
- `predictions`: model link, run identifier, seven dates, nonnegative revenue.

`database/schema.sql` is generated from the actual models. The API also creates
missing tables at startup. This initializes a new database; it is not a migration
system for changing existing tables. Use MySQL 8.0.16+; Docker targets 8.4.

Accounts are stored in MySQL. The initial administrator is bootstrapped once from
backend environment settings, preserving the existing UUID and shop data. Booting
again never resets a password, role, or deactivated account. Subsequent account
management happens in **Users**, restricted to administrators. Operators can manage
products, sales and imports and read reports; administrators can additionally manage
users, train models, generate forecasts and load demo data.

Successful sign-in verifies the stored Argon2 hash and issues an eight-hour JWT.
Each protected request checks the current database account, role, active status and
token version. Changing email/role/status or resetting a password revokes previous
sessions. The last active administrator cannot be deactivated, removed or demoted.
The original owner's UUID is retained because historical shop records reference it.

The browser keeps the token in tab session storage. Sign-out clears that tab;
a copied token remains valid until expiry or an account change revokes its version.
Password hashes are never returned by the API. Users can be searched, created,
edited, activated/deactivated, removed, or have their password reset from the Users
screen. Password fields include show/hide controls. New passwords require at least
eight characters. All accounts access the shared shop under its stable owner UUID.

Existing installations receive an additive `users` table and owner foreign keys on
startup. Missing owner-account matches stop migration instead of rewriting data.
The migrated initial account keeps its identifier; sales and forecasts are preserved.

MySQL uses a dedicated account limited to the application and test schemas. MySQL
uses API ownership checks to restrict access to shop records.
Database credentials and signing secrets never enter the frontend bundle.

## 2. Products and sales

Open **Products** to create, search, edit, archive, restore or remove a product.
Names use consistent Unicode normalization for uniqueness and import matching.
Removing a referenced product archives it, preserving sales history.

Open **Sales records** to enter sales, edit historical records, delete records,
filter by date/product and browse pages. Quantity must be a positive integer;
prices must be nonnegative with at most two decimal places. Future sale dates are
rejected. Historical prices are preserved when catalog prices change. The server
calculates quantity × unit price; a submitted total is rejected.

## 3. Spreadsheet imports

Open **Import data**, choose CSV/XLSX, and select **Preview & validate**. Previewing
does not change the database. The preview reports total, valid and invalid rows,
shows the first 15 rows, and lists up to 100 errors. Product names must already
exist in the active catalog. Unknown products are never created silently.

Select **Import N valid rows** to confirm. Valid rows and their audit record are
saved atomically; invalid rows are skipped and retained in the audit error summary.
If none are valid, a failed audit record is saved and no sales are inserted.
Failed files may be corrected and retried. Byte-identical completed files are
rejected even if renamed. Edited files have new fingerprints, so modified copies
with overlapping sales should be reviewed manually.

Limits: 5 MB upload, 10,000 rows, 32 XLSX columns, 25 MB expanded XLSX content.
Malformed XML, inflated worksheet dimensions and empty workbooks are rejected.
Dates use YYYY-MM-DD; CSV must be UTF-8. Optional `category` values do not change
the catalog. Select the synthetic-data checkbox for generated classroom data.

## 4. Preparing data and training

Open **Model training** to inspect coverage and missing dates. Today's sales are
excluded because the day may be incomplete. The pipeline needs at least 90 calendar
days and 60 observed sales days. The default policy rejects missing calendar dates.
The administrator can explicitly confirm that missing operating days have complete
records with zero revenue; only then are those dates filled with zero.

Click **Train models** to compare:

1. Historical average.
2. Previous-week same-weekday baseline.
3. Standard-scaled Linear Regression.
4. Random Forest (100 trees, random seed 42).

Dates are sorted, never shuffled. Earliest 70% trains each model. The next 15%
provides validation MAE for recommendation. Each algorithm is then refitted on
train + validation and evaluated on the final 15%. Test MAE/RMSE are in USD; WAPE
is omitted if actual total revenue is zero. The test set does not select the winner.

Evaluation advances through seven-day blocks. Within a block, lag features use
predicted values, never future actual revenue. Actual observations become available
between block origins, corresponding to a weekly rolling-origin evaluation.

Features: cyclic weekday/month, weekend, 1/7/14-day lags, prior seven-day mean and
day index. Scaling is fitted on the applicable training partition. After evaluation,
each deployed artifact is refitted to the full available history; reported test
metrics come from the earlier evaluation estimator, not that final refit.

Every training run creates four new records and retains old versions. Metadata
includes partitions, test plot points, dataset fingerprint, preprocessing features,
random seed, library version and missing-date policy. Trusted joblib artifacts are
stored under `backend/data/artifacts/`, outside MySQL and browser access.

## 5. Forecasts and history

Open **Forecasts**, choose a trained model and click **Generate 7-day forecast**.
Seven rows are saved for **tomorrow through seven days from today**, using the
shop timezone. If history ends before today, intermediate dates are predicted
recursively before the requested dates. History more than seven days old is
rejected; update sales and retrain.

Negative outputs are clamped to zero and disclosed. Forecasts are estimates, not
guarantees. No prediction intervals or accuracy guarantees are provided.
Sales changes mark affected models stale and block new forecasts until retraining.
Previously generated runs remain linked to their original model. An artifact must
match its server-controlled location and SHA-256 digest before loading.

Each run has a chart, daily amounts, estimated total, model, date coverage, test MAE,
creation time and CSV download. Actual revenue appears as dates become completed
history. The overview displays an upcoming forecast only when it covers the next
seven days; old runs remain in history.

## 6. Suggested demonstration

1. Start MySQL and the application using the root README.
2. Sign in with the configured administrator. Default demo credentials can be filled
   using the button on the sign-in page.
3. On an empty database, select **Load sample data** on the overview: 180 days,
   five products, 900 synthetic sales. The generator ends yesterday and uses seed 42.
4. Show the product catalog, historical prices, filters and calculated sale totals.
5. Upload `samples/sales-example.csv`, preview errors using an intentionally edited
   copy, then import only valid rows. Create the referenced products first.
6. Train the four algorithms. Explain the chronological partitions and why validation
   chooses the recommendation.
7. Generate a forecast and export CSV. Show the stored model link and test chart.
8. Edit a historical sale. Show the retraining warning, retrain, and confirm the older
   forecast is still present.

Screenshots from real browser checks are in `docs/screenshots/`. Sample records,
metrics and model artifacts in the local workspace are synthetic demonstration data.

## Boundaries

Single shared shop, currency (USD), and seven-day horizon, with managed administrator/operator accounts. This is a
university prototype, with synchronous training and local artifact storage.
It does not implement inventory, payments, accounting, OCR, product-level forecasts,
or automated business decisions. Back up MySQL and the artifact directory together.
For deployment, configure production credentials, HTTPS, CORS and database access;
demo mode is intended for a local classroom machine.

Reference documentation: [FastAPI JWT authentication](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/),
[SQLAlchemy MySQL engines](https://docs.sqlalchemy.org/en/21/core/engines.html),
[MySQL CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html),
[scikit-learn MAE](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_absolute_error.html).
