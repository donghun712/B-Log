create table admin_accounts (
    id bigint auto_increment primary key,
    username varchar(80) not null unique,
    password_hash varchar(255) not null,
    role varchar(30) not null,
    range_id varchar(80),
    range_name varchar(160),
    active boolean not null,
    must_change_password boolean not null,
    last_login_at timestamp,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint uk_admin_account_range unique (range_id),
    constraint chk_admin_account_role check (role in ('RANGE_ADMIN'))
);

create index idx_admin_accounts_range on admin_accounts(range_id);
