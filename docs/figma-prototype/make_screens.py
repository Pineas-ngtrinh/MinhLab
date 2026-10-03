"""Build three editable SVG screens for a MinhLab Figma prototype."""

from __future__ import annotations

import base64
import html
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
IMAGES = ROOT / "public" / "images"

BG = "#0B0F14"
HEADER = "#10151C"
PANEL = "#141A21"
PANEL_DARK = "#0F141A"
STROKE = "#27313C"
WHITE = "#F4F1EA"
MUTED = "#A5ADB8"
DIM = "#737D89"
RED = "#EB4037"
GREEN = "#6F9576"
GOLD = "#C8A261"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def image_data(name: str) -> str:
    return "data:image/png;base64," + base64.b64encode((IMAGES / name).read_bytes()).decode("ascii")


def rect(x: float, y: float, w: float, h: float, fill: str, radius: float = 0,
         stroke: str | None = None, sw: float = 1, opacity: float = 1) -> str:
    outline = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
            f'fill="{fill}" opacity="{opacity}"{outline}/>')


def line(x1: float, y1: float, x2: float, y2: float, color: str = STROKE,
         width: float = 1) -> str:
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"/>'


def circle(cx: float, cy: float, r: float, fill: str, stroke: str | None = None,
           sw: float = 1) -> str:
    outline = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{outline}/>'


def text(x: float, y: float, value: str, size: float = 16, color: str = WHITE,
         weight: int = 400, family: str = "Arial, sans-serif", spacing: float = 0,
         anchor: str = "start") -> str:
    return (f'<text x="{x}" y="{y}" fill="{color}" font-family="{esc(family)}" '
            f'font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}" '
            f'text-anchor="{anchor}">{esc(value)}</text>')


def group(name: str, *items: str) -> str:
    return f'<g id="{esc(name)}"><title>{esc(name.replace("-", " "))}</title>{"".join(items)}</g>'


def photo(name: str, x: float, y: float, w: float, h: float, radius: float = 0) -> str:
    clip = f'clip-{name.replace(".", "-")}-{int(x)}-{int(y)}'
    return (f'<defs><clipPath id="{clip}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}"/></clipPath></defs>'
            f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{image_data(name)}" '
            f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})"/>')


def arrow(x: float, y: float, color: str = WHITE) -> str:
    return (f'<path d="M{x} {y}h15m-6-6 6 6-6 6" fill="none" stroke="{color}" '
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')


def check(x: float, y: float, color: str = GREEN) -> str:
    return (f'<path d="M{x} {y+4}l4 4 8-9" fill="none" stroke="{color}" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')


def button(name: str, x: float, y: float, w: float, h: float, label: str,
           primary: bool = True, arrow_icon: bool = False) -> str:
    fill = RED if primary else PANEL_DARK
    stroke = None if primary else STROKE
    label_x = x + 22
    return group(name, rect(x, y, w, h, fill, 8, stroke),
                 text(label_x, y + h / 2 + 5, label, 14, WHITE, 600),
                 arrow(x + w - 35, y + h / 2, WHITE if primary else RED) if arrow_icon else "")


def header(active: str) -> str:
    nav = [("Trang chủ", 500), ("Bộ sưu tập", 604), ("Tour phòng lab", 727),
           ("In theo file", 864), ("Về MinhLab", 985)]
    parts = [rect(0, 0, 1440, 80, HEADER), line(0, 79.5, 1440, 79.5),
             photo("logo.png", 72, 21, 137, 39), text(226, 47, "Workshop Studio", 11, DIM),
             line(218, 30, 218, 52)]
    for label, x in nav:
        is_active = label == active
        parts.extend([text(x, 47, label, 14, WHITE if is_active else "#D1D5DB", 700 if is_active else 500)])
        if is_active:
            parts.append(rect(x, 62, 68 if label == "Bộ sưu tập" else 67, 2, RED))
    parts.extend([rect(1117, 19, 46, 44, HEADER, 8, STROKE),
                  text(1140, 48, "▢", 22, WHITE, anchor="middle"),
                  rect(1177, 19, 95, 44, PANEL, 8, STROKE),
                  text(1193, 47, "Đăng nhập", 12, WHITE, 500),
                  rect(1286, 19, 128, 44, RED, 8),
                  text(1297, 47, "Gửi file cần in", 12, WHITE, 600)])
    return group("00-Header-desktop", *parts)


def svg_file(name: str, title: str, *sections: str) -> None:
    content = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" '
               f'viewBox="0 0 1440 900" role="img" aria-label="{esc(title)}">'
               f'<title>{esc(title)}</title>{rect(0, 0, 1440, 900, BG)}'
               + "".join(sections) + "</svg>")
    (HERE / name).write_text(content, encoding="utf-8")


def screen_collection() -> None:
    intro = group("01-Page-heading",
                  rect(72, 119, 286, 28, PANEL, 3, STROKE), circle(87, 133, 4, RED),
                  text(99, 137, "BỘ SƯU TẬP TẠI XƯỞNG · MINHLAB 3D", 10, MUTED, 500, spacing=0.6),
                  text(72, 207, "Những sản phẩm bước ra", 44, WHITE, 700),
                  text(72, 260, "từ xưởng MinhLab.", 44, WHITE, 700),
                  text(72, 296, "Art Toy, mô hình và phụ kiện được in 3D, hoàn thiện thủ công tại xưởng.", 15, MUTED),
                  text(1209, 285, "0.12 mm FDM", 12, GREEN, 600, anchor="end"))
    tabs = ["Tất cả sản phẩm", "Art Toys & Mô hình", "Diorama & Đèn Decor", "Phụ kiện Desk Setup", "Keycaps Phím Cơ"]
    widths = [156, 171, 191, 182, 154]
    x = 72
    tab_items = []
    for index, (label, width) in enumerate(zip(tabs, widths)):
        tab_items.append(group(f"Tab-{index+1}-{label.replace(' ', '-')}",
                               rect(x, 321, width, 42, "#2A1A1E" if index == 0 else PANEL, 8,
                                    "#894139" if index == 0 else STROKE),
                               text(x+15, 347, label, 13, RED if index == 0 else MUTED, 600 if index == 0 else 500)))
        x += width + 10
    tabs_group = group("02-Category-filter-tabs", *tab_items)
    product_image = group("03-Featured-product-image",
                          rect(72, 387, 706, 414, PANEL_DARK, 14, STROKE),
                          photo("minhlab-mascot-free-v2.png", 73, 388, 704, 412, 13),
                          rect(92, 407, 104, 28, HEADER, 5, STROKE), circle(106, 421, 4, RED),
                          text(117, 425, "Phục dựng", 11, WHITE, 600),
                          rect(205, 407, 88, 28, HEADER, 5, STROKE),
                          text(219, 425, "№ 01 / TOY", 10, MUTED, 500),
                          rect(92, 757, 258, 28, HEADER, 5, STROKE),
                          text(106, 776, "Vân in 0.12mm · Gọt bavia thủ công", 10, MUTED))
    info = [rect(796, 387, 572, 414, PANEL, 14, STROKE),
            text(824, 426, "ART TOYS & MÔ HÌNH", 11, "#8492BD", 600, spacing=1),
            circle(1218, 421, 4, GREEN), text(1232, 426, "Có sẵn tại xưởng", 11, GREEN),
            text(824, 475, "Mascot Khỉ Kỹ Sư", 29, WHITE, 700),
            text(824, 510, "MinhLab", 29, WHITE, 700),
            text(824, 548, "Linh vật voxel đặc trưng, áo lab trắng. In 3D", 14, MUTED),
            text(824, 570, "độ mịn 0.12mm và hoàn thiện thủ công.", 14, MUTED)]
    specs = [("VẬT LIỆU", "PLA+ cao cấp", 824, 596), ("ĐỘ MỊN LAYER", "0.12 mm", 1087, 596),
             ("THỜI GIAN IN", "16 giờ", 824, 651), ("KÍCH THƯỚC", "14 × 10 × 18 cm", 1087, 651)]
    for label, value, sx, sy in specs:
        info.extend([rect(sx, sy, 249, 46, PANEL_DARK, 7, STROKE),
                     text(sx+12, sy+17, label, 9, DIM, 500, spacing=0.8),
                     text(sx+12, sy+35, value, 12, WHITE, 600)])
    info.extend([line(824, 716, 1340, 716), text(824, 739, "GIÁ HOÀN THIỆN", 9, DIM, 500, spacing=1),
                 text(824, 775, "450.000 ₫", 28, WHITE, 700),
                 button("Button-Xem-chi-tiet", 1112, 736, 228, 46, "Xem chi tiết", True, True)])
    featured_info = group("04-Featured-product-information", *info)
    bottom = group("05-Next-product-preview",
                   text(72, 854, "CÁC MẪU KHÁC TRONG BỘ SƯU TẬP", 11, DIM, 600, spacing=1),
                   line(72, 868, 1368, 868))
    svg_file("01-bo-suu-tap.svg", "01 · Bộ sưu tập MinhLab", header("Bộ sưu tập"),
             intro, tabs_group, product_image, featured_info, bottom)


def screen_product() -> None:
    breadcrumbs = group("01-Breadcrumb-and-page-context",
                        text(72, 130, "Bộ sưu tập", 13, DIM), text(170, 130, "/", 13, DIM),
                        text(189, 130, "Mascot Khỉ Kỹ Sư MinhLab", 13, WHITE, 600),
                        text(1368, 130, "№ 01 / TOY", 11, DIM, anchor="end"))
    left = group("02-Product-gallery",
                 rect(72, 159, 620, 617, PANEL, 14, STROKE),
                 photo("minhlab-mascot-detail.png", 73, 160, 618, 615, 13),
                 rect(91, 179, 112, 29, HEADER, 5, STROKE), circle(106, 193, 4, RED),
                 text(118, 198, "PHỤC DỰNG", 10, WHITE, 600, spacing=0.6),
                 rect(72, 794, 129, 74, PANEL_DARK, 8, RED, 2),
                 photo("minhlab-mascot-detail.png", 76, 798, 121, 66, 5),
                 rect(212, 794, 129, 74, PANEL_DARK, 8, STROKE),
                 photo("minhlab-mascot-free-v2.png", 216, 798, 121, 66, 5),
                 text(363, 838, "02 ảnh sản phẩm", 12, DIM))
    right = [rect(720, 159, 648, 709, PANEL, 14, STROKE),
             text(752, 197, "ART TOYS & MÔ HÌNH", 11, "#8492BD", 600, spacing=1),
             circle(1242, 193, 4, GREEN), text(1254, 198, "Có sẵn", 12, GREEN),
             text(752, 250, "Mascot Khỉ Kỹ Sư", 32, WHITE, 700),
             text(752, 289, "MinhLab", 32, WHITE, 700),
             text(752, 333, "450.000 ₫", 30, WHITE, 700),
             text(962, 333, "520.000 ₫", 15, DIM),
             line(752, 353, 1336, 353),
             text(752, 388, "MÀU SẮC", 11, DIM, 600, spacing=1),
             circle(768, 418, 13, "#7C3AED", RED, 2), circle(808, 418, 13, "#18181B", STROKE),
             text(842, 423, "Màu chuẩn MinhLab", 13, WHITE),
             text(752, 465, "Sản phẩm biểu tượng của xưởng MinhLab. Mô hình", 14, MUTED),
             text(752, 488, "được in FDM theo từng lớp 0.12mm, gọt bavia và", 14, MUTED),
             text(752, 511, "lắp ráp thủ công trước khi giao.", 14, MUTED),
             line(752, 533, 1336, 533)]
    details = [("Vật liệu", "PLA+ cao cấp"), ("Độ mịn lớp in", "0.12 mm"),
               ("Kích thước", "14 × 10 × 18 cm"), ("Trọng lượng", "220 gram"),
               ("Thời gian in", "16 giờ")]
    for i, (label, value) in enumerate(details):
        yy = 564 + i*34
        right.extend([text(752, yy, label, 13, DIM), text(1336, yy, value, 13, WHITE, 600, anchor="end")])
    right.extend([line(752, 729, 1336, 729),
                  button("Button-Them-vao-gio", 752, 751, 281, 50, "Thêm vào giỏ hàng", False),
                  button("Button-Mua-ngay", 1045, 751, 291, 50, "Mua ngay", True, True),
                  text(752, 835, "Đóng gói chống va đập · Kiểm tra hoàn thiện trước khi gửi", 11, GREEN)])
    svg_file("02-chi-tiet-san-pham.svg", "02 · Chi tiết Mascot Khỉ Kỹ Sư", header("Bộ sưu tập"),
             breadcrumbs, left, group("03-Product-specification-and-actions", *right))


def field(name: str, x: int, y: int, w: int, label: str, value: str,
          selected: bool = False) -> str:
    return group(name, text(x, y, label, 10, DIM, 600, spacing=0.6),
                 rect(x, y+12, w, 42, PANEL_DARK, 7, RED if selected else STROKE),
                 text(x+14, y+39, value, 12, WHITE if selected else MUTED, 500))


def screen_print() -> None:
    intro = group("01-Page-heading",
                  rect(72, 116, 285, 28, PANEL, 3, STROKE), circle(87, 130, 4, RED),
                  text(99, 134, "ENGINEER WORKBENCH · MINHLAB 3D", 10, MUTED, 500, spacing=0.7),
                  text(72, 197, "Bàn kỹ thuật in 3D theo yêu cầu", 40, WHITE, 700),
                  text(72, 232, "Tải tệp 3D, chọn thông số và nhận tư vấn báo giá trực tiếp từ xưởng.", 15, MUTED))
    left = [rect(72, 266, 513, 389, PANEL, 14, STROKE),
            circle(96, 291, 4, RED), text(109, 296, "BÀN MÁY IN FDM (220×220MM)", 11, WHITE, 600),
            text(550, 296, "Kéo xoay 360°", 10, GOLD, anchor="end"),
            rect(88, 314, 481, 294, "#070A0E", 10, STROKE),
            line(143, 548, 514, 548, "#3C4959"), line(143, 548, 250, 580, "#3C4959"),
            line(514, 548, 410, 580, "#3C4959"), line(250, 580, 410, 580, "#3C4959"),
            rect(229, 382, 216, 142, "#1B2632", 6, "#586777"),
            text(337, 430, "STL", 54, "#7A8695", 700, anchor="middle"),
            text(337, 461, "PREVIEW", 12, DIM, 500, spacing=2, anchor="middle"),
            text(337, 499, "Mẫu in sẽ hiển thị tại đây", 11, MUTED, anchor="middle"),
            text(103, 634, "MÀU NHỰA", 10, DIM, 500),
            circle(182, 630, 10, RED, WHITE, 2), circle(212, 630, 10, GOLD),
            circle(242, 630, 10, "#1F242C", STROKE), circle(272, 630, 10, WHITE),
            rect(72, 673, 513, 162, PANEL, 14, STROKE, 1, 1),
            rect(82, 683, 493, 142, "none", 10, STROKE, 1.5),
            text(328, 729, "↑", 31, RED, 600, anchor="middle"),
            text(328, 760, "Kéo thả file vào đây hoặc chọn từ thiết bị", 15, WHITE, 600, anchor="middle"),
            text(328, 786, "STL · OBJ · STEP · 3MF · ZIP  |  Tối đa 100 MB", 11, DIM, anchor="middle")]
    right = [rect(609, 266, 759, 569, PANEL, 14, STROKE),
             text(637, 304, "01  CHỌN VẬT LIỆU", 11, DIM, 600, spacing=0.8)]
    material = [("PLA+", "Chi tiết sắc nét", True), ("PETG", "Chịu lực, kháng ẩm", False),
                ("TPU", "Đàn hồi dẻo", False)]
    for i, (label, description, selected) in enumerate(material):
        xx = 637 + i*234
        right.extend([rect(xx, 322, 222, 73, "#25191C" if selected else PANEL_DARK, 7,
                           RED if selected else STROKE),
                      text(xx+13, 346, label, 14, WHITE, 600),
                      text(xx+13, 373, description, 11, MUTED)])
    right.extend([text(637, 429, "02  ĐỘ MỊN LỚP IN", 11, DIM, 600, spacing=0.8)])
    for i, label in enumerate(["0.12 mm  ·  Siêu mịn", "0.16 mm  ·  Tiêu chuẩn", "0.20 mm  ·  In nhanh"]):
        xx = 637+i*234
        right.extend([rect(xx, 446, 222, 43, "#25191C" if i == 0 else PANEL_DARK, 7,
                           RED if i == 0 else STROKE),
                      text(xx+13, 473, label, 12, WHITE if i == 0 else MUTED, 600 if i == 0 else 500)])
    right.extend([field("Field-Kich-thuoc", 637, 520, 338, "03  KÍCH THƯỚC ƯỚC TÍNH", "Ví dụ: 15 × 10 × 12 cm"),
                  field("Field-So-luong", 994, 520, 344, "04  SỐ LƯỢNG", "1"),
                  line(637, 598, 1339, 598),
                  text(637, 626, "05  THÔNG TIN NHẬN BÁO GIÁ", 11, DIM, 600, spacing=0.8),
                  field("Field-Ho-ten", 637, 642, 338, "HỌ VÀ TÊN", "Họ tên của bạn"),
                  field("Field-So-dien-thoai", 994, 642, 344, "SỐ ĐIỆN THOẠI / ZALO", "Số điện thoại / Zalo *"),
                  rect(637, 722, 17, 17, PANEL_DARK, 3, RED), check(640, 722, RED),
                  text(664, 736, "Tôi có quyền sử dụng tệp thiết kế 3D này.", 12, MUTED),
                  button("Button-Tao-ban-tom-tat", 637, 754, 701, 50,
                         "Tạo bản tóm tắt thông số & gửi Zalo", True, True)])
    svg_file("03-in-theo-file.svg", "03 · Gửi yêu cầu in 3D theo file", header("In theo file"),
             intro, group("02-File-preview-and-upload", *left),
             group("03-Print-request-form", *right))


if __name__ == "__main__":
    HERE.mkdir(parents=True, exist_ok=True)
    screen_collection()
    screen_product()
    screen_print()
    print("Created 3 SVG screens in", HERE)
