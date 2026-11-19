-- Current payment proofs are public Cloudinary delivery URLs, not protected file delivery.
UPDATE file_assets f
SET access_level='PUBLIC'
WHERE f.storage_provider='CLOUDINARY'
  AND f.object_key LIKE 'payment-proof-url/%'
  AND f.access_level='PRIVATE'
  AND EXISTS (
    SELECT 1 FROM attachments a
    WHERE a.file_asset_id=f.id
      AND a.entity_type='PAYMENT'
      AND a.purpose='PAYMENT_PROOF'
  );
