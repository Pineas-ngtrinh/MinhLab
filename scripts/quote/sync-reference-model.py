"""Copy the reviewed v3 export and synchronize website rates/OOF metadata; never train."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import shutil


def percentile(values, q):
    values = sorted(values)
    position = (len(values) - 1) * q
    index = int(position)
    return values[index] + (values[min(index + 1, len(values) - 1)] - values[index]) * (position - index)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-dir', type=Path, required=True, help='Reviewed model_improved_v3 directory')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'src/lib/quote/config')
    args = parser.parse_args()
    model_path = args.model_dir / 'model_v3.json'
    model = json.loads(model_path.read_text())
    if (model['version'] != 3 or model['feature_schema_version'] != 1 or
            model['targets']['grams']['engine'] != 'frozen_v2_log_ridge' or
            model['targets']['time_min']['engine'] != 'v3_log_ridge' or
            model['targets']['time_min']['family'] != 'physical'):
        parser.error('Unsupported v3 model schema/engine; review inference code before importing.')
    profile = model['fixed_profile']
    if (profile['printer'] != 'Bambu Lab A1 mini' or profile['nozzle_mm'] != 0.4 or
            profile['layer_height_mm'] != 0.2 or profile['support'] != 'Auto ON' or
            profile['slicer_version'] != '02.08.02.61'):
        parser.error('Profile differs from the reviewed website inference contract.')
    with (args.model_dir / 'oof_predictions_v3.csv').open(encoding='utf-8-sig') as handle:
        rows = list(csv.DictReader(handle))
    metadata = {
        'source': 'model_minhLAB/STL_dataset_30_A1mini/model_improved_v3',
        'sourceModelSha256': hashlib.sha256(model_path.read_bytes()).hexdigest(),
        'integratedAt': '2026-10-21',
        'labelBasis': 'Bambu Studio slicer model printing time and total filament (support/brim included)',
        'materialMapping': {'PLA': 'PLA', 'PETG': 'PETG_HF', 'TPU': 'TPU_95A_HF'},
        'evaluation': 'Development grouped OOF only; no independent new-STL final test; no physical-print accuracy claim',
        'rangeMethod': 'prediction * (1 +/- development OOF relative-error P90); advisory spread, not calibrated coverage',
        'relativeErrorP90': {
            'grams': percentile([abs(float(r['predicted_grams']) / float(r['reference_grams']) - 1) for r in rows], .9),
            'time': percentile([abs(float(r['predicted_model_time_min']) / float(r['reference_model_time_min']) - 1) for r in rows], .9),
        },
    }
    pricing = model['fixed_pricing']
    if pricing.get('electricity_time_basis') != 'slicer_model_printing_time' or 'electricity_vnd_per_order' in pricing:
        parser.error('Expected hourly electricity using model printing time.')
    rates = {
        'version': 'minhlab-vnd-2026-10-21-hourly-v2', 'currency': 'VND',
        'pricePerGramVnd': dict.fromkeys(['PLA', 'PETG', 'TPU'], pricing['filament_vnd_per_g_including_profit']),
        'profitIncludedInMaterialPrice': True, 'electricityVndPerHour': pricing['electricity_vnd_per_hour'],
        'laborVnd': pricing['labor_vnd'], 'shippingFeeVnd': pricing['shipping_vnd_if_product_le_300000'],
        'freeShippingAboveProductVnd': pricing['free_shipping_if_product_gt_vnd'], 'rounding': 'half_up_vnd',
    }
    args.output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model_path, args.output / 'reference-model.json')
    (args.output / 'reference-model-metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    (args.output / 'rate_card.json').write_text(json.dumps(rates, indent=2) + '\n')
    print(f'Copied model SHA256 {metadata["sourceModelSha256"]}; no training or final-test evaluation performed.')


if __name__ == '__main__':
    main()
