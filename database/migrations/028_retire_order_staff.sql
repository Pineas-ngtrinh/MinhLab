-- Retain the legacy assignment for history without granting administrative access.
INSERT INTO roles(code,name,description)
VALUES('CUSTOMER','Khách hàng thành viên','Mua hàng và quản lý yêu cầu của chính mình')
ON CONFLICT(code) DO NOTHING;

INSERT INTO user_roles(user_id,role_id)
SELECT ur.user_id,customer.id
FROM user_roles ur
JOIN roles legacy ON legacy.id=ur.role_id AND legacy.code='STAFF'
CROSS JOIN roles customer
WHERE customer.code='CUSTOMER'
ON CONFLICT(user_id,role_id) DO NOTHING;

UPDATE roles SET is_active=false WHERE code='STAFF';

COMMENT ON COLUMN roles.code IS 'CUSTOMER, WORKSHOP_OPERATOR, FILE_REVIEWER, PRINT_OPERATOR, ADMIN; STAFF retired';
