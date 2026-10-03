from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
NS = "{http://www.w3.org/2000/svg}"
XLINK = "{http://www.w3.org/1999/xlink}"
FILES = [
    "01-bat-dau.svg",
    "02-da-nap-tep.svg",
    "03-chon-cau-hinh.svg",
    "04-loi-thieu-so-dien-thoai.svg",
    "05-thong-tin-hop-le.svg",
    "06-tom-tat-overlay.svg",
]


def convert(node: ET.Element, images: dict[str, str]):
    tag = node.tag.removeprefix(NS)
    a = node.attrib
    if tag in {"title", "defs"}:
        return None
    if tag == "g":
        children = [value for child in node if (value := convert(child, images))]
        return {"type": "group", "name": a.get("id", "Group"), "children": children}
    if tag == "image":
        data = a.get("href", a.get(XLINK + "href", ""))
        key = next((k for k, value in images.items() if value == data), None)
        if key is None:
            key = f"image-{len(images) + 1}"
            images[key] = data
        return {"type": "image", "name": key, "x": float(a["x"]), "y": float(a["y"]),
                "w": float(a["width"]), "h": float(a["height"])}
    if tag == "text":
        return {"type": "text", "value": node.text or "", "x": float(a["x"]), "y": float(a["y"]),
                "size": float(a.get("font-size", 14)), "color": a.get("fill", "#FFFFFF"),
                "weight": int(a.get("font-weight", 400)), "align": a.get("text-anchor", "start")}
    if tag == "rect":
        return {"type": "rect", "x": float(a["x"]), "y": float(a["y"]), "w": float(a["width"]),
                "h": float(a["height"]), "r": float(a.get("rx", 0)), "fill": a.get("fill", "none"),
                "stroke": a.get("stroke"), "sw": float(a.get("stroke-width", 1)),
                "opacity": float(a.get("opacity", 1))}
    if tag == "circle":
        return {"type": "circle", "x": float(a["cx"]) - float(a["r"]),
                "y": float(a["cy"]) - float(a["r"]), "r": float(a["r"]),
                "fill": a.get("fill", "none"), "stroke": a.get("stroke"),
                "sw": float(a.get("stroke-width", 1))}
    if tag == "line":
        return {"type": "line", "x1": float(a["x1"]), "y1": float(a["y1"]),
                "x2": float(a["x2"]), "y2": float(a["y2"]), "stroke": a.get("stroke", "#27313C"),
                "sw": float(a.get("stroke-width", 1))}
    if tag == "path":
        return {"type": "path", "d": a.get("d", ""), "stroke": a.get("stroke"),
                "fill": a.get("fill", "none"), "sw": float(a.get("stroke-width", 1))}
    return None


def build():
    images: dict[str, str] = {}
    screens = []
    for filename in FILES:
        root = ET.parse(HERE / filename).getroot()
        nodes = [value for child in root if (value := convert(child, images))]
        screens.append({"name": filename.removesuffix(".svg"), "nodes": nodes})
    manifest = {
        "name": "MinhLab HO5 - Print Request",
        "id": "1522346501040013347",
        "api": "1.0.0",
        "main": "code.js",
        "editorType": ["figma"],
        "documentAccess": "dynamic-page",
        "networkAccess": {"allowedDomains": ["none"]},
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    data = json.dumps({"screens": screens, "images": images}, ensure_ascii=False, separators=(",", ":"))
    js = r'''// Local Figma plugin for MinhLab HO #5. Creates native layers and click-through states.
const DATA = __DATA__;
function rgb(hex) { const c=hex.replace('#',''); return {r:parseInt(c.slice(0,2),16)/255,g:parseInt(c.slice(2,4),16)/255,b:parseInt(c.slice(4,6),16)/255}; }
function paint(hex, opacity) { return {type:'SOLID',color:rgb(hex),opacity:opacity===undefined?1:opacity}; }
function decode(uri) { const raw=atob(uri.split(',')[1]);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes; }
function add(parent,node){parent.appendChild(node);return node;}
function cleanName(value){
  const names={
    '00-Header-desktop':'Header','01-Page-heading':'Tiêu đề',
    '02-Progress-stepper':'Các bước','03-3D-file-preview-and-upload':'Xem trước và tải file',
    '04-Print-settings-and-contact-form':'Thông tin và cấu hình',
    '05-Flow-caption':'Ghi chú','06-Summary-confirmation-overlay':'Tóm tắt',
    'Material-PLAplus':'Vật liệu PLA+','Material-PETG':'Vật liệu PETG',
    'Material-Cần-tư-vấn':'Vật liệu khác','Layer-0.12-mm':'Lớp in 0.12 mm',
    'Layer-0.16-mm':'Lớp in 0.16 mm','Layer-0.20-mm':'Lớp in 0.20 mm'
  };
  return names[value]||value.replaceAll('-',' ').replaceAll('_',' ');
}
async function make(spec,parent,hashes){
  if(spec.type==='group'){
    const children=[];for(const item of spec.children){const child=await make(item,parent,hashes);if(child)children.push(child);}
    if(!children.length)return null;
    const group=figma.group(children,parent);group.name=cleanName(spec.name);return group;
  }
  if(spec.type==='rect'||spec.type==='image'){
    const node=add(parent,figma.createRectangle());node.resize(spec.w,spec.h);node.x=spec.x;node.y=spec.y;
    node.name=spec.type==='image'?(spec.name==='image-1'?'Logo MinhLab':'Ảnh mascot MinhLab'):'Nền / viền';
    if(spec.type==='image'){node.fills=[{type:'IMAGE',imageHash:hashes[spec.name],scaleMode:'FILL'}];return node;}
    node.cornerRadius=spec.r||0;node.fills=spec.fill==='none'?[]:[paint(spec.fill,spec.opacity)];
    if(spec.stroke){node.strokes=[paint(spec.stroke)];node.strokeWeight=spec.sw;}return node;
  }
  if(spec.type==='circle'){
    const node=add(parent,figma.createEllipse());node.name='Điểm nhấn / trạng thái';node.resize(spec.r*2,spec.r*2);node.x=spec.x;node.y=spec.y;
    node.fills=spec.fill==='none'?[]:[paint(spec.fill)];if(spec.stroke){node.strokes=[paint(spec.stroke)];node.strokeWeight=spec.sw;}return node;
  }
  if(spec.type==='line'){
    if(spec.y1!==spec.y2)return null;
    const node=add(parent,figma.createRectangle());node.name='Đường phân cách';node.resize(Math.max(1,spec.x2-spec.x1),Math.max(1,spec.sw));node.x=spec.x1;node.y=spec.y1;node.fills=[paint(spec.stroke)];return node;
  }
  if(spec.type==='path')return null;
  if(spec.type==='text'){
    const node=add(parent,figma.createText());node.fontName={family:'Inter',style:spec.weight>=600?'Bold':'Regular'};node.characters=spec.value;node.fontSize=spec.size;node.fills=[paint(spec.color)];
    node.name=(spec.value||'Chữ').slice(0,48);node.x=spec.x-(spec.align==='middle'?node.width/2:spec.align==='end'?node.width:0);node.y=spec.y-spec.size*.83;return node;
  }
  return null;
}
async function clickLink(parent,name,box,destination,action='NAVIGATE'){
  const node=add(parent,figma.createRectangle());node.name=name;node.resize(box[2],box[3]);node.x=box[0];node.y=box[1];node.fills=[{type:'SOLID',color:{r:1,g:1,b:1},opacity:.001}];node.strokes=[];
  const actionData=action==='CLOSE'?{type:'CLOSE'}:{type:'NODE',destinationId:destination.id,navigation:action,transition:{type:'DISSOLVE',easing:{type:'EASE_OUT'},duration:.2},preserveScrollPosition:false};
  await node.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[actionData]}]);return node;
}
async function main(){
  await Promise.all([figma.loadFontAsync({family:'Inter',style:'Regular'}),figma.loadFontAsync({family:'Inter',style:'Bold'})]);
  const hashes={};for(const [key,uri]of Object.entries(DATA.images))hashes[key]=figma.createImage(decode(uri)).hash;
  const titles=['01 / Tải tệp','02 / Tệp đã nạp','03 / Chọn cấu hình','04 / Lỗi số điện thoại','05 / Thông tin hợp lệ','06 / Tóm tắt overlay'];
  const frames=[];
  for(let i=0;i<DATA.screens.length;i++){
    const frame=figma.createFrame();frame.name=titles[i];frame.resize(1440,1024);frame.x=(i%3)*1510;frame.y=Math.floor(i/3)*1090;frame.fills=[];frame.clipsContent=true;
    for(const item of DATA.screens[i].nodes)await make(item,frame,hashes);frames.push(frame);
  }
  // Start with upload, then demonstrate configuration, validation, filled input, and summary overlay.
  await clickLink(frames[0],'Tải file',[85,690,480,102],frames[1]);
  await clickLink(frames[0],'Tiếp tục',[620,826,730,64],frames[3]);
  await clickLink(frames[1],'Chọn PETG',[850,406,235,72],frames[2]);
  await clickLink(frames[1],'Tiếp tục',[620,826,730,64],frames[3]);
  await clickLink(frames[2],'Tiếp tục',[620,826,730,64],frames[3]);
  await clickLink(frames[3],'Số điện thoại',[984,697,365,58],frames[4]);
  await clickLink(frames[4],'Tóm tắt',[620,826,730,64],frames[5],'OVERLAY');
  await clickLink(frames[5],'Quay lại',[417,716,300,70],null,'CLOSE');
  await clickLink(frames[5],'Đóng',[982,175,50,52],null,'CLOSE');
  figma.currentPage.selection=frames;figma.viewport.scrollAndZoomIntoView(frames);figma.closePlugin('Đã tạo prototype HO #5 với 5 trạng thái, bước xác nhận và tương tác.');
}
main().catch(error=>figma.closePlugin('Không thể tạo prototype: '+String(error)));
'''.replace("__DATA__", data)
    (HERE / "code.js").write_text(js, encoding="utf-8")
    print("Built plugin", len(screens), "frames and", len(images), "image assets")


if __name__ == "__main__":
    build()
