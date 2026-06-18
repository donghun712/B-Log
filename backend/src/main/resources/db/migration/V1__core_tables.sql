create table app_users (
    id bigint auto_increment primary key,
    firebase_uid varchar(128) not null unique,
    email varchar(255),
    name varchar(80) not null,
    range_id varchar(80) not null,
    range_name varchar(160) not null,
    grade varchar(40) not null,
    bow_hand varchar(16) not null,
    default_record_mode varchar(16) not null,
    ranking_public boolean not null,
    created_at timestamp not null,
    updated_at timestamp not null
);

create table practice_summaries (
    id bigint auto_increment primary key,
    user_id bigint not null,
    client_session_id varchar(80) not null unique,
    range_id varchar(80) not null,
    range_name varchar(160) not null,
    practice_date date not null,
    practiced_at timestamp not null,
    record_mode varchar(16) not null,
    total_shots int not null,
    total_hits int not null,
    ranking_public boolean not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint fk_practice_summary_user foreign key (user_id) references app_users(id),
    constraint chk_practice_summary_shots check (total_shots > 0),
    constraint chk_practice_summary_hits check (total_hits >= 0 and total_hits <= total_shots)
);

create index idx_practice_summaries_user_date on practice_summaries(user_id, practice_date);
create index idx_practice_summaries_public_date on practice_summaries(ranking_public, practice_date);
