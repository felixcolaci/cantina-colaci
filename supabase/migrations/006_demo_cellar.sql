alter table families
  add column is_demo boolean not null default true;

-- Existing families are real, not demo
update families set is_demo = false;
