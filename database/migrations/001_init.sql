-- SQL dump generated using DBML (dbml.dbdiagram.io)
-- Database: PostgreSQL
-- Generated at: 2026-10-07T11:51:51.719Z

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "email" varchar(255) NOT NULL,
  "email_normalized" varchar(255) UNIQUE NOT NULL,
  "phone" varchar(20) UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "full_name" varchar(120) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "email_verified_at" timestamptz,
  "phone_verified_at" timestamptz,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "code" varchar(50) UNIQUE NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" varchar(255),
  "is_active" boolean NOT NULL DEFAULT true
);

CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "assigned_by" uuid,
  "assigned_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "addresses" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "label" varchar(50),
  "recipient_name" varchar(120) NOT NULL,
  "recipient_phone" varchar(20) NOT NULL,
  "address_line" varchar(255) NOT NULL,
  "ward_name" varchar(120),
  "district_name" varchar(120),
  "province_name" varchar(120) NOT NULL,
  "postal_code" varchar(20),
  "country_code" char(2) NOT NULL DEFAULT 'VN',
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "refresh_token_hash" varchar(255) UNIQUE NOT NULL,
  "ip_address" varchar(64),
  "user_agent" varchar(255),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "account_tokens" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "purpose" varchar(30) NOT NULL,
  "token_hash" varchar(255) UNIQUE NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "file_assets" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "uploaded_by" uuid,
  "storage_provider" varchar(30) NOT NULL,
  "bucket_name" varchar(120),
  "object_key" varchar(500) NOT NULL,
  "secure_url" text NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "file_extension" varchar(20) NOT NULL,
  "mime_type" varchar(120) NOT NULL,
  "byte_size" bigint NOT NULL,
  "sha256" char(64) NOT NULL,
  "access_level" varchar(20) NOT NULL DEFAULT 'PRIVATE',
  "upload_status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "malware_scan_status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "attachments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "file_asset_id" uuid NOT NULL,
  "entity_type" varchar(40) NOT NULL,
  "entity_id" uuid NOT NULL,
  "purpose" varchar(40),
  "is_primary" boolean NOT NULL DEFAULT false,
  "is_current" boolean NOT NULL DEFAULT true,
  "sort_order" int NOT NULL DEFAULT 0,
  "uploaded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "parent_id" uuid,
  "name" varchar(120) NOT NULL,
  "slug" varchar(140) UNIQUE NOT NULL,
  "description" text,
  "sort_order" int NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true
);

CREATE TABLE "materials" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "material_code" varchar(50) UNIQUE NOT NULL,
  "technology" varchar(10) NOT NULL,
  "material_type" varchar(30) NOT NULL,
  "manufacturer" varchar(120),
  "product_name" varchar(160),
  "color_name" varchar(60) NOT NULL,
  "color_hex" char(7),
  "inventory_unit" varchar(10) NOT NULL,
  "unit_cost" numeric(12,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "category_id" uuid NOT NULL,
  "created_by" uuid,
  "product_code" varchar(50) UNIQUE NOT NULL,
  "model_code" varchar(80) UNIQUE,
  "name" varchar(200) NOT NULL,
  "slug" varchar(220) UNIQUE NOT NULL,
  "short_description" varchar(300),
  "description" text,
  "compatibility_note" text,
  "product_source_type" varchar(30) NOT NULL,
  "production_mode" varchar(20) NOT NULL,
  "publication_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "compliance_status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "compliance_reviewed_by" uuid,
  "compliance_reviewed_at" timestamptz,
  "compliance_evidence_file_id" uuid,
  "compliance_reference_url" text,
  "compliance_notes" text,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "product_id" uuid NOT NULL,
  "default_material_id" uuid,
  "sku" varchar(60) UNIQUE NOT NULL,
  "variant_name" varchar(160) NOT NULL,
  "color_name" varchar(60),
  "length_mm" numeric(10,2),
  "width_mm" numeric(10,2),
  "height_mm" numeric(10,2),
  "weight_grams" numeric(10,2),
  "sale_price" numeric(12,2) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "stock_movements" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "stock_type" varchar(20) NOT NULL,
  "item_id" uuid NOT NULL,
  "movement_type" varchar(30) NOT NULL,
  "quantity_change" numeric(12,3) NOT NULL,
  "unit" varchar(10),
  "reference_type" varchar(30),
  "reference_id" uuid,
  "unit_cost_snapshot" numeric(12,4),
  "performed_by" uuid,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "print_requests" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "request_number" varchar(40) UNIQUE NOT NULL,
  "customer_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "customer_note" text,
  "rights_declaration_accepted" boolean NOT NULL DEFAULT false,
  "rights_declared_at" timestamptz,
  "submitted_at" timestamptz,
  "closed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "print_request_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "print_request_id" uuid NOT NULL,
  "item_number" int NOT NULL,
  "item_name" varchar(160) NOT NULL,
  "requested_quantity" int NOT NULL DEFAULT 1,
  "customer_note" text,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING_FILE'
);

CREATE TABLE "file_inspections" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "print_request_item_id" uuid NOT NULL,
  "attachment_id" uuid NOT NULL,
  "inspected_by" uuid NOT NULL,
  "status" varchar(30) NOT NULL,
  "detected_length_mm" numeric(10,2),
  "detected_width_mm" numeric(10,2),
  "detected_height_mm" numeric(10,2),
  "issue_summary" text,
  "internal_note" text,
  "inspected_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "print_specifications" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "print_request_item_id" uuid NOT NULL,
  "attachment_id" uuid NOT NULL,
  "material_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "revision_number" int NOT NULL DEFAULT 1,
  "source_file_sha256" char(64) NOT NULL,
  "final_length_mm" numeric(10,2) NOT NULL,
  "final_width_mm" numeric(10,2) NOT NULL,
  "final_height_mm" numeric(10,2) NOT NULL,
  "scale_percent" numeric(6,2) NOT NULL DEFAULT 100,
  "quantity" int NOT NULL,
  "color_name_snapshot" varchar(60),
  "layer_height_mm" numeric(6,3),
  "infill_percent" numeric(5,2),
  "support_required" boolean NOT NULL DEFAULT false,
  "surface_quality_note" text,
  "strength_note" text,
  "tolerance_note" text,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "quotes" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "quote_number" varchar(40) UNIQUE NOT NULL,
  "print_request_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "revision_number" int NOT NULL DEFAULT 1,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "currency" char(3) NOT NULL DEFAULT 'VND',
  "subtotal" numeric(14,2) NOT NULL,
  "discount_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "shipping_estimate" numeric(14,2) NOT NULL DEFAULT 0,
  "tax_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "grand_total" numeric(14,2) NOT NULL,
  "required_deposit_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "valid_until" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "quote_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "quote_id" uuid NOT NULL,
  "print_specification_id" uuid,
  "line_number" int NOT NULL,
  "line_type" varchar(20) NOT NULL,
  "description" varchar(255) NOT NULL,
  "quantity" numeric(10,2) NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "line_total" numeric(14,2) NOT NULL
);

CREATE TABLE "customer_approvals" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "customer_id" uuid NOT NULL,
  "print_request_id" uuid NOT NULL,
  "quote_id" uuid NOT NULL,
  "recorded_by" uuid,
  "approval_status" varchar(20) NOT NULL,
  "approved_file_hashes" jsonb NOT NULL,
  "specification_snapshot" jsonb NOT NULL,
  "quote_snapshot" jsonb NOT NULL,
  "terms_version_code" varchar(40) NOT NULL,
  "terms_content_sha256" char(64) NOT NULL,
  "rights_declaration_accepted" boolean NOT NULL,
  "ip_address" varchar(64),
  "user_agent" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "carts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "customer_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "cart_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "cart_id" uuid NOT NULL,
  "product_variant_id" uuid NOT NULL,
  "quantity" int NOT NULL,
  "added_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "order_number" varchar(40) UNIQUE NOT NULL,
  "customer_id" uuid,
  "customer_name_snapshot" varchar(120) NOT NULL,
  "customer_email_snapshot" varchar(255) NOT NULL,
  "customer_phone_snapshot" varchar(20) NOT NULL,
  "shipping_recipient_name" varchar(120) NOT NULL,
  "shipping_recipient_phone" varchar(20) NOT NULL,
  "shipping_address_line" varchar(255) NOT NULL,
  "shipping_ward_name" varchar(120),
  "shipping_district_name" varchar(120),
  "shipping_province_name" varchar(120) NOT NULL,
  "shipping_postal_code" varchar(20),
  "shipping_country_code" char(2) NOT NULL DEFAULT 'VN',
  "order_status" varchar(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
  "payment_status" varchar(30) NOT NULL DEFAULT 'UNPAID',
  "payment_timing" varchar(20) NOT NULL DEFAULT 'PREPAID',
  "currency" char(3) NOT NULL DEFAULT 'VND',
  "subtotal" numeric(14,2) NOT NULL,
  "discount_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "shipping_fee" numeric(14,2) NOT NULL DEFAULT 0,
  "tax_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "grand_total" numeric(14,2) NOT NULL,
  "required_deposit_amount" numeric(14,2) NOT NULL DEFAULT 0,
  "customer_note" text,
  "internal_note" text,
  "placed_at" timestamptz NOT NULL DEFAULT (now()),
  "cancelled_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "order_items" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "order_id" uuid NOT NULL,
  "product_variant_id" uuid,
  "print_specification_id" uuid,
  "item_type" varchar(20) NOT NULL,
  "item_name_snapshot" varchar(200) NOT NULL,
  "sku_snapshot" varchar(60),
  "material_snapshot" varchar(80),
  "color_snapshot" varchar(60),
  "specification_snapshot" jsonb,
  "quantity" int NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "discount_amount" numeric(12,2) NOT NULL DEFAULT 0,
  "line_total" numeric(14,2) NOT NULL
);

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "order_id" uuid NOT NULL,
  "payment_number" varchar(40) UNIQUE NOT NULL,
  "payment_method" varchar(30) NOT NULL,
  "payment_purpose" varchar(20) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" char(3) NOT NULL DEFAULT 'VND',
  "transaction_reference" varchar(120),
  "bank_name" varchar(120),
  "sender_account_name" varchar(160),
  "transferred_at" timestamptz,
  "verification_status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "verified_by" uuid,
  "verified_at" timestamptz,
  "rejection_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "refunds" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "payment_id" uuid NOT NULL,
  "processed_by" uuid NOT NULL,
  "refund_number" varchar(40) UNIQUE NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "transaction_reference" varchar(120),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "shipments" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "order_id" uuid NOT NULL,
  "shipment_number" varchar(40) UNIQUE NOT NULL,
  "carrier_name" varchar(120),
  "service_name" varchar(120),
  "tracking_number" varchar(120) UNIQUE,
  "shipping_fee" numeric(12,2),
  "status" varchar(20) NOT NULL DEFAULT 'PREPARING',
  "shipped_at" timestamptz,
  "expected_delivery_at" timestamptz,
  "delivered_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "printers" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "printer_code" varchar(30) UNIQUE NOT NULL,
  "name" varchar(120) NOT NULL,
  "technology" varchar(10) NOT NULL,
  "model" varchar(120),
  "hourly_cost" numeric(10,2),
  "status" varchar(20) NOT NULL DEFAULT 'AVAILABLE',
  "last_maintenance_at" timestamptz,
  "next_maintenance_at" timestamptz
);

CREATE TABLE "production_jobs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "job_number" varchar(40) UNIQUE NOT NULL,
  "order_item_id" uuid NOT NULL,
  "assigned_printer_id" uuid,
  "assigned_material_id" uuid,
  "assigned_operator_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'QUEUED',
  "planned_start_at" timestamptz,
  "planned_finish_at" timestamptz,
  "actual_start_at" timestamptz,
  "actual_finish_at" timestamptz,
  "internal_note" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "production_attempts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "production_job_id" uuid NOT NULL,
  "printer_id" uuid NOT NULL,
  "material_id" uuid NOT NULL,
  "operator_id" uuid NOT NULL,
  "source_attachment_id" uuid,
  "attempt_number" int NOT NULL DEFAULT 1,
  "source_file_sha256" char(64),
  "slicer_settings_snapshot" jsonb,
  "estimated_material_quantity" numeric(10,3),
  "actual_material_quantity" numeric(10,3),
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "result" varchar(20) NOT NULL DEFAULT 'RUNNING',
  "failure_type" varchar(80),
  "responsibility_group" varchar(20),
  "wasted_material_quantity" numeric(10,3),
  "resolution" text,
  "operator_note" text
);

CREATE TABLE "quality_inspections" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "production_job_id" uuid NOT NULL,
  "inspected_by" uuid NOT NULL,
  "result" varchar(20) NOT NULL,
  "measured_length_mm" numeric(10,2),
  "measured_width_mm" numeric(10,2),
  "measured_height_mm" numeric(10,2),
  "quantity_passed" int NOT NULL DEFAULT 0,
  "quantity_failed" int NOT NULL DEFAULT 0,
  "color_check_passed" boolean,
  "surface_check_passed" boolean,
  "assembly_check_passed" boolean,
  "notes" text,
  "inspected_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "status_history" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "entity_type" varchar(30) NOT NULL,
  "entity_id" uuid NOT NULL,
  "from_status" varchar(30),
  "to_status" varchar(30) NOT NULL,
  "changed_by" uuid,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "actor_user_id" uuid,
  "action" varchar(80) NOT NULL,
  "entity_type" varchar(40) NOT NULL,
  "entity_id" uuid NOT NULL,
  "old_values" jsonb,
  "new_values" jsonb,
  "ip_address" varchar(64),
  "user_agent" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX "idx_addresses_user_default" ON "addresses" ("user_id", "is_default");

CREATE UNIQUE INDEX "uq_file_assets_object_key" ON "file_assets" ("storage_provider", "object_key");

CREATE INDEX "idx_file_assets_sha256" ON "file_assets" ("sha256");

CREATE INDEX "idx_attachments_entity" ON "attachments" ("entity_type", "entity_id", "sort_order");

CREATE INDEX "idx_materials_technology_type" ON "materials" ("technology", "material_type", "status");

CREATE INDEX "idx_products_category_publication" ON "products" ("category_id", "publication_status");

CREATE INDEX "idx_products_compliance_status" ON "products" ("compliance_status");

CREATE INDEX "idx_stock_movements_item" ON "stock_movements" ("stock_type", "item_id", "created_at");

CREATE UNIQUE INDEX "uq_print_request_items_number" ON "print_request_items" ("print_request_id", "item_number");

CREATE UNIQUE INDEX "uq_print_specifications_revision" ON "print_specifications" ("print_request_item_id", "revision_number");

CREATE UNIQUE INDEX "uq_quotes_revision" ON "quotes" ("print_request_id", "revision_number");

CREATE UNIQUE INDEX "uq_quote_items_line" ON "quote_items" ("quote_id", "line_number");

CREATE INDEX "idx_carts_customer_status" ON "carts" ("customer_id", "status");

CREATE INDEX "idx_orders_customer_created" ON "orders" ("customer_id", "created_at");

CREATE INDEX "idx_orders_status_created" ON "orders" ("order_status", "created_at");

CREATE INDEX "idx_orders_payment_status" ON "orders" ("payment_status");

CREATE INDEX "idx_payments_order_verification" ON "payments" ("order_id", "verification_status");

CREATE INDEX "idx_payments_transaction_reference" ON "payments" ("transaction_reference");

CREATE UNIQUE INDEX "uq_production_attempts_number" ON "production_attempts" ("production_job_id", "attempt_number");

CREATE INDEX "idx_status_history_entity" ON "status_history" ("entity_type", "entity_id", "created_at");

CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "created_at");

COMMENT ON COLUMN "users"."email_normalized" IS 'lowercase+trim(email), computed by app, never user-editable';

COMMENT ON COLUMN "users"."status" IS 'PENDING, ACTIVE, LOCKED, DISABLED';

COMMENT ON COLUMN "roles"."code" IS 'CUSTOMER, STAFF, FILE_REVIEWER, PRINT_OPERATOR, ADMIN';

COMMENT ON COLUMN "account_tokens"."purpose" IS 'EMAIL_VERIFICATION, PASSWORD_RESET';

COMMENT ON COLUMN "file_assets"."storage_provider" IS 'CLOUDINARY, CLOUDFLARE_R2, LOCAL_DEV';

COMMENT ON COLUMN "file_assets"."access_level" IS 'PUBLIC, PRIVATE, INTERNAL';

COMMENT ON COLUMN "file_assets"."upload_status" IS 'PENDING, AVAILABLE, QUARANTINED, FAILED, DELETED';

COMMENT ON COLUMN "file_assets"."malware_scan_status" IS 'PENDING, CLEAN, INFECTED, FAILED';

COMMENT ON TABLE "attachments" IS 'Replaces v1''s product_images, product_variant_files, print_request_files,
payment_proofs, and quality_inspection_files. No FK on (entity_type, entity_id) —
polymorphic association, enforced at the application layer.
Partial-uniqueness rules enforced by the app, not the DB:
- at most one is_primary=true per (entity_type=''PRODUCT'', entity_id)
- at most one is_current=true per (entity_type=''PRINT_REQUEST_ITEM'', entity_id)
';

COMMENT ON COLUMN "attachments"."entity_type" IS 'PRODUCT, PRODUCT_VARIANT, PRINT_REQUEST_ITEM, PAYMENT, QUALITY_INSPECTION,
PRODUCTION_ATTEMPT — extend this list freely; no schema change needed for a new kind
';

COMMENT ON COLUMN "attachments"."purpose" IS 'Meaning depends on entity_type. Common values:
PRODUCT → GALLERY_IMAGE
PRODUCT_VARIANT → PRODUCTION_MODEL, SLICER_PROJECT, ASSEMBLY_GUIDE
PRINT_REQUEST_ITEM → ORIGINAL_UPLOAD, CUSTOMER_REUPLOAD
PAYMENT → PAYMENT_PROOF
QUALITY_INSPECTION → QC_EVIDENCE
';

COMMENT ON COLUMN "attachments"."is_primary" IS 'e.g. primary product image';

COMMENT ON COLUMN "attachments"."is_current" IS 'e.g. latest file for a print_request_item — older ones flip to false';

COMMENT ON COLUMN "materials"."technology" IS 'FDM or SLA';

COMMENT ON COLUMN "materials"."material_type" IS 'PLA, PETG, ABS, TPU, RESIN, ...';

COMMENT ON COLUMN "materials"."inventory_unit" IS 'GRAM (filament spools) or ML (resin, priced/tracked by weight per 1000g in practice — see stock_movements.unit)';

COMMENT ON COLUMN "materials"."status" IS 'ACTIVE, INACTIVE, DISCONTINUED';

COMMENT ON TABLE "products" IS 'Publish only when compliance_status = APPROVED. Compliance is tracked as the
latest decision only (no separate history table — see status_history if a full
audit trail of compliance decisions is ever needed instead of just audit_logs).
Gallery images live in `attachments` (entity_type=''PRODUCT'').
';

COMMENT ON COLUMN "products"."model_code" IS 'Code of the ORIGINAL device/model this product fits or replaces (not MinhLab''s own
code). Only used for FUNCTIONAL_REPLACEMENT items, e.g. a replacement part for a
toy model "WHITE-B-DAMAN". Null for original designs.
';

COMMENT ON COLUMN "products"."compatibility_note" IS 'Required when model_code is set — must state this is an unofficial/compatible part, not the licensed original';

COMMENT ON COLUMN "products"."product_source_type" IS 'ORIGINAL, LICENSED, PUBLIC_DOMAIN, FUNCTIONAL_REPLACEMENT';

COMMENT ON COLUMN "products"."production_mode" IS 'IN_STOCK or MADE_TO_ORDER';

COMMENT ON COLUMN "products"."publication_status" IS 'DRAFT, PUBLISHED, HIDDEN, ARCHIVED';

COMMENT ON COLUMN "products"."compliance_status" IS 'PENDING, APPROVED, REJECTED, NEEDS_REVIEW';

COMMENT ON TABLE "product_variants" IS 'Production files (STL/slicer project/assembly guide) live in `attachments` (entity_type=''PRODUCT_VARIANT'').';

COMMENT ON COLUMN "product_variants"."length_mm" IS '>= 0';

COMMENT ON COLUMN "product_variants"."width_mm" IS '>= 0';

COMMENT ON COLUMN "product_variants"."height_mm" IS '>= 0';

COMMENT ON COLUMN "product_variants"."weight_grams" IS '>= 0';

COMMENT ON COLUMN "product_variants"."sale_price" IS '>= 0';

COMMENT ON COLUMN "product_variants"."status" IS 'ACTIVE, INACTIVE, OUT_OF_STOCK';

COMMENT ON TABLE "stock_movements" IS 'Replaces v1''s inventory_movements + material_inventory_movements. Append-only.
Current stock on hand = SUM(quantity_change) for that (stock_type, item_id); the
app must never let this go negative.
';

COMMENT ON COLUMN "stock_movements"."stock_type" IS 'PRODUCT_VARIANT or MATERIAL';

COMMENT ON COLUMN "stock_movements"."item_id" IS 'FK to product_variants.id or materials.id depending on stock_type — polymorphic, no DB-level FK';

COMMENT ON COLUMN "stock_movements"."movement_type" IS 'Product: PRODUCTION_IN, SALE_OUT, RETURN_IN, DAMAGE_OUT
Material: PURCHASE_IN, PRINT_USAGE_OUT, WASTE_OUT
Either: ADJUSTMENT_IN, ADJUSTMENT_OUT
';

COMMENT ON COLUMN "stock_movements"."quantity_change" IS 'positive = in, negative = out';

COMMENT ON COLUMN "stock_movements"."unit" IS 'snapshot of the unit at the time (PIECE / GRAM / ML) for historical accuracy';

COMMENT ON COLUMN "stock_movements"."reference_type" IS 'ORDER_ITEM, PRODUCTION_ATTEMPT, PURCHASE, ADJUSTMENT';

COMMENT ON COLUMN "stock_movements"."unit_cost_snapshot" IS 'used for PURCHASE_IN valuation';

COMMENT ON COLUMN "stock_movements"."reason" IS 'required for ADJUSTMENT_*';

COMMENT ON COLUMN "print_requests"."status" IS 'DRAFT, SUBMITTED, UNDER_REVIEW, NEEDS_REUPLOAD, QUOTED, APPROVED, ORDERED, REJECTED, CANCELLED';

COMMENT ON COLUMN "print_requests"."rights_declaration_accepted" IS 'customer confirms they have the right to have this file printed';

COMMENT ON TABLE "print_request_items" IS 'Uploaded files live in `attachments` (entity_type=''PRINT_REQUEST_ITEM'').';

COMMENT ON COLUMN "print_request_items"."requested_quantity" IS '> 0';

COMMENT ON COLUMN "print_request_items"."status" IS 'PENDING_FILE, UNDER_REVIEW, NEEDS_REUPLOAD, PRINTABLE, REJECTED, SPECIFIED';

COMMENT ON TABLE "file_inspections" IS 'Records the outcome of checking printability only — MinhLab does not edit the customer''s geometry.';

COMMENT ON COLUMN "file_inspections"."attachment_id" IS 'the specific uploaded file (attachments row) that was inspected';

COMMENT ON COLUMN "file_inspections"."status" IS 'PRINTABLE, NEEDS_CUSTOMER_REUPLOAD, REJECTED';

COMMENT ON COLUMN "file_inspections"."issue_summary" IS 'shown to customer';

COMMENT ON COLUMN "file_inspections"."internal_note" IS 'staff-only';

COMMENT ON TABLE "print_specifications" IS 'Once status = APPROVED the row is immutable; a change creates a new revision and flips the old row to SUPERSEDED.';

COMMENT ON COLUMN "print_specifications"."attachment_id" IS 'the approved-for-production file';

COMMENT ON COLUMN "print_specifications"."source_file_sha256" IS 'snapshot copied from the linked file_assets.sha256 at the time this spec was made';

COMMENT ON COLUMN "print_specifications"."final_length_mm" IS '> 0';

COMMENT ON COLUMN "print_specifications"."final_width_mm" IS '> 0';

COMMENT ON COLUMN "print_specifications"."final_height_mm" IS '> 0';

COMMENT ON COLUMN "print_specifications"."scale_percent" IS '> 0';

COMMENT ON COLUMN "print_specifications"."quantity" IS '> 0';

COMMENT ON COLUMN "print_specifications"."infill_percent" IS '0–100';

COMMENT ON COLUMN "print_specifications"."status" IS 'DRAFT, SENT_FOR_APPROVAL, APPROVED, SUPERSEDED';

COMMENT ON COLUMN "quotes"."status" IS 'DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, SUPERSEDED';

COMMENT ON COLUMN "quote_items"."print_specification_id" IS 'set when line_type = PRINT_ITEM';

COMMENT ON COLUMN "quote_items"."line_type" IS 'PRINT_ITEM, MATERIAL, MACHINE_TIME, HANDLING, PACKAGING, SHIPPING, DISCOUNT';

COMMENT ON TABLE "customer_approvals" IS 'Append-only legal evidence. Replaces v1''s separate terms_versions table by embedding the terms reference directly.';

COMMENT ON COLUMN "customer_approvals"."recorded_by" IS 'set only when staff records an offline approval on the customer''s behalf';

COMMENT ON COLUMN "customer_approvals"."approval_status" IS 'APPROVED or REJECTED';

COMMENT ON COLUMN "customer_approvals"."approved_file_hashes" IS 'sha256 of every file the customer approved';

COMMENT ON COLUMN "customer_approvals"."terms_version_code" IS 'e.g. TOS-2026-01 — points at a terms document managed outside the DB';

COMMENT ON TABLE "carts" IS 'At most one ACTIVE cart per customer (enforced at app layer). Ready-made products only.';

COMMENT ON COLUMN "carts"."status" IS 'ACTIVE, CONVERTED, ABANDONED';

COMMENT ON COLUMN "cart_items"."quantity" IS '> 0';

COMMENT ON TABLE "orders" IS 'Shipping address is a point-in-time snapshot embedded directly (v1 had a separate
order_addresses table for this; folded in here since an order has exactly one
shipping destination).

COD flow: order_status may start at CONFIRMED (skip PENDING_PAYMENT). payment_status
stays UNPAID through production/shipping; a `payments` row (method=CASH) is only
created once cash is collected at delivery, then verified like any other payment.

All order_status / shipment status transitions are logged in `status_history`.
';

COMMENT ON COLUMN "orders"."customer_id" IS 'nullable — guest checkout for ready products';

COMMENT ON COLUMN "orders"."order_status" IS 'PENDING_PAYMENT, DEPOSIT_PAID, CONFIRMED, IN_PRODUCTION, READY_TO_SHIP, SHIPPED, COMPLETED, CANCELLED';

COMMENT ON COLUMN "orders"."payment_status" IS 'UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED';

COMMENT ON COLUMN "orders"."payment_timing" IS 'PREPAID or COD — COD only allowed when every order_item.item_type = READY_PRODUCT';

COMMENT ON COLUMN "order_items"."product_variant_id" IS 'set when item_type = READY_PRODUCT';

COMMENT ON COLUMN "order_items"."print_specification_id" IS 'set when item_type = CUSTOM_PRINT — exactly one of these two must be set';

COMMENT ON COLUMN "order_items"."item_type" IS 'READY_PRODUCT or CUSTOM_PRINT';

COMMENT ON COLUMN "order_items"."specification_snapshot" IS 'full print_specifications snapshot when CUSTOM_PRINT';

COMMENT ON COLUMN "order_items"."quantity" IS '> 0';

COMMENT ON TABLE "payments" IS 'Nothing auto-verifies a payment — staff must confirm receipt, even for VietQR.
COD: no row exists until cash is collected at delivery (method=CASH, purpose=
FULL_PAYMENT), then it goes through the same PENDING → VERIFIED flow.
Proof images live in `attachments` (entity_type=''PAYMENT'', purpose=''PAYMENT_PROOF'').
';

COMMENT ON COLUMN "payments"."payment_method" IS 'BANK_TRANSFER, VIETQR, CASH';

COMMENT ON COLUMN "payments"."payment_purpose" IS 'DEPOSIT, BALANCE, FULL_PAYMENT';

COMMENT ON COLUMN "payments"."amount" IS '> 0';

COMMENT ON COLUMN "payments"."transaction_reference" IS 'bank transfer content / reference, used to reconcile against the order_number';

COMMENT ON COLUMN "payments"."verification_status" IS 'PENDING, VERIFIED, REJECTED, REFUNDED';

COMMENT ON COLUMN "refunds"."amount" IS '> 0 and <= the verified amount remaining on the payment';

COMMENT ON COLUMN "refunds"."status" IS 'PENDING, COMPLETED, FAILED';

COMMENT ON TABLE "shipments" IS 'One shipment per order (MVP — no partial-shipment table; v1 had shipment_items for that case).';

COMMENT ON COLUMN "shipments"."status" IS 'PREPARING, HANDED_TO_CARRIER, IN_TRANSIT, DELIVERED, RETURNED, CANCELLED';

COMMENT ON COLUMN "printers"."technology" IS 'FDM or SLA';

COMMENT ON COLUMN "printers"."status" IS 'AVAILABLE, PRINTING, MAINTENANCE, OFFLINE, RETIRED';

COMMENT ON COLUMN "production_jobs"."status" IS 'QUEUED, PREPARING, PRINTING, POST_PROCESSING, QC_PENDING, COMPLETED, FAILED, CANCELLED';

COMMENT ON TABLE "production_attempts" IS 'Replaces v1''s print_runs + print_failures — one row per physical print attempt, failure fields filled in only when result = FAILED.';

COMMENT ON COLUMN "production_attempts"."source_attachment_id" IS 'the file actually sent to the slicer/printer';

COMMENT ON COLUMN "production_attempts"."source_file_sha256" IS 'for CUSTOM_PRINT jobs, must match the approved print_specifications file hash';

COMMENT ON COLUMN "production_attempts"."result" IS 'RUNNING, SUCCESS, FAILED, CANCELLED';

COMMENT ON COLUMN "production_attempts"."failure_type" IS 'set when result = FAILED, e.g. "Bong tróc đế", "Kẹt nhựa"';

COMMENT ON COLUMN "production_attempts"."responsibility_group" IS 'CUSTOMER_FILE, MACHINE, MATERIAL, OPERATOR, POWER, UNKNOWN — set when result = FAILED';

COMMENT ON COLUMN "production_attempts"."resolution" IS 'e.g. reprint scheduled, cancelled, customer notified';

COMMENT ON TABLE "quality_inspections" IS 'Evidence photos live in `attachments` (entity_type=''QUALITY_INSPECTION'', purpose=''QC_EVIDENCE'').';

COMMENT ON COLUMN "quality_inspections"."result" IS 'PASS, FAIL, REWORK';

COMMENT ON COLUMN "quality_inspections"."quantity_passed" IS '>= 0';

COMMENT ON COLUMN "quality_inspections"."quantity_failed" IS '>= 0, and quantity_passed + quantity_failed <= quantity produced';

COMMENT ON TABLE "status_history" IS 'Replaces v1''s order_status_history + shipment_status_history, and can log any other entity''s status changes without a new table. Append-only.';

COMMENT ON COLUMN "status_history"."entity_type" IS 'ORDER, SHIPMENT, PRINT_REQUEST, QUOTE, PRINT_SPECIFICATION — extend freely';

COMMENT ON COLUMN "status_history"."changed_by" IS 'null when the system changed it automatically';

COMMENT ON TABLE "audit_logs" IS 'Append-only. No FK on entity_id — polymorphic, same pattern as attachments/status_history/stock_movements.';

COMMENT ON COLUMN "audit_logs"."action" IS 'e.g. PAYMENT_VERIFIED, FILE_REJECTED, SPEC_APPROVED, QUOTE_REVISED, STOCK_ADJUSTED, COMPLIANCE_DECIDED';

ALTER TABLE "user_roles" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "user_roles" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "user_roles" ADD FOREIGN KEY ("assigned_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "addresses" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "auth_sessions" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "account_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "file_assets" ADD FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("file_asset_id") REFERENCES "file_assets" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "attachments" ADD FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "categories" ADD FOREIGN KEY ("parent_id") REFERENCES "categories" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "products" ADD FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "products" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "products" ADD FOREIGN KEY ("compliance_reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "products" ADD FOREIGN KEY ("compliance_evidence_file_id") REFERENCES "file_assets" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_variants" ADD FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "product_variants" ADD FOREIGN KEY ("default_material_id") REFERENCES "materials" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "stock_movements" ADD FOREIGN KEY ("performed_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "print_requests" ADD FOREIGN KEY ("customer_id") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "print_request_items" ADD FOREIGN KEY ("print_request_id") REFERENCES "print_requests" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "file_inspections" ADD FOREIGN KEY ("print_request_item_id") REFERENCES "print_request_items" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "file_inspections" ADD FOREIGN KEY ("attachment_id") REFERENCES "attachments" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "file_inspections" ADD FOREIGN KEY ("inspected_by") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "print_specifications" ADD FOREIGN KEY ("print_request_item_id") REFERENCES "print_request_items" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "print_specifications" ADD FOREIGN KEY ("attachment_id") REFERENCES "attachments" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "print_specifications" ADD FOREIGN KEY ("material_id") REFERENCES "materials" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "print_specifications" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "quotes" ADD FOREIGN KEY ("print_request_id") REFERENCES "print_requests" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "quotes" ADD FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "quote_items" ADD FOREIGN KEY ("quote_id") REFERENCES "quotes" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "quote_items" ADD FOREIGN KEY ("print_specification_id") REFERENCES "print_specifications" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "customer_approvals" ADD FOREIGN KEY ("customer_id") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "customer_approvals" ADD FOREIGN KEY ("print_request_id") REFERENCES "print_requests" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "customer_approvals" ADD FOREIGN KEY ("quote_id") REFERENCES "quotes" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "customer_approvals" ADD FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carts" ADD FOREIGN KEY ("customer_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cart_items" ADD FOREIGN KEY ("cart_id") REFERENCES "carts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cart_items" ADD FOREIGN KEY ("product_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "orders" ADD FOREIGN KEY ("customer_id") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "order_items" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "order_items" ADD FOREIGN KEY ("product_variant_id") REFERENCES "product_variants" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "order_items" ADD FOREIGN KEY ("print_specification_id") REFERENCES "print_specifications" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "payments" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "payments" ADD FOREIGN KEY ("verified_by") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refunds" ADD FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refunds" ADD FOREIGN KEY ("processed_by") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "shipments" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_jobs" ADD FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_jobs" ADD FOREIGN KEY ("assigned_printer_id") REFERENCES "printers" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_jobs" ADD FOREIGN KEY ("assigned_material_id") REFERENCES "materials" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_jobs" ADD FOREIGN KEY ("assigned_operator_id") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_attempts" ADD FOREIGN KEY ("production_job_id") REFERENCES "production_jobs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_attempts" ADD FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_attempts" ADD FOREIGN KEY ("material_id") REFERENCES "materials" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_attempts" ADD FOREIGN KEY ("operator_id") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "production_attempts" ADD FOREIGN KEY ("source_attachment_id") REFERENCES "attachments" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "quality_inspections" ADD FOREIGN KEY ("production_job_id") REFERENCES "production_jobs" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "quality_inspections" ADD FOREIGN KEY ("inspected_by") REFERENCES "users" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
