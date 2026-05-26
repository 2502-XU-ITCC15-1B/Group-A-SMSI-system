ALTER TABLE tickets
  ADD COLUMN client_full_name VARCHAR(150) NULL AFTER work_order_id;

ALTER TABLE tickets
  ADD COLUMN client_email VARCHAR(150) NULL AFTER client_full_name;

ALTER TABLE tickets
  ADD COLUMN client_phone VARCHAR(30) NULL AFTER client_email;

ALTER TABLE tickets
  ADD COLUMN help_topic VARCHAR(150) NULL AFTER client_phone;
