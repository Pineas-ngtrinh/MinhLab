async function grantRuntimePrivileges(client) {
    const statement=(await client.query("SELECT format('GRANT CONNECT ON DATABASE %I TO minhlab_app',current_database()) AS sql")).rows[0].sql;
    await client.query(statement);
    await client.query('GRANT USAGE ON SCHEMA public TO minhlab_app; GRANT SELECT ON ALL TABLES IN SCHEMA public TO minhlab_app');
    await client.query(`GRANT INSERT ON users,roles,user_roles,auth_sessions,account_tokens,auth_login_attempts,
      orders,order_items,payments,status_history,audit_logs,file_assets,attachments,email_outbox,telegram_outbox,order_tracking_tokens,order_return_requests TO minhlab_app`);
    await client.query('REVOKE UPDATE ON roles,user_roles,order_items,status_history,audit_logs,attachments,order_tracking_tokens FROM minhlab_app');
    await client.query('GRANT UPDATE ON users,auth_sessions,account_tokens,auth_login_attempts,orders,payments,file_assets,email_outbox,telegram_outbox,order_return_requests TO minhlab_app');
    await client.query('GRANT INSERT ON refunds TO minhlab_app');
    await client.query('GRANT UPDATE (is_current) ON attachments TO minhlab_app');
    await client.query('GRANT INSERT,UPDATE ON categories,products,product_variants,product_images TO minhlab_app');
    await client.query('GRANT DELETE ON auth_login_attempts,product_images,products,product_variants,user_roles TO minhlab_app');
    await client.query(`GRANT SELECT,INSERT,UPDATE ON manufacturing_revisions,production_requirements,production_inventory,production_checks,
      production_plans,production_holds,production_hold_items,production_jobs,production_supplies,production_events,production_agent_runs,print_file_holds,
      printers,print_requests,print_request_items,file_inspections,print_specifications,quotes,quote_items,customer_approvals TO minhlab_app`);
    await client.query('GRANT SELECT,INSERT ON production_operations,print_request_operations TO minhlab_app');
    await client.query('REVOKE UPDATE ON production_operations,print_request_operations FROM minhlab_app');
    await client.query('GRANT INSERT ON quality_inspections TO minhlab_app');
    await client.query('GRANT UPDATE(custom_packed_at,custom_dispatch_ready_at) ON order_items TO minhlab_app');
    await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON telegram_link_requests TO minhlab_app');
    await client.query('GRANT USAGE ON SEQUENCE product_code_seq,variant_sku_seq TO minhlab_app');
}
module.exports = { grantRuntimePrivileges };
