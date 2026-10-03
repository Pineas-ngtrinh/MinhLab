"""Convert the three SVG screens into a local Figma plugin with native layers."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path


HERE = Path(__file__).resolve().parent
SVG_NS = "{http://www.w3.org/2000/svg}"
XLINK_NS = "{http://www.w3.org/1999/xlink}"
FILES = ["01-bo-suu-tap.svg", "02-chi-tiet-san-pham.svg", "03-in-theo-file.svg"]


def convert(element: ET.Element, images: dict[str, str]) -> dict | None:
    tag = element.tag.removeprefix(SVG_NS)
    a = element.attrib
    if tag in {"title", "defs"}:
        return None
    if tag == "g":
        children = [converted for child in element if (converted := convert(child, images))]
        return {"type": "group", "name": a.get("id", "Group"), "children": children}
    if tag == "image":
        data = a.get("href", a.get(XLINK_NS + "href", ""))
        key = f"image-{len(images) + 1}"
        if data in images.values():
            key = next(k for k, v in images.items() if v == data)
        else:
            images[key] = data
        return {"type": "image", "name": key,
                "x": float(a["x"]), "y": float(a["y"]),
                "w": float(a["width"]), "h": float(a["height"])}
    if tag == "text":
        return {"type": "text", "value": element.text or "", "x": float(a["x"]),
                "y": float(a["y"]), "size": float(a.get("font-size", 16)),
                "color": a.get("fill", "#FFFFFF"), "weight": int(a.get("font-weight", 400)),
                "align": a.get("text-anchor", "start")}
    if tag == "rect":
        return {"type": "rect", "x": float(a["x"]), "y": float(a["y"]),
                "w": float(a["width"]), "h": float(a["height"]),
                "r": float(a.get("rx", 0)), "fill": a.get("fill", "none"),
                "stroke": a.get("stroke"), "sw": float(a.get("stroke-width", 1)),
                "opacity": float(a.get("opacity", 1))}
    if tag == "circle":
        return {"type": "circle", "x": float(a["cx"]) - float(a["r"]),
                "y": float(a["cy"]) - float(a["r"]), "r": float(a["r"]),
                "fill": a.get("fill", "none"), "stroke": a.get("stroke"),
                "sw": float(a.get("stroke-width", 1))}
    if tag == "line":
        return {"type": "line", "x1": float(a["x1"]), "y1": float(a["y1"]),
                "x2": float(a["x2"]), "y2": float(a["y2"]),
                "stroke": a.get("stroke", "#27313C"), "sw": float(a.get("stroke-width", 1))}
    # Tiny decorative arrow/check paths are drawn in the SVG fallback.
    return None


def build() -> None:
    images: dict[str, str] = {}
    screens = []
    for filename in FILES:
        root = ET.parse(HERE / filename).getroot()
        nodes = [converted for child in root if (converted := convert(child, images))]
        screens.append({"name": filename.removesuffix(".svg"), "nodes": nodes})

    manifest = {
        "name": "MinhLab 3D Prototype",
        "id": "1522346501040012345",
        "api": "1.0.0",
        "main": "code.js",
        "editorType": ["figma"],
        "documentAccess": "dynamic-page",
        "networkAccess": {"allowedDomains": ["none"]},
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    data = json.dumps({"screens": screens, "images": images}, ensure_ascii=False, separators=(",", ":"))
    script = r'''// MinhLab 3D: native Figma frames, text, shapes, image fills, and prototype links.
const DATA = __DATA__;

function rgb(hex) {
  const value = hex.replace('#', '');
  return {r: parseInt(value.slice(0, 2), 16) / 255,
          g: parseInt(value.slice(2, 4), 16) / 255,
          b: parseInt(value.slice(4, 6), 16) / 255};
}
function paint(hex, opacity) {
  return {type: 'SOLID', color: rgb(hex), opacity: opacity === undefined ? 1 : opacity};
}
function imageBytes(dataUri) {
  const raw = atob(dataUri.split(',')[1]);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function append(parent, node) {
  parent.appendChild(node);
  return node;
}
async function create(spec, parent, imageHashes) {
  if (spec.type === 'group') {
    const children = [];
    for (const item of spec.children) {
      const child = await create(item, parent, imageHashes);
      if (child) children.push(child);
    }
    if (!children.length) return null;
    const result = figma.group(children, parent);
    result.name = spec.name.replaceAll('-', ' ');
    return result;
  }
  if (spec.type === 'rect' || spec.type === 'image') {
    const node = append(parent, figma.createRectangle());
    node.name = spec.type === 'image' ? 'Ảnh sản phẩm / ảnh thương hiệu' : 'Khối nền / viền';
    node.resize(spec.w, spec.h);
    node.x = spec.x; node.y = spec.y;
    if (spec.type === 'image') {
      node.fills = [{type: 'IMAGE', imageHash: imageHashes[spec.name], scaleMode: 'FILL'}];
      return node;
    }
    node.cornerRadius = spec.r || 0;
    node.fills = spec.fill === 'none' ? [] : [paint(spec.fill, spec.opacity)];
    if (spec.stroke) {node.strokes = [paint(spec.stroke)]; node.strokeWeight = spec.sw;}
    return node;
  }
  if (spec.type === 'circle') {
    const node = append(parent, figma.createEllipse());
    node.name = 'Điểm nhấn / trạng thái';
    node.resize(spec.r * 2, spec.r * 2);
    node.x = spec.x; node.y = spec.y;
    node.fills = spec.fill === 'none' ? [] : [paint(spec.fill)];
    if (spec.stroke) {node.strokes = [paint(spec.stroke)]; node.strokeWeight = spec.sw;}
    return node;
  }
  if (spec.type === 'line') {
    if (spec.y1 !== spec.y2) return null;
    const node = append(parent, figma.createRectangle());
    node.name = 'Đường phân cách';
    node.resize(Math.max(1, spec.x2 - spec.x1), Math.max(1, spec.sw));
    node.x = spec.x1; node.y = spec.y1;
    node.fills = [paint(spec.stroke)];
    return node;
  }
  if (spec.type === 'text') {
    const node = append(parent, figma.createText());
    const style = spec.weight >= 600 ? 'Bold' : 'Regular';
    node.fontName = {family: 'Inter', style};
    node.characters = spec.value;
    node.fontSize = spec.size;
    node.fills = [paint(spec.color)];
    node.name = spec.value.slice(0, 42) || 'Chữ';
    node.x = spec.x - (spec.align === 'middle' ? node.width / 2 : spec.align === 'end' ? node.width : 0);
    node.y = spec.y - spec.size * 0.83;
    return node;
  }
  return null;
}
async function hotspot(frame, name, box, destination) {
  const node = append(frame, figma.createRectangle());
  node.name = name;
  node.resize(box[2], box[3]);
  node.x = box[0]; node.y = box[1];
  node.fills = [{type: 'SOLID', color: {r: 1, g: 1, b: 1}, opacity: 0.001}];
  node.strokes = [];
  await node.setReactionsAsync([{trigger: {type: 'ON_CLICK'}, actions: [{
    type: 'NODE', destinationId: destination.id, navigation: 'NAVIGATE',
    transition: {type: 'DISSOLVE', easing: {type: 'LINEAR'}, duration: 0.2},
    preserveScrollPosition: false
  }]}]);
}
async function main() {
  await Promise.all([
    figma.loadFontAsync({family: 'Inter', style: 'Regular'}),
    figma.loadFontAsync({family: 'Inter', style: 'Bold'})
  ]);
  const imageHashes = {};
  for (const [key, uri] of Object.entries(DATA.images)) {
    imageHashes[key] = figma.createImage(imageBytes(uri)).hash;
  }
  const frames = [];
  for (let i = 0; i < DATA.screens.length; i++) {
    const spec = DATA.screens[i];
    const frame = figma.createFrame();
    frame.name = ['01 / Bộ sưu tập', '02 / Chi tiết sản phẩm', '03 / In theo file'][i];
    frame.resize(1440, 900);
    frame.x = i * 1500; frame.y = 0;
    frame.fills = [];
    frame.clipsContent = true;
    for (const item of spec.nodes) await create(item, frame, imageHashes);
    frames.push(frame);
  }
  await hotspot(frames[0], 'PROTOTYPE / Xem chi tiết sản phẩm', [1105, 730, 245, 58], frames[1]);
  await hotspot(frames[0], 'PROTOTYPE / Gửi file cần in', [1280, 14, 140, 54], frames[2]);
  await hotspot(frames[1], 'PROTOTYPE / Quay lại bộ sưu tập', [66, 106, 290, 46], frames[0]);
  await hotspot(frames[1], 'PROTOTYPE / Gửi file cần in', [1280, 14, 140, 54], frames[2]);
  await hotspot(frames[2], 'PROTOTYPE / Về bộ sưu tập', [596, 20, 116, 44], frames[0]);
  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  figma.closePlugin('Đã tạo 3 màn hình MinhLab và nối các điểm bấm chính.');
}
main().catch(error => figma.closePlugin('Không thể tạo prototype: ' + String(error)));
'''.replace("__DATA__", data)
    (HERE / "code.js").write_text(script, encoding="utf-8")
    print("Created Figma plugin with", len(screens), "screens and", len(images), "image assets")


if __name__ == "__main__":
    build()
