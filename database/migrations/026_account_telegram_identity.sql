ALTER TABLE users ADD COLUMN telegram_user_id varchar(20);
ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_format
  CHECK (telegram_user_id IS NULL OR telegram_user_id ~ '^[1-9][0-9]{0,19}$');
CREATE UNIQUE INDEX users_telegram_user_id_unique ON users(telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
