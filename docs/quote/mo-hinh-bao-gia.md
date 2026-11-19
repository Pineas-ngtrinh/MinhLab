# Mô hình ước tính nhựa và thời gian in

The source default is [`resource-model.json`](../../src/lib/quote/config/resource-model.json) (`minhlab-resource-physics-v1`).
It predicts grams and model printing minutes with nonnegative weighted Ridge,
using physical geometry features and separate material blocks. Price is not a
training target. Model coefficients and feature scales match the offline export;
`V3_QUOTE_CONFIG` preserves the previous log-Ridge model for regression checks and
rollback. Changing source does not itself deploy a running VPS.

STL analysis in a browser Worker extracts the same oriented geometry, 24 sections,
and support proxies as Python. Training is offline. Runtime requires no
Python, slicer, new dependency, or local dataset.

The store's current rate card uses **1,000 VND/g including profit + predicted model hours × 3,500 VND**.
Round half up once after summing material, electricity and labor. `priceFdm` accepts
mass in grams and model time in **seconds**; the exported model predicts minutes.
Labor is 0; shipping is 25,000 VND at product prices up to 300,000 VND, free strictly
above 300,000 VND. Store rates live in [`rate_card.json`](../../src/lib/quote/config/rate_card.json), independently of
the resource model. Changing rates must not change predicted grams or minutes.

The physical bed remains 180 × 180 × 180 mm. Inference respects the model's
170 × 170 mm usable XY and 5 mm brim on each side (part ≤160 ×160 mm). It never
resizes or rotates a customer's file. The supported profile is Bambu A1 mini,
0.4 mm nozzle, 0.2 mm layers, two walls, Grid infill (15/40/80%), automatic tree
support, 5 mm brim, Bambu Studio 02.08.02.61. Changing configurable profile fields
also blocks reference prices even if the profile ID was left unchanged.
Scales outside the development range 0.5–1.5,
invalid meshes, missing geometry, inconsistent winding, or incomplete topology
require staff review. The form also accepts smaller/larger scale requests without
crashing; they go to review.

`toReferenceQuoteView()` is the shared policy for **advisory** request-form prices.
It includes material and electricity, and blocks every flag except
`MODEL_PROVISIONAL`. `toCustomerQuoteView()` still hides order/approved prices for
provisional models. No request-form price is a checkout authorization. The model
uses slicer labels, not measured machine consumption. The displayed spread uses
development OOF P90 errors for gram and time; it has no calibrated coverage and is
not a confidence interval or physical-print accuracy claim.

Material keys are mapped exactly: PLA → PLA, PETG → PETG_HF, TPU → TPU_95A_HF.
The form only applies these models to the corresponding named profiles; advising
on other materials stays manual. Total filament labels include support/brim, so
those are not added a second time. Delivery and postprocessing stay separate.

Development nested source-group validation: 1,107 scenarios, 30 STLs, 26 source
groups; mass MAE 3.4075 g / MAPE 6.4719%, model time MAE 23.2349 min / MAPE
20.0913%. These are slicer labels, not physical machine measurements. A new recipe
was explored after baseline errors on four additional sources were inspected;
those later results are diagnostic, not an untouched final test.

Run `npm run test:quote` for analyzer, pricing and Python parity tests. Each model's portable
fixtures contain 108 Python reference cases across synthetic boxes, orientation,
translation/ASCII, elevated overhangs, all three materials, three infills and three
scales. Geometry and floating predictions must agree within 1e-9 relative tolerance;
rounded product/shipping/order amounts must match exactly. These synthetic cases
verify implementation parity, not predictive accuracy. Fixture SHA256 also
checks the model artifact. Tests reject corrupt coefficients, enforce profile and
bed limits, and verify resources are independent of store rates.

For maintenance of the preserved legacy v3 artifact only (does not activate v3):

```sh
python3 scripts/quote/sync-reference-model.py --model-dir /absolute/path/to/model_improved_v3
```

To regenerate synthetic fixtures (use the training Python environment with NumPy):

```sh
python3 scripts/quote/generate-reference-fixtures.py --model-dir /absolute/path/to/model_improved_v3
```

[Reference model metadata](../../src/lib/quote/config/reference-model-metadata.json) describes the older model used for regression tests.
