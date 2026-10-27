-- MySQL 8.0.16+; six tables with database-backed users.

-- Apply once inside an empty project database. Existing installations use the additive startup migration.

SET NAMES utf8mb4;

SET time_zone = '+00:00';


CREATE TABLE IF NOT EXISTS users (
	id CHAR(32) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	`role` VARCHAR(20) NOT NULL, 
	is_active BOOL NOT NULL, 
	token_version INTEGER NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	updated_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT users_role_valid CHECK (role IN ('administrator', 'operator')), 
	UNIQUE (email)
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_bin

;


CREATE TABLE IF NOT EXISTS data_imports (
	file_name VARCHAR(255) NOT NULL, 
	file_type VARCHAR(20) NOT NULL, 
	fingerprint VARCHAR(64) NOT NULL, 
	row_count INTEGER NOT NULL, 
	total_rows INTEGER NOT NULL, 
	invalid_rows INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	error_summary TEXT, 
	synthetic BOOL NOT NULL, 
	id CHAR(32) NOT NULL, 
	owner_id CHAR(32) NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT imports_owner_fingerprint UNIQUE (owner_id, fingerprint), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_bin

;

CREATE INDEX ix_data_imports_owner_id ON data_imports (owner_id);


CREATE TABLE IF NOT EXISTS ml_models (
	model_name VARCHAR(100) NOT NULL, 
	algorithm VARCHAR(100) NOT NULL, 
	training_start_date DATE NOT NULL, 
	training_end_date DATE NOT NULL, 
	mae DOUBLE NOT NULL, 
	rmse DOUBLE NOT NULL, 
	model_path TEXT NOT NULL, 
	metadata_json JSON NOT NULL, 
	trained_at DATETIME(6) NOT NULL, 
	id CHAR(32) NOT NULL, 
	owner_id CHAR(32) NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_bin

;

CREATE INDEX ix_ml_models_owner_id ON ml_models (owner_id);


CREATE TABLE IF NOT EXISTS products (
	name VARCHAR(100) NOT NULL, 
	category VARCHAR(50), 
	price NUMERIC(10, 2) NOT NULL, 
	archived BOOL NOT NULL, 
	updated_at DATETIME(6) NOT NULL, 
	id CHAR(32) NOT NULL, 
	owner_id CHAR(32) NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT products_price_nonnegative CHECK (price >= 0), 
	CONSTRAINT products_owner_name UNIQUE (owner_id, name), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_bin

;

CREATE INDEX ix_products_owner_id ON products (owner_id);


CREATE TABLE IF NOT EXISTS predictions (
	model_id CHAR(32) NOT NULL, 
	run_id CHAR(32) NOT NULL, 
	prediction_date DATE NOT NULL, 
	predicted_sales NUMERIC(12, 2) NOT NULL, 
	id CHAR(32) NOT NULL, 
	owner_id CHAR(32) NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT predictions_nonnegative CHECK (predicted_sales >= 0), 
	CONSTRAINT predictions_run_date UNIQUE (run_id, prediction_date), 
	FOREIGN KEY(model_id) REFERENCES ml_models (id) ON DELETE RESTRICT, 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_bin

;

CREATE INDEX ix_predictions_owner_id ON predictions (owner_id);

CREATE INDEX ix_predictions_run_id ON predictions (run_id);

CREATE INDEX predictions_model_date ON predictions (model_id, prediction_date);


CREATE TABLE IF NOT EXISTS sales (
	product_id CHAR(32) NOT NULL, 
	sale_date DATE NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price NUMERIC(10, 2) NOT NULL, 
	total_amount NUMERIC(12, 2) NOT NULL, 
	import_id CHAR(32), 
	source_row INTEGER, 
	id CHAR(32) NOT NULL, 
	owner_id CHAR(32) NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT sales_quantity_positive CHECK (quantity > 0), 
	CONSTRAINT sales_price_nonnegative CHECK (unit_price >= 0), 
	CONSTRAINT sales_total_correct CHECK (total_amount = round(quantity * unit_price, 2)), 
	CONSTRAINT sales_import_row UNIQUE (import_id, source_row), 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT, 
	FOREIGN KEY(import_id) REFERENCES data_imports (id) ON DELETE RESTRICT, 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4 COLLATE utf8mb4_bin

;

CREATE INDEX ix_sales_sale_date ON sales (sale_date);

CREATE INDEX sales_product_id ON sales (product_id);

CREATE INDEX ix_sales_owner_id ON sales (owner_id);
