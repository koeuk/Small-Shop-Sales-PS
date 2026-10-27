# MySQL database

The application uses six InnoDB tables and `utf8mb4_bin` text storage. UUIDs are
stored as 32 hexadecimal characters and represented as standard UUIDs by the API.
Monetary columns are DECIMAL; timestamps are UTC DATETIME(6).

On a new database, API startup creates the schema from `backend/app/models.py`.
`schema.sql` contains the same DDL for inspection or manual initialization.
Apply it once inside an empty database; separate CREATE INDEX statements are not
repeatable migrations.

For a new machine, either use the root Docker Compose file or create a project
database and limited account using a MySQL administrator, then fill `backend/.env`.
The configured account needs table creation for initial startup and CRUD thereafter.
No browser accesses MySQL directly. Keep the MySQL port private and scope the account
to the project schema. A separate `_test` schema is used for integration tests.

In this workspace, `backend/.env` points to the approved `small_shop_sales_ps`
database on localhost:3306, using the dedicated `smallshop_ps` account. Its generated
password is stored only in that ignored file. Root credentials are not saved.

The `users` table stores Argon2 password hashes, roles, active status and token
versions. The five data tables reference its original shop-owner UUID; managed
accounts share the same shop. Startup adds the table and ownership foreign keys
to an existing installation without removing data. An existing administrator is
never overwritten by bootstrap settings.
