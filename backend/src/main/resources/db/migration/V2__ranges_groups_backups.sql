create table archery_ranges (
    id varchar(80) primary key,
    region varchar(80) not null,
    city varchar(80),
    name varchar(160) not null,
    representative varchar(120),
    address varchar(255),
    phone varchar(80),
    postal_code varchar(20),
    latitude decimal(10, 7),
    longitude decimal(10, 7),
    search_text varchar(600) not null
);

create index idx_archery_ranges_region_city on archery_ranges(region, city);

create table user_groups (
    id bigint auto_increment primary key,
    name varchar(120) not null unique,
    invite_code varchar(6) not null unique,
    owner_user_id bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint fk_user_group_owner foreign key (owner_user_id) references app_users(id)
);

create table group_members (
    id bigint auto_increment primary key,
    group_id bigint not null,
    user_id bigint not null,
    role varchar(20) not null,
    joined_at timestamp not null,
    constraint fk_group_member_group foreign key (group_id) references user_groups(id),
    constraint fk_group_member_user foreign key (user_id) references app_users(id),
    constraint uk_group_member unique (group_id, user_id)
);

create index idx_group_members_user on group_members(user_id);

create table user_backups (
    id bigint auto_increment primary key,
    user_id bigint not null,
    payload longtext not null,
    byte_size int not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint fk_user_backup_user foreign key (user_id) references app_users(id)
);

create index idx_user_backups_user_updated on user_backups(user_id, updated_at);
