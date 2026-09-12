PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, email TEXT NOT NULL, amount INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity IN (1,3,5)),
  status TEXT NOT NULL CHECK(status IN ('creating','pending','paid','expired','review')),
  created INTEGER NOT NULL, expires INTEGER NOT NULL,
  checkout_id TEXT UNIQUE, checkout_url TEXT, checkout_body TEXT NOT NULL,
  last_error TEXT, last_check INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS orders_state ON orders(status,created);
CREATE TABLE IF NOT EXISTS blocked_days(day TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS slots (
  order_id TEXT NOT NULL REFERENCES orders(id),
  start INTEGER NOT NULL, day TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(order_id,start)
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot ON slots(start) WHERE active=1;
CREATE INDEX IF NOT EXISTS active_day ON slots(day,active);
CREATE TRIGGER IF NOT EXISTS slot_limits BEFORE INSERT ON slots WHEN NEW.active=1
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM blocked_days WHERE day=NEW.day)
    THEN RAISE(ABORT,'blocked day') END;
  SELECT CASE WHEN (SELECT count(*) FROM slots WHERE day=NEW.day AND active=1)>=3
    THEN RAISE(ABORT,'daily limit') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM slots WHERE active=1 AND start < NEW.start+5400 AND start+5400>NEW.start)
    THEN RAISE(ABORT,'overlapping slot') END;
END;
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  first_attempt INTEGER, next_attempt INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(status,next_attempt);
