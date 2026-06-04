--
-- PostgreSQL database dump
--

\restrict 2WbTTm4TKItC6tivK9Blnaa4fenNogjHMZ8ebyvhek48I2zd9utHHqbBSWI2oY9

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: dss; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA dss;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_users; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.app_users (
    user_id character varying(20) NOT NULL,
    username character varying(80) NOT NULL,
    password_hash text NOT NULL,
    display_name character varying(120) NOT NULL,
    role_key character varying(30) NOT NULL,
    department character varying(80) NOT NULL,
    phone character varying(40) NOT NULL,
    password_changed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bol_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.bol_lines (
    bol_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    bol_version_id uuid NOT NULL,
    item_id uuid NOT NULL,
    work_center_id uuid NOT NULL,
    labor_minutes_per_unit numeric(18,8) NOT NULL,
    setup_minutes_per_lot numeric(18,4) DEFAULT 0 NOT NULL,
    planning_factor_pct numeric(7,4) DEFAULT 100 NOT NULL,
    CONSTRAINT chk_bol_lines_numbers CHECK (((labor_minutes_per_unit >= (0)::numeric) AND (setup_minutes_per_lot >= (0)::numeric) AND (planning_factor_pct >= (0)::numeric)))
);


--
-- Name: bol_versions; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.bol_versions (
    bol_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_code character varying(50) NOT NULL,
    description text,
    effective_from date,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_bol_versions_date_range CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= effective_from)))
);


--
-- Name: bom_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.bom_lines (
    bom_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_version_id uuid NOT NULL,
    component_item_id uuid NOT NULL,
    line_no integer DEFAULT 1 NOT NULL,
    quantity_per_parent numeric(18,8) NOT NULL,
    scrap_factor_pct numeric(7,4) DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT chk_bom_lines_quantity CHECK ((quantity_per_parent > (0)::numeric)),
    CONSTRAINT chk_bom_lines_scrap CHECK ((scrap_factor_pct >= (0)::numeric))
);


--
-- Name: bom_versions; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.bom_versions (
    bom_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_item_id uuid NOT NULL,
    version_code character varying(50) NOT NULL,
    description text,
    effective_from date,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_bom_versions_date_range CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= effective_from)))
);


--
-- Name: crp_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.crp_lines (
    crp_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    routing_operation_id uuid,
    work_center_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid NOT NULL,
    order_qty numeric(18,4) DEFAULT 0 NOT NULL,
    setup_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    run_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    required_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    available_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    utilization_pct numeric(9,4) DEFAULT 0 NOT NULL,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_crp_lines_qty CHECK (((order_qty >= (0)::numeric) AND (setup_minutes >= (0)::numeric) AND (run_minutes >= (0)::numeric) AND (required_minutes >= (0)::numeric) AND (available_minutes >= (0)::numeric) AND (utilization_pct >= (0)::numeric)))
);


--
-- Name: delivery_routes; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.delivery_routes (
    route_id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_code character varying(60) NOT NULL,
    route_name character varying(200) NOT NULL,
    delivery_day character varying(30),
    start_location_id character varying(100),
    end_location_id character varying(100),
    color_hex character varying(20)
);


--
-- Name: demand_plans; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.demand_plans (
    demand_plan_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid NOT NULL,
    forecast_qty numeric(18,4) DEFAULT 0 NOT NULL,
    customer_order_qty numeric(18,4) DEFAULT 0 NOT NULL,
    source character varying(60) DEFAULT 'manual'::character varying NOT NULL,
    CONSTRAINT chk_demand_plans_qty CHECK (((forecast_qty >= (0)::numeric) AND (customer_order_qty >= (0)::numeric)))
);


--
-- Name: forecast_sales_history; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.forecast_sales_history (
    sale_id bigint NOT NULL,
    tanggal date NOT NULL,
    id_toko character varying(30) NOT NULL,
    id_product character varying(30) NOT NULL,
    quantity_laku numeric NOT NULL,
    harga numeric DEFAULT 0 NOT NULL,
    total_penjualan numeric DEFAULT 0 NOT NULL,
    nama_toko text,
    nama_rute text,
    id_rute character varying(30)
);


--
-- Name: forecast_sales_history_sale_id_seq; Type: SEQUENCE; Schema: dss; Owner: -
--

CREATE SEQUENCE dss.forecast_sales_history_sale_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: forecast_sales_history_sale_id_seq; Type: SEQUENCE OWNED BY; Schema: dss; Owner: -
--

ALTER SEQUENCE dss.forecast_sales_history_sale_id_seq OWNED BY dss.forecast_sales_history.sale_id;


--
-- Name: item_planning_policies; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.item_planning_policies (
    item_id uuid NOT NULL,
    lot_sizing_method character varying(30) DEFAULT 'LFL'::character varying NOT NULL,
    lot_size numeric(18,4) DEFAULT 1 NOT NULL,
    min_order_qty numeric(18,4) DEFAULT 0 NOT NULL,
    order_multiple numeric(18,4) DEFAULT 1 NOT NULL,
    lead_time_periods integer DEFAULT 0 NOT NULL,
    safety_stock_qty numeric(18,4) DEFAULT 0 NOT NULL,
    initial_on_hand_qty numeric(18,4) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_item_policy_lot_method CHECK (((lot_sizing_method)::text = ANY ((ARRAY['LFL'::character varying, 'FOQ'::character varying, 'MOQ'::character varying, 'MULTIPLE'::character varying])::text[]))),
    CONSTRAINT chk_item_policy_numbers CHECK (((lot_size > (0)::numeric) AND (min_order_qty >= (0)::numeric) AND (order_multiple > (0)::numeric) AND (lead_time_periods >= 0) AND (safety_stock_qty >= (0)::numeric) AND (initial_on_hand_qty >= (0)::numeric)))
);


--
-- Name: items; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.items (
    item_id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(200) NOT NULL,
    item_type character varying(30) NOT NULL,
    family_id uuid,
    uom_id uuid,
    supplier_name character varying(200),
    producer_name character varying(200),
    country_name character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_items_type CHECK (((item_type)::text = ANY ((ARRAY['final_product'::character varying, 'intermediate'::character varying, 'raw_material'::character varying, 'packaging'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: mps_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.mps_lines (
    mps_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid NOT NULL,
    gross_demand_qty numeric(18,4) DEFAULT 0 NOT NULL,
    scheduled_receipt_qty numeric(18,4) DEFAULT 0 NOT NULL,
    mps_receipt_qty numeric(18,4) DEFAULT 0 NOT NULL,
    projected_available_qty numeric(18,4) DEFAULT 0 NOT NULL,
    available_to_promise_qty numeric(18,4) DEFAULT 0 NOT NULL,
    notes text,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_mps_lines_qty CHECK (((gross_demand_qty >= (0)::numeric) AND (scheduled_receipt_qty >= (0)::numeric) AND (mps_receipt_qty >= (0)::numeric) AND (projected_available_qty >= (0)::numeric)))
);


--
-- Name: mrp_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.mrp_lines (
    mrp_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid NOT NULL,
    gross_requirement_qty numeric(18,4) DEFAULT 0 NOT NULL,
    scheduled_receipt_qty numeric(18,4) DEFAULT 0 NOT NULL,
    projected_on_hand_qty numeric(18,4) DEFAULT 0 NOT NULL,
    net_requirement_qty numeric(18,4) DEFAULT 0 NOT NULL,
    planned_order_receipt_qty numeric(18,4) DEFAULT 0 NOT NULL,
    planned_order_release_qty numeric(18,4) DEFAULT 0 NOT NULL,
    past_due_release_qty numeric(18,4) DEFAULT 0 NOT NULL,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_mrp_lines_qty CHECK (((gross_requirement_qty >= (0)::numeric) AND (scheduled_receipt_qty >= (0)::numeric) AND (projected_on_hand_qty >= (0)::numeric) AND (net_requirement_qty >= (0)::numeric) AND (planned_order_receipt_qty >= (0)::numeric) AND (planned_order_release_qty >= (0)::numeric) AND (past_due_release_qty >= (0)::numeric)))
);


--
-- Name: on_hand_balances; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.on_hand_balances (
    balance_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid,
    on_hand_qty numeric(18,4) DEFAULT 0 NOT NULL,
    balance_type character varying(30) DEFAULT 'opening'::character varying NOT NULL,
    CONSTRAINT chk_on_hand_balances_qty CHECK ((on_hand_qty >= (0)::numeric)),
    CONSTRAINT chk_on_hand_balances_type CHECK (((balance_type)::text = ANY ((ARRAY['opening'::character varying, 'closing'::character varying, 'snapshot'::character varying])::text[])))
);


--
-- Name: planning_periods; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.planning_periods (
    period_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    period_code character varying(30) NOT NULL,
    start_date date,
    end_date date,
    CONSTRAINT chk_planning_periods_date_range CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_planning_periods_sequence CHECK ((sequence_no > 0))
);


--
-- Name: planning_scenarios; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.planning_scenarios (
    scenario_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_code character varying(50) NOT NULL,
    scenario_name character varying(150) NOT NULL,
    description text,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    source_name character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_planning_scenarios_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: product_families; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.product_families (
    family_id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_code character varying(50) NOT NULL,
    family_name character varying(150) NOT NULL
);


--
-- Name: production_schedule_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.production_schedule_lines (
    schedule_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid NOT NULL,
    route_id uuid,
    planned_qty numeric(18,4) DEFAULT 0 NOT NULL,
    capacity_status character varying(30) DEFAULT 'normal'::character varying NOT NULL,
    notes text,
    CONSTRAINT chk_production_schedule_lines_qty CHECK ((planned_qty >= (0)::numeric)),
    CONSTRAINT chk_production_schedule_lines_status CHECK (((capacity_status)::text = ANY ((ARRAY['normal'::character varying, 'tight'::character varying, 'overload'::character varying])::text[])))
);


--
-- Name: rccp_lines; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.rccp_lines (
    rccp_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    work_center_id uuid NOT NULL,
    period_id uuid NOT NULL,
    required_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    available_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    utilization_pct numeric(9,4) DEFAULT 0 NOT NULL,
    overload_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    is_overload boolean DEFAULT false NOT NULL,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_rccp_lines_qty CHECK (((required_minutes >= (0)::numeric) AND (available_minutes >= (0)::numeric) AND (utilization_pct >= (0)::numeric) AND (overload_minutes >= (0)::numeric)))
);


--
-- Name: route_stores; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.route_stores (
    route_id uuid NOT NULL,
    store_id uuid NOT NULL,
    sequence_no integer DEFAULT 1 NOT NULL,
    CONSTRAINT chk_route_stores_sequence CHECK ((sequence_no > 0))
);


--
-- Name: routing_operations; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.routing_operations (
    routing_operation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    work_center_id uuid NOT NULL,
    operation_no integer NOT NULL,
    operation_name character varying(150),
    setup_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    run_minutes_per_unit numeric(18,8) DEFAULT 0 NOT NULL,
    transfer_minutes numeric(18,4) DEFAULT 0 NOT NULL,
    effective_from date,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_routing_operations_date_range CHECK (((effective_to IS NULL) OR (effective_from IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT chk_routing_operations_numbers CHECK (((operation_no > 0) AND (setup_minutes >= (0)::numeric) AND (run_minutes_per_unit >= (0)::numeric) AND (transfer_minutes >= (0)::numeric)))
);


--
-- Name: scheduled_receipts; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.scheduled_receipts (
    receipt_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    item_id uuid NOT NULL,
    period_id uuid NOT NULL,
    receipt_qty numeric(18,4) DEFAULT 0 NOT NULL,
    receipt_type character varying(30) DEFAULT 'purchase_order'::character varying NOT NULL,
    reference_no character varying(100),
    CONSTRAINT chk_scheduled_receipts_qty CHECK ((receipt_qty >= (0)::numeric)),
    CONSTRAINT chk_scheduled_receipts_type CHECK (((receipt_type)::text = ANY ((ARRAY['purchase_order'::character varying, 'production_order'::character varying, 'transfer'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: stores; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.stores (
    store_id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_code character varying(60) NOT NULL,
    store_name character varying(200) NOT NULL,
    location_name character varying(200),
    address text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: uoms; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.uoms (
    uom_id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: v_mps_total_by_period; Type: VIEW; Schema: dss; Owner: -
--

CREATE VIEW dss.v_mps_total_by_period AS
 SELECT ml.scenario_id,
    ml.period_id,
    pp.period_code,
    pp.sequence_no,
    sum(ml.gross_demand_qty) AS total_demand_qty,
    sum(ml.mps_receipt_qty) AS total_mps_receipt_qty
   FROM (dss.mps_lines ml
     JOIN dss.planning_periods pp ON ((pp.period_id = ml.period_id)))
  GROUP BY ml.scenario_id, ml.period_id, pp.period_code, pp.sequence_no;


--
-- Name: v_mrp_release_orders; Type: VIEW; Schema: dss; Owner: -
--

CREATE VIEW dss.v_mrp_release_orders AS
 SELECT ml.scenario_id,
    ml.item_id,
    i.item_code,
    i.item_name,
    ml.period_id,
    pp.period_code,
    pp.sequence_no,
    ml.planned_order_release_qty
   FROM ((dss.mrp_lines ml
     JOIN dss.items i ON ((i.item_id = ml.item_id)))
     JOIN dss.planning_periods pp ON ((pp.period_id = ml.period_id)))
  WHERE (ml.planned_order_release_qty > (0)::numeric);


--
-- Name: v_rccp_summary_by_period; Type: VIEW; Schema: dss; Owner: -
--

CREATE VIEW dss.v_rccp_summary_by_period AS
 SELECT rl.scenario_id,
    rl.period_id,
    pp.period_code,
    pp.sequence_no,
    sum(rl.required_minutes) AS total_required_minutes,
    sum(rl.available_minutes) AS total_available_minutes,
        CASE
            WHEN (sum(rl.available_minutes) > (0)::numeric) THEN ((sum(rl.required_minutes) / sum(rl.available_minutes)) * (100)::numeric)
            ELSE (0)::numeric
        END AS total_utilization_pct,
    max(rl.utilization_pct) AS peak_work_center_utilization_pct,
    bool_or(rl.is_overload) AS has_overload
   FROM (dss.rccp_lines rl
     JOIN dss.planning_periods pp ON ((pp.period_id = rl.period_id)))
  GROUP BY rl.scenario_id, rl.period_id, pp.period_code, pp.sequence_no;


--
-- Name: work_centers; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.work_centers (
    work_center_id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_center_code character varying(60) NOT NULL,
    work_center_name character varying(200) NOT NULL,
    units numeric(18,4) DEFAULT 1 NOT NULL,
    hours_per_day numeric(18,4) DEFAULT 8 NOT NULL,
    shifts_per_day numeric(18,4) DEFAULT 1 NOT NULL,
    workdays_per_period numeric(18,4) DEFAULT 5 NOT NULL,
    efficiency_pct numeric(7,4) DEFAULT 100 NOT NULL,
    utilization_target_pct numeric(7,4) DEFAULT 100 NOT NULL,
    queue_days numeric(18,4) DEFAULT 0 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_work_centers_capacity_numbers CHECK (((units > (0)::numeric) AND (hours_per_day >= (0)::numeric) AND (shifts_per_day > (0)::numeric) AND (workdays_per_period >= (0)::numeric) AND (efficiency_pct >= (0)::numeric) AND (utilization_target_pct >= (0)::numeric) AND (queue_days >= (0)::numeric)))
);


--
-- Name: v_work_center_default_capacity; Type: VIEW; Schema: dss; Owner: -
--

CREATE VIEW dss.v_work_center_default_capacity AS
 SELECT work_center_id,
    work_center_code,
    work_center_name,
    ((((((units * workdays_per_period) * shifts_per_day) * hours_per_day) * (60)::numeric) * efficiency_pct) / (100)::numeric) AS effective_minutes,
    ((((((((units * workdays_per_period) * shifts_per_day) * hours_per_day) * (60)::numeric) * efficiency_pct) / (100)::numeric) * utilization_target_pct) / (100)::numeric) AS rccp_available_minutes
   FROM dss.work_centers wc
  WHERE (is_active = true);


--
-- Name: work_center_period_capacity; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.work_center_period_capacity (
    capacity_id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_center_id uuid NOT NULL,
    period_id uuid NOT NULL,
    available_minutes numeric(18,4) NOT NULL,
    capacity_reason character varying(150),
    CONSTRAINT chk_work_center_period_capacity_minutes CHECK ((available_minutes >= (0)::numeric))
);


--
-- Name: workbook_imports; Type: TABLE; Schema: dss; Owner: -
--

CREATE TABLE dss.workbook_imports (
    import_id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid,
    file_name character varying(255) NOT NULL,
    file_path text,
    file_size_bytes bigint,
    imported_at timestamp without time zone DEFAULT now() NOT NULL,
    import_status character varying(30) DEFAULT 'success'::character varying NOT NULL,
    message text,
    CONSTRAINT chk_workbook_imports_status CHECK (((import_status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'partial'::character varying])::text[])))
);


--
-- Name: forecast_sales_history sale_id; Type: DEFAULT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.forecast_sales_history ALTER COLUMN sale_id SET DEFAULT nextval('dss.forecast_sales_history_sale_id_seq'::regclass);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (user_id);


--
-- Name: app_users app_users_username_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.app_users
    ADD CONSTRAINT app_users_username_key UNIQUE (username);


--
-- Name: bol_lines bol_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_lines
    ADD CONSTRAINT bol_lines_pkey PRIMARY KEY (bol_line_id);


--
-- Name: bol_versions bol_versions_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_versions
    ADD CONSTRAINT bol_versions_pkey PRIMARY KEY (bol_version_id);


--
-- Name: bol_versions bol_versions_version_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_versions
    ADD CONSTRAINT bol_versions_version_code_key UNIQUE (version_code);


--
-- Name: bom_lines bom_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_lines
    ADD CONSTRAINT bom_lines_pkey PRIMARY KEY (bom_line_id);


--
-- Name: bom_versions bom_versions_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_versions
    ADD CONSTRAINT bom_versions_pkey PRIMARY KEY (bom_version_id);


--
-- Name: crp_lines crp_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.crp_lines
    ADD CONSTRAINT crp_lines_pkey PRIMARY KEY (crp_line_id);


--
-- Name: delivery_routes delivery_routes_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.delivery_routes
    ADD CONSTRAINT delivery_routes_pkey PRIMARY KEY (route_id);


--
-- Name: delivery_routes delivery_routes_route_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.delivery_routes
    ADD CONSTRAINT delivery_routes_route_code_key UNIQUE (route_code);


--
-- Name: demand_plans demand_plans_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.demand_plans
    ADD CONSTRAINT demand_plans_pkey PRIMARY KEY (demand_plan_id);


--
-- Name: forecast_sales_history forecast_sales_history_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.forecast_sales_history
    ADD CONSTRAINT forecast_sales_history_pkey PRIMARY KEY (sale_id);


--
-- Name: item_planning_policies item_planning_policies_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.item_planning_policies
    ADD CONSTRAINT item_planning_policies_pkey PRIMARY KEY (item_id);


--
-- Name: items items_item_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.items
    ADD CONSTRAINT items_item_code_key UNIQUE (item_code);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (item_id);


--
-- Name: mps_lines mps_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mps_lines
    ADD CONSTRAINT mps_lines_pkey PRIMARY KEY (mps_line_id);


--
-- Name: mrp_lines mrp_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mrp_lines
    ADD CONSTRAINT mrp_lines_pkey PRIMARY KEY (mrp_line_id);


--
-- Name: on_hand_balances on_hand_balances_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.on_hand_balances
    ADD CONSTRAINT on_hand_balances_pkey PRIMARY KEY (balance_id);


--
-- Name: planning_periods planning_periods_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.planning_periods
    ADD CONSTRAINT planning_periods_pkey PRIMARY KEY (period_id);


--
-- Name: planning_scenarios planning_scenarios_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.planning_scenarios
    ADD CONSTRAINT planning_scenarios_pkey PRIMARY KEY (scenario_id);


--
-- Name: planning_scenarios planning_scenarios_scenario_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.planning_scenarios
    ADD CONSTRAINT planning_scenarios_scenario_code_key UNIQUE (scenario_code);


--
-- Name: product_families product_families_family_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.product_families
    ADD CONSTRAINT product_families_family_code_key UNIQUE (family_code);


--
-- Name: product_families product_families_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.product_families
    ADD CONSTRAINT product_families_pkey PRIMARY KEY (family_id);


--
-- Name: production_schedule_lines production_schedule_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.production_schedule_lines
    ADD CONSTRAINT production_schedule_lines_pkey PRIMARY KEY (schedule_line_id);


--
-- Name: rccp_lines rccp_lines_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.rccp_lines
    ADD CONSTRAINT rccp_lines_pkey PRIMARY KEY (rccp_line_id);


--
-- Name: route_stores route_stores_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.route_stores
    ADD CONSTRAINT route_stores_pkey PRIMARY KEY (route_id, store_id);


--
-- Name: routing_operations routing_operations_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.routing_operations
    ADD CONSTRAINT routing_operations_pkey PRIMARY KEY (routing_operation_id);


--
-- Name: scheduled_receipts scheduled_receipts_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.scheduled_receipts
    ADD CONSTRAINT scheduled_receipts_pkey PRIMARY KEY (receipt_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);


--
-- Name: stores stores_store_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.stores
    ADD CONSTRAINT stores_store_code_key UNIQUE (store_code);


--
-- Name: uoms uoms_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.uoms
    ADD CONSTRAINT uoms_code_key UNIQUE (code);


--
-- Name: uoms uoms_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.uoms
    ADD CONSTRAINT uoms_pkey PRIMARY KEY (uom_id);


--
-- Name: bol_lines uq_bol_lines_version_item_wc; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_lines
    ADD CONSTRAINT uq_bol_lines_version_item_wc UNIQUE (bol_version_id, item_id, work_center_id);


--
-- Name: bom_lines uq_bom_lines_version_component; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_lines
    ADD CONSTRAINT uq_bom_lines_version_component UNIQUE (bom_version_id, component_item_id);


--
-- Name: bom_versions uq_bom_versions_parent_version; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_versions
    ADD CONSTRAINT uq_bom_versions_parent_version UNIQUE (parent_item_id, version_code);


--
-- Name: demand_plans uq_demand_plans_scenario_item_period; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.demand_plans
    ADD CONSTRAINT uq_demand_plans_scenario_item_period UNIQUE (scenario_id, item_id, period_id);


--
-- Name: mps_lines uq_mps_lines_scenario_item_period; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mps_lines
    ADD CONSTRAINT uq_mps_lines_scenario_item_period UNIQUE (scenario_id, item_id, period_id);


--
-- Name: mrp_lines uq_mrp_lines_scenario_item_period; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mrp_lines
    ADD CONSTRAINT uq_mrp_lines_scenario_item_period UNIQUE (scenario_id, item_id, period_id);


--
-- Name: on_hand_balances uq_on_hand_balances_scenario_item_period_type; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.on_hand_balances
    ADD CONSTRAINT uq_on_hand_balances_scenario_item_period_type UNIQUE (scenario_id, item_id, period_id, balance_type);


--
-- Name: planning_periods uq_planning_periods_scenario_code; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.planning_periods
    ADD CONSTRAINT uq_planning_periods_scenario_code UNIQUE (scenario_id, period_code);


--
-- Name: planning_periods uq_planning_periods_scenario_sequence; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.planning_periods
    ADD CONSTRAINT uq_planning_periods_scenario_sequence UNIQUE (scenario_id, sequence_no);


--
-- Name: rccp_lines uq_rccp_lines_scenario_wc_period; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.rccp_lines
    ADD CONSTRAINT uq_rccp_lines_scenario_wc_period UNIQUE (scenario_id, work_center_id, period_id);


--
-- Name: route_stores uq_route_stores_route_sequence; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.route_stores
    ADD CONSTRAINT uq_route_stores_route_sequence UNIQUE (route_id, sequence_no);


--
-- Name: routing_operations uq_routing_operations_item_operation; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.routing_operations
    ADD CONSTRAINT uq_routing_operations_item_operation UNIQUE (item_id, operation_no);


--
-- Name: scheduled_receipts uq_scheduled_receipts_ref; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.scheduled_receipts
    ADD CONSTRAINT uq_scheduled_receipts_ref UNIQUE (scenario_id, item_id, period_id, receipt_type, reference_no);


--
-- Name: work_center_period_capacity uq_work_center_period_capacity; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.work_center_period_capacity
    ADD CONSTRAINT uq_work_center_period_capacity UNIQUE (work_center_id, period_id);


--
-- Name: work_center_period_capacity work_center_period_capacity_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.work_center_period_capacity
    ADD CONSTRAINT work_center_period_capacity_pkey PRIMARY KEY (capacity_id);


--
-- Name: work_centers work_centers_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.work_centers
    ADD CONSTRAINT work_centers_pkey PRIMARY KEY (work_center_id);


--
-- Name: work_centers work_centers_work_center_code_key; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.work_centers
    ADD CONSTRAINT work_centers_work_center_code_key UNIQUE (work_center_code);


--
-- Name: workbook_imports workbook_imports_pkey; Type: CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.workbook_imports
    ADD CONSTRAINT workbook_imports_pkey PRIMARY KEY (import_id);


--
-- Name: app_users_username_lower_idx; Type: INDEX; Schema: dss; Owner: -
--

CREATE UNIQUE INDEX app_users_username_lower_idx ON dss.app_users USING btree (lower((username)::text));


--
-- Name: idx_bol_lines_work_center; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_bol_lines_work_center ON dss.bol_lines USING btree (work_center_id);


--
-- Name: idx_bom_lines_component; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_bom_lines_component ON dss.bom_lines USING btree (component_item_id);


--
-- Name: idx_crp_lines_item_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_crp_lines_item_period ON dss.crp_lines USING btree (item_id, period_id);


--
-- Name: idx_crp_lines_scenario_wc_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_crp_lines_scenario_wc_period ON dss.crp_lines USING btree (scenario_id, work_center_id, period_id);


--
-- Name: idx_demand_plans_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_demand_plans_period ON dss.demand_plans USING btree (period_id);


--
-- Name: idx_forecast_sales_history_product_date; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_forecast_sales_history_product_date ON dss.forecast_sales_history USING btree (id_product, tanggal);


--
-- Name: idx_items_family; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_items_family ON dss.items USING btree (family_id);


--
-- Name: idx_items_type; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_items_type ON dss.items USING btree (item_type);


--
-- Name: idx_mps_lines_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_mps_lines_period ON dss.mps_lines USING btree (period_id);


--
-- Name: idx_mrp_lines_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_mrp_lines_period ON dss.mrp_lines USING btree (period_id);


--
-- Name: idx_production_schedule_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_production_schedule_period ON dss.production_schedule_lines USING btree (period_id);


--
-- Name: idx_rccp_lines_period; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_rccp_lines_period ON dss.rccp_lines USING btree (period_id);


--
-- Name: idx_routing_operations_work_center; Type: INDEX; Schema: dss; Owner: -
--

CREATE INDEX idx_routing_operations_work_center ON dss.routing_operations USING btree (work_center_id);


--
-- Name: bol_lines bol_lines_bol_version_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_lines
    ADD CONSTRAINT bol_lines_bol_version_id_fkey FOREIGN KEY (bol_version_id) REFERENCES dss.bol_versions(bol_version_id) ON DELETE CASCADE;


--
-- Name: bol_lines bol_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_lines
    ADD CONSTRAINT bol_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: bol_lines bol_lines_work_center_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bol_lines
    ADD CONSTRAINT bol_lines_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES dss.work_centers(work_center_id) ON DELETE RESTRICT;


--
-- Name: bom_lines bom_lines_bom_version_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_lines
    ADD CONSTRAINT bom_lines_bom_version_id_fkey FOREIGN KEY (bom_version_id) REFERENCES dss.bom_versions(bom_version_id) ON DELETE CASCADE;


--
-- Name: bom_lines bom_lines_component_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_lines
    ADD CONSTRAINT bom_lines_component_item_id_fkey FOREIGN KEY (component_item_id) REFERENCES dss.items(item_id) ON DELETE RESTRICT;


--
-- Name: bom_versions bom_versions_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.bom_versions
    ADD CONSTRAINT bom_versions_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: crp_lines crp_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.crp_lines
    ADD CONSTRAINT crp_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: crp_lines crp_lines_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.crp_lines
    ADD CONSTRAINT crp_lines_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: crp_lines crp_lines_routing_operation_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.crp_lines
    ADD CONSTRAINT crp_lines_routing_operation_id_fkey FOREIGN KEY (routing_operation_id) REFERENCES dss.routing_operations(routing_operation_id) ON DELETE SET NULL;


--
-- Name: crp_lines crp_lines_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.crp_lines
    ADD CONSTRAINT crp_lines_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: crp_lines crp_lines_work_center_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.crp_lines
    ADD CONSTRAINT crp_lines_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES dss.work_centers(work_center_id) ON DELETE CASCADE;


--
-- Name: demand_plans demand_plans_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.demand_plans
    ADD CONSTRAINT demand_plans_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: demand_plans demand_plans_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.demand_plans
    ADD CONSTRAINT demand_plans_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: demand_plans demand_plans_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.demand_plans
    ADD CONSTRAINT demand_plans_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: item_planning_policies item_planning_policies_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.item_planning_policies
    ADD CONSTRAINT item_planning_policies_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: items items_family_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.items
    ADD CONSTRAINT items_family_id_fkey FOREIGN KEY (family_id) REFERENCES dss.product_families(family_id) ON DELETE SET NULL;


--
-- Name: items items_uom_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.items
    ADD CONSTRAINT items_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES dss.uoms(uom_id) ON DELETE RESTRICT;


--
-- Name: mps_lines mps_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mps_lines
    ADD CONSTRAINT mps_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: mps_lines mps_lines_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mps_lines
    ADD CONSTRAINT mps_lines_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: mps_lines mps_lines_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mps_lines
    ADD CONSTRAINT mps_lines_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: mrp_lines mrp_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mrp_lines
    ADD CONSTRAINT mrp_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: mrp_lines mrp_lines_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mrp_lines
    ADD CONSTRAINT mrp_lines_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: mrp_lines mrp_lines_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.mrp_lines
    ADD CONSTRAINT mrp_lines_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: on_hand_balances on_hand_balances_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.on_hand_balances
    ADD CONSTRAINT on_hand_balances_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: on_hand_balances on_hand_balances_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.on_hand_balances
    ADD CONSTRAINT on_hand_balances_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: on_hand_balances on_hand_balances_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.on_hand_balances
    ADD CONSTRAINT on_hand_balances_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: planning_periods planning_periods_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.planning_periods
    ADD CONSTRAINT planning_periods_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: production_schedule_lines production_schedule_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.production_schedule_lines
    ADD CONSTRAINT production_schedule_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: production_schedule_lines production_schedule_lines_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.production_schedule_lines
    ADD CONSTRAINT production_schedule_lines_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: production_schedule_lines production_schedule_lines_route_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.production_schedule_lines
    ADD CONSTRAINT production_schedule_lines_route_id_fkey FOREIGN KEY (route_id) REFERENCES dss.delivery_routes(route_id) ON DELETE SET NULL;


--
-- Name: production_schedule_lines production_schedule_lines_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.production_schedule_lines
    ADD CONSTRAINT production_schedule_lines_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: rccp_lines rccp_lines_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.rccp_lines
    ADD CONSTRAINT rccp_lines_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: rccp_lines rccp_lines_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.rccp_lines
    ADD CONSTRAINT rccp_lines_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: rccp_lines rccp_lines_work_center_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.rccp_lines
    ADD CONSTRAINT rccp_lines_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES dss.work_centers(work_center_id) ON DELETE CASCADE;


--
-- Name: route_stores route_stores_route_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.route_stores
    ADD CONSTRAINT route_stores_route_id_fkey FOREIGN KEY (route_id) REFERENCES dss.delivery_routes(route_id) ON DELETE CASCADE;


--
-- Name: route_stores route_stores_store_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.route_stores
    ADD CONSTRAINT route_stores_store_id_fkey FOREIGN KEY (store_id) REFERENCES dss.stores(store_id) ON DELETE CASCADE;


--
-- Name: routing_operations routing_operations_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.routing_operations
    ADD CONSTRAINT routing_operations_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: routing_operations routing_operations_work_center_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.routing_operations
    ADD CONSTRAINT routing_operations_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES dss.work_centers(work_center_id) ON DELETE RESTRICT;


--
-- Name: scheduled_receipts scheduled_receipts_item_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.scheduled_receipts
    ADD CONSTRAINT scheduled_receipts_item_id_fkey FOREIGN KEY (item_id) REFERENCES dss.items(item_id) ON DELETE CASCADE;


--
-- Name: scheduled_receipts scheduled_receipts_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.scheduled_receipts
    ADD CONSTRAINT scheduled_receipts_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: scheduled_receipts scheduled_receipts_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.scheduled_receipts
    ADD CONSTRAINT scheduled_receipts_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE CASCADE;


--
-- Name: work_center_period_capacity work_center_period_capacity_period_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.work_center_period_capacity
    ADD CONSTRAINT work_center_period_capacity_period_id_fkey FOREIGN KEY (period_id) REFERENCES dss.planning_periods(period_id) ON DELETE CASCADE;


--
-- Name: work_center_period_capacity work_center_period_capacity_work_center_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.work_center_period_capacity
    ADD CONSTRAINT work_center_period_capacity_work_center_id_fkey FOREIGN KEY (work_center_id) REFERENCES dss.work_centers(work_center_id) ON DELETE CASCADE;


--
-- Name: workbook_imports workbook_imports_scenario_id_fkey; Type: FK CONSTRAINT; Schema: dss; Owner: -
--

ALTER TABLE ONLY dss.workbook_imports
    ADD CONSTRAINT workbook_imports_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES dss.planning_scenarios(scenario_id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 2WbTTm4TKItC6tivK9Blnaa4fenNogjHMZ8ebyvhek48I2zd9utHHqbBSWI2oY9

