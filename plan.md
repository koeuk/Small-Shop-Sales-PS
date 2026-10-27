SOFTWARE REQUIREMENTS SPECIFICATION

Small Shop Sales Prediction System

Machine Learning–Focused University Project

Prepared for: Software Project Management | Prepared by: Kos Koeuk | Version: 1.1 | Date: 27 October 2026

Status: Proposed requirements — subject to supervisor approval

1. Executive Summary

This project is a small-shop revenue forecasting application. Users import or enter historical sales, review data quality, train and evaluate regression models, generate seven-day daily revenue forecasts, and view actual-versus-predicted charts. React.js provides the interface; FastAPI handles business logic and model execution; MySQL 8.4 stores transactional records and metadata. The core educational objective is a reproducible machine-learning pipeline, not a full POS system.

2. Objectives and Success Measures

Implement product and historical-sales CRUD and CSV/XLSX import.

Aggregate item-level sales into daily revenue and prepare leakage-free time-series features.

Train at least two baselines/models, evaluate on chronologically later unseen dates, and select the best validated model.

Forecast daily total shop revenue for the next seven calendar days and retain forecast history.

Show explainable evaluation results, forecast charts, warnings, and reproducible test evidence.

Success is demonstrated by a working end-to-end flow, valid imports, saved model metrics, and forecasts. Forecast accuracy is measured and reported, not guaranteed.

3. Scope

3.1 Included

Single shop, one administrator/operator; product list; historical sales; file imports; model training and evaluation; seven-day total revenue forecast; dashboard and prediction history; simple access control.

3.2 Excluded

Inventory replenishment, supplier management, payments, accounting, tax filing, multi-branch operation, real-time POS hardware, product-level forecasts, and automatic financial decisions.

4. Users and Permissions

Role

Allowed actions

Administrator

Sign in; manage products/sales; import files; train models; generate and inspect forecasts.

Unauthenticated visitor

No access to protected data or model endpoints.

Use FastAPI administrator sign-in with signed, expiring JWTs. Administrator credentials are configured on the server; a separate application users table is not required for this single-administrator prototype. Backend authorization and ownership checks must protect records. MySQL is private to the backend and uses a dedicated database account.

5. Functional Requirements

ID

Feature

Requirement

FR-01

Authentication

Only signed-in users can access the application.

FR-02

Product CRUD

Create, list, update and archive/delete products; prevent deleting products referenced by sales.

FR-03

Sales CRUD

Create, list, filter, edit and delete sales; retain historical unit price and revenue.

FR-04

Data import

Accept CSV/XLSX files, preview rows, validate fields, report errors and import valid rows.

FR-05

Import audit

Record file name/type, row counts, processing status and error summary.

FR-06

Data preparation

Aggregate sales by date, fill/flag missing calendar dates under an explicit policy, and derive past-only features.

FR-07

Model training

Train historical-average baseline, Linear Regression and Random Forest Regressor (optional if time limited).

FR-08

Model evaluation

Use time-ordered train/validation/test partitions; calculate MAE and RMSE and show date ranges.

FR-09

Model storage

Save training metadata and trusted serialized model artifact outside the database; record artifact path.

FR-10

Forecast generation

Generate seven daily shop-revenue predictions for future dates using a selected trained model.

FR-11

Forecast history

Store and retrieve generated predictions with model and creation timestamp.

FR-12

Analytics dashboard

Display historical daily totals, forecasts, training metrics and actual-versus-predicted plots.

FR-13

Validation/errors

Reject invalid quantities, prices, duplicate imports when detectable, and malformed data with clear messages.

FR-14

Retraining

Allow administrator to retrain after data updates; previous predictions remain attributed to original model.

FR-15

Export

Allow downloading forecast results as CSV (optional enhancement).

6. Data Dictionary — Five Tables

Use application-generated UUID primary keys (stored as CHAR(32) by SQLAlchemy and returned as standard UUID strings), DECIMAL monetary values, UTC DATETIME timestamps, and appropriate foreign keys. Every table includes owner_id for backend ownership checks. Currency is fixed to USD for the prototype; do not mix currencies.

6.x products

Field

Type / Constraint

Purpose

id

UUID PK

Generated identifier

name

VARCHAR(100) NOT NULL

Product name

category

VARCHAR(50)

Optional grouping

price

NUMERIC(10,2) NOT NULL

Current list price, >= 0

created_at

DATETIME (UTC)

Default now()

updated_at

DATETIME (UTC)

Updated on edit

6.x sales

Field

Type / Constraint

Purpose

id

UUID PK

Generated identifier

product_id

UUID FK NOT NULL

References products.id

sale_date

DATE NOT NULL

Calendar date of sale

quantity

INTEGER NOT NULL

Must be > 0

unit_price

NUMERIC(10,2) NOT NULL

Historical sale price >= 0

total_amount

NUMERIC(12,2) NOT NULL

quantity × unit_price, validated server-side

import_id

UUID FK NULL

Optional reference to data_imports.id

created_at

DATETIME (UTC)

Default now()

6.x data_imports

Field

Type / Constraint

Purpose

id

UUID PK

Generated identifier

file_name

VARCHAR(255) NOT NULL

Original filename

file_type

VARCHAR(20) NOT NULL

csv or xlsx

row_count

INTEGER

Successfully imported rows

status

VARCHAR(20) NOT NULL

pending/completed/failed

error_summary

TEXT NULL

Validation and import errors

created_at

DATETIME (UTC)

Default now()

6.x ml_models

Field

Type / Constraint

Purpose

id

UUID PK

Generated identifier

model_name

VARCHAR(100) NOT NULL

Human-readable model name

algorithm

VARCHAR(100) NOT NULL

Historical Average / Linear Regression / Random Forest

training_start_date

DATE NOT NULL

First training date

training_end_date

DATE NOT NULL

Last training date

mae

DOUBLE PRECISION NULL

Test mean absolute error (USD)

rmse

DOUBLE PRECISION NULL

Test root mean squared error (USD)

model_path

TEXT NULL

Trusted model artifact location

trained_at

DATETIME (UTC)

Default now()

6.x predictions

Field

Type / Constraint

Purpose

id

UUID PK

Generated identifier

model_id

UUID FK NOT NULL

References ml_models.id

prediction_date

DATE NOT NULL

Target future date

predicted_sales

NUMERIC(12,2) NOT NULL

Forecast daily revenue, >= 0

created_at

DATETIME (UTC)

Default now()

Relationships: products (1) → sales (many); data_imports (1) → sales (many, nullable); ml_models (1) → predictions (many). Prediction rows are independent of individual sales rows. Add indexes on sales(sale_date), sales(product_id), predictions(model_id, prediction_date).

7. Business Rules and Validation

Sale quantity must be a positive integer; unit price cannot be negative; total_amount is calculated on the server, not trusted from the client.

Product records with historical sales cannot be hard-deleted; archive them or restrict deletion.

Imported rows require sale_date, product identifier/name mapping, quantity and unit_price; invalid rows are reported and do not silently corrupt totals.

Imported data is idempotent where possible: use a source-row identifier or file fingerprint plus row position to detect duplicate reimports.

A day with no sales is treated as zero only if the shop was operating and data capture was complete; otherwise mark as missing and avoid assuming zero.

Predicted revenue cannot be negative; clamp negative model outputs to zero and disclose this transformation.

Generated forecasts represent estimates, not guaranteed future revenue.

8. Machine Learning Requirements

8.1 Prediction Target and Inputs

Target: total shop revenue in USD for each future calendar day. Input: dated historical sales rows; aggregation sums total_amount per sale_date. Suggested features: weekday, month, weekend indicator, previous 1/7/14-day revenue, and 7-day trailing average computed strictly from dates before the target.

8.2 Data Requirements

For a meaningful demonstration, aim for at least 90 consecutive calendar days of plausible sales history; more is better. The application must report insufficient data and avoid presenting forecasts as reliable when training history is too short. Synthetic data may be used for classroom demonstration but must be labeled synthetic.

8.3 Training and Evaluation

Sort daily observations by date; do not randomly shuffle time-series data.

Use an earlier training period, a later validation period for model selection, and the latest holdout period for final test metrics.

Compare a simple naive baseline (e.g., previous week same weekday) with Linear Regression and optionally Random Forest.

Fit preprocessing only on training data; never use future actual revenue in forecast features.

Report MAE and RMSE in USD; optionally report WAPE when actual total revenue is nonzero.

For multi-day forecasting, use recursive forecasts with predicted lag values or a direct horizon strategy; document the selected approach.

Save model version, data date range, metrics, and the model artifact; retraining creates a new record.

8.4 ML Pipeline

Historical sales → daily aggregation → validation and missing-date policy → lag/calendar feature creation → chronological split → baseline/model training → holdout evaluation → save model metadata/artifact → generate next 7 daily predictions → chart and history.

9. Application Screens

Screen

Key elements

Login

Email/password and session handling.

Dashboard

Sales summary, historical line chart, seven-day forecast, model status.

Products

Searchable list, create/edit/archive product.

Sales

Date-filtered list, create/edit/delete sale, totals.

Import Sales

CSV/XLSX upload, preview, validation errors, import history.

ML Training

Dataset coverage, model selection, train action, metrics comparison.

Predictions

Forecast button, selected model, seven-day chart/table, previous runs.

10. API Specification (FastAPI)

Method

Route

Purpose

GET/POST

/api/products

List/create products

PATCH/DELETE

/api/products/{id}

Update/archive product

GET/POST

/api/sales

List/create sales

PATCH/DELETE

/api/sales/{id}

Update/delete sale

POST

/api/imports

Upload and validate sales file

GET

/api/imports

Import history

POST

/api/ml/train

Start training and evaluation

GET

/api/ml/models

List trained models and metrics

POST

/api/predictions

Generate seven-day forecast

GET

/api/predictions

View forecasts and history

GET

/api/dashboard

Daily sales summaries and chart data

Protected endpoints require a verified backend-issued administrator access token. Return JSON with meaningful HTTP status codes (400 invalid input, 401 unauthenticated, 403 forbidden, 404 missing resource, 422 validation error, 500 unexpected failure). Long-running training may use background jobs; a synchronous endpoint is acceptable for a small dataset.

11. Non-Functional Requirements

Usability: responsive React interface for desktop and mobile; readable labels, loading states and errors.

Performance target: ordinary CRUD and dashboard API responses under ~2 seconds for a classroom dataset of up to 10,000 sale rows on a suitable development machine; training may take longer.

Security: verify JWTs server-side; enforce ownership in backend queries; keep MySQL credentials, JWT signing secrets, and model storage out of the browser; validate uploads and restrict file size (e.g., 5 MB).

Reliability: database transactions for imports, clear error reporting, and repeatable training runs with fixed random seed where applicable.

Maintainability: separate API, database, ML preprocessing, training, forecasting and frontend modules.

Data integrity: use foreign keys, constraints, unique identifiers and database backups where available.

Transparency: label synthetic datasets and display model accuracy and date coverage alongside forecasts.

12. Acceptance Criteria and Test Cases

Test ID

Scenario

Expected result

TC-01

Create/edit product

Record persists with valid fields.

TC-02

Create sale with quantity 3 and price 2

Saved total is 6.00.

TC-03

Submit negative quantity

Request rejected with validation message.

TC-04

Import valid CSV

Sales created and import marked completed.

TC-05

Import malformed file

Errors shown; no silent incorrect records.

TC-06

Train with adequate dated data

Model metadata, metrics and artifact recorded.

TC-07

Train with insufficient history

Clear warning; no misleading accuracy claim.

TC-08

Evaluate chronological holdout

Test metrics computed only from later unseen dates.

TC-09

Generate forecast

Exactly seven dated nonnegative predictions saved.

TC-10

View prediction history

Forecasts link to correct model and timestamps.

TC-11

Unauthenticated API request

Access denied.

TC-12

Edit historical sales and retrain

New model record created; older forecasts retained.

13. Sample CSV Import Contract

Required columns: sale_date, product_name (or product_id), quantity, unit_price. Optional: category. Example:

sale_date,product_name,quantity,unit_price
2026-07-01,Coffee,12,2.00
2026-07-01,Tea,8,1.50

Dates must use YYYY-MM-DD. Product names are mapped to known products (or explicitly created after user confirmation). Uploaded PDF/images and OCR are outside MVP scope; spreadsheet import is sufficient for this assignment.

14. Proposed Development Plan

Phase

Deliverables

1. Analysis & design

SRS, schema, screen wireframes, dataset plan

2. Database & CRUD

Five tables, constraints, authentication, products/sales API/UI

3. Import & cleaning

CSV/XLSX upload, validation, daily aggregation

4. ML implementation

Features, baseline, regression models, chronological evaluation

5. Forecast & dashboard

Seven-day prediction, model history, charts

6. QA & presentation

Test cases, screenshots, demonstration and report

15. Risks, Assumptions, and Future Enhancements

Risks: small or unrealistic datasets, missing dates, data leakage, unstable seasonal patterns, inaccurate forecasts, duplicate imports and unauthorized access. Mitigations: dataset-quality checks, chronological testing, baseline comparison, transparent error metrics and secure API controls.

Assumptions: single shop, one currency (USD), daily sales recorded consistently, historical data available, and forecast horizon fixed at seven days. Future enhancements: product-level demand prediction, holidays/promotions/weather features, scheduled retraining, PDF reporting and inventory planning.

16. Final Deliverables

React frontend and FastAPI backend source code.

MySQL database schema and sample/synthetic dataset.

Trained ML model artifacts and evaluation metrics.

Working seven-day sales forecast and dashboard.

Test results, screenshots, installation guide, and final project demonstration.

End of Software Requirements Specification — Version 1.1

Small Shop Sales Prediction System  |  SRS v1.1

Revision 1.1: Per project owner request, MySQL replaces the original database provider and FastAPI handles administrator authentication. Local demo mode still uses MySQL; synthetic data remains explicitly labeled.
