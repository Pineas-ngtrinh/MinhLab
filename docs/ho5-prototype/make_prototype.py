from __future__ import annotations

import base64
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ASSET = ROOT / "public/images/minhlab-mascot-detail.png"
PNG = "data:image/png;base64," + base64.b64encode(ASSET.read_bytes()).decode("ascii")

BG = "#0B0F14"
HEADER = "#10151C"
PANEL = "#141A21"
PANEL2 = "#0F141A"
STROKE = "#27313C"
WHITE = "#F4F1EA"
MUTED = "#A5ADB8"
DIM = "#737D89"
RED = "#EB4037"
GREEN = "#6F9576"
GOLD = "#C8A261"


def esc(value):
    return html.escape(str(value), quote=True)


def rect(x, y, w, h, fill, r=0, stroke=None, sw=1, opacity=1):
    outline = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" opacity="{opacity}"{outline}/>'


def line(x1, y1, x2, y2, color=STROKE, width=1):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"/>'


def circle(cx, cy, r, fill, stroke=None, sw=1):
    outline = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{outline}/>'


def text(x, y, value, size=14, color=WHITE, weight=400, family="Arial, sans-serif", anchor="start", spacing=0):
    return f'<text x="{x}" y="{y}" fill="{color}" font-family="{family}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" letter-spacing="{spacing}">{esc(value)}</text>'


def group(name, *items):
    return f'<g id="{esc(name)}"><title>{esc(name.replace("-", " "))}</title>{"".join(items)}</g>'


def img(x, y, w, h, r=8):
    clip = f'clip-mascot-{x}-{y}'
    return (f'<defs><clipPath id="{clip}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/></clipPath></defs>'
            f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{PNG}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})"/>')


def header(active="In theo file"):
    pieces = [rect(0, 0, 1440, 80, HEADER), line(0, 79, 1440, 79),
              img_logo(), text(221, 47, "Workshop Studio", 11, DIM), line(215, 28, 215, 53)]
    nav = [("Trang chủ", 494), ("Bộ sưu tập", 593), ("Tour phòng lab", 711), ("In theo file", 844), ("Về MinhLab", 966)]
    for label, x in nav:
        pieces.append(text(x, 47, label, 14, WHITE if label == active else "#D1D5DB", 700 if label == active else 500))
        if label == active:
            pieces.append(rect(x, 62, 67, 2, RED))
    pieces.extend([rect(1112, 18, 46, 44, HEADER, 8, STROKE), text(1135, 47, "▢", 22, WHITE, anchor="middle"),
                   rect(1171, 18, 100, 44, PANEL, 8, STROKE), text(1187, 46, "Đăng nhập", 12, WHITE),
                   rect(1284, 18, 128, 44, RED, 8), text(1294, 46, "Gửi file cần in", 12, WHITE, 600)])
    return group("00-Header-desktop", *pieces)


def img_logo():
    data = "data:image/png;base64," + base64.b64encode((ROOT / "public/images/logo.png").read_bytes()).decode("ascii")
    return f'<image x="72" y="20" width="126" height="42" href="{data}" preserveAspectRatio="xMinYMid meet"/>'


def progress(current):
    labels = [("01", "Tệp 3D"), ("02", "Cấu hình"), ("03", "Liên hệ"), ("04", "Xác nhận")]
    parts = [rect(72, 249, 1296, 68, PANEL, 9, STROKE)]
    for i, (num, label) in enumerate(labels, 1):
        x = 105 + (i - 1) * 310
        active = i == current
        done = i < current
        color = GREEN if done else RED if active else DIM
        parts.extend([circle(x + 13, 283, 13, color if active or done else PANEL2, color if active or done else STROKE),
                      text(x + 13, 287, "✓" if done else num, 9, BG if active or done else DIM, 700, anchor="middle"),
                      text(x + 37, 288, label, 13, WHITE if active or done else DIM, 600 if active else 500)])
        if i < 4:
            parts.append(line(x + 150, 283, x + 267, 283, GREEN if done else STROKE, 2))
    return group("02-Progress-stepper", *parts)


def heading():
    return group("01-Page-heading",
                 rect(72, 113, 245, 27, PANEL, 3, STROKE), circle(86, 126, 4, RED),
                 text(99, 130, "BÀN KỸ THUẬT / MINHLAB 3D", 10, MUTED, 600, spacing=.7),
                 text(72, 190, "Gửi yêu cầu in 3D theo file", 38, WHITE, 700),
                 text(72, 222, "Tải mô hình lên, chọn cấu hình và nhận tư vấn trước khi xưởng in.", 15, MUTED))


def preview_panel(file_ready):
    p = [rect(72, 333, 500, 620, PANEL, 14, STROKE),
         circle(99, 366, 4, GREEN if file_ready else RED),
         text(113, 371, "BÀN XEM TRƯỚC 3D", 11, WHITE, 600, spacing=.8),
         text(545, 371, "KHỔ IN 220 × 220 × 250 MM", 9, DIM, 500, anchor="end"),
         rect(91, 391, 462, 290, "#070A0E", 10, STROKE)]
    if file_ready:
        p += [img(92, 392, 460, 288, 9),
              rect(108, 407, 128, 25, HEADER, 4, STROKE), circle(121, 419, 3, GREEN),
              text(131, 423, "MASCOT_VOXEL.STL", 9, WHITE, 600)]
    else:
        # A restrained isometric bed and wireframe cube indicate an empty 3D viewport.
        p += [line(171, 605, 470, 605, "#34414D"), line(171, 605, 257, 630, "#34414D"),
              line(470, 605, 385, 630, "#34414D"), line(257, 630, 385, 630, "#34414D"),
              line(257, 630, 257, 480, "#34414D"), line(385, 630, 385, 480, "#34414D"),
              line(257, 480, 385, 480, "#34414D"),
              line(297, 572, 351, 572, "#778592", 2), line(297, 572, 297, 515, "#778592", 2),
              line(351, 572, 351, 515, "#778592", 2), line(297, 515, 351, 515, "#778592", 2),
              line(297, 515, 319, 494, "#778592", 2), line(351, 515, 373, 494, "#778592", 2),
              line(319, 494, 373, 494, "#778592", 2), line(319, 494, 319, 550, "#778592", 2),
              line(373, 494, 373, 550, "#778592", 2), line(319, 550, 373, 550, "#778592", 2),
              text(324, 654, "MÔ HÌNH SẼ HIỆN Ở ĐÂY", 10, DIM, 500, anchor="middle", spacing=1)]
    if file_ready:
        p += [rect(91, 698, 462, 86, PANEL2, 8, GREEN, 1),
              rect(106, 715, 34, 42, "#173020", 6), text(123, 742, "STL", 9, GREEN, 700, anchor="middle"),
              text(153, 728, "mascot-voxel.stl", 13, WHITE, 600),
              text(153, 750, "2.8 MB  ·  Đã nạp lên bàn máy", 11, GREEN),
              text(529, 741, "⌫", 17, MUTED, anchor="middle")]
    else:
        p += [rect(91, 698, 462, 86, "#11171E", 8, STROKE, 1),
              rect(105, 715, 34, 42, PANEL2, 6, STROKE), text(122, 743, "+", 23, RED, 400, anchor="middle"),
              text(153, 728, "Chọn tệp mô hình 3D", 13, WHITE, 600),
              text(153, 750, "STL · OBJ · STEP · 3MF  |  Tối đa 100 MB", 10, DIM),
              text(529, 740, "↑", 18, RED, anchor="middle")]
    p += [line(91, 805, 553, 805), text(91, 830, "KIỂM TRA TỰ ĐỘNG", 10, DIM, 600, spacing=.8),
          check_mark(101, 848), text(119, 861, "Định dạng tệp được hỗ trợ", 11, MUTED),
          check_mark(323, 848), text(341, 861, "Tư vấn vật liệu tại xưởng", 11, MUTED),
          text(91, 914, "Số đo cuối cùng được kỹ sư xác nhận trước khi báo giá.", 10, DIM)]
    return group("03-3D-file-preview-and-upload", *p)


def check_mark(x, y):
    return circle(x, y, 7, "#1B3022") + f'<path d="M{x-3} {y}l2 2 4-5" fill="none" stroke="{GREEN}" stroke-width="1.4"/>'


def label(x, y, value):
    return text(x, y, value, 10, DIM, 600, spacing=.7)


def field(x, y, w, hint, value=None, error=False, prefix=None):
    fill = "#251718" if error else PANEL2
    stroke = RED if error else STROKE
    items = [rect(x, y, w, 44, fill, 7, stroke)]
    if prefix:
        items.append(text(x + 14, y + 28, prefix, 11, DIM, 500))
        items.append(line(x + 43, y + 10, x + 43, y + 34, STROKE))
        items.append(text(x + 55, y + 28, value or hint, 12, WHITE if value else DIM, 500))
    else:
        items.append(text(x + 14, y + 28, value or hint, 12, WHITE if value else DIM, 500))
    return "".join(items)


def form_panel(configured, error, filled):
    material = "PETG" if configured else "PLA+"
    layer = "0.16 mm" if configured else "0.12 mm"
    qty = "02" if configured else "01"
    parts = [rect(600, 333, 768, 620, PANEL, 14, STROKE),
             text(629, 371, "THÔNG SỐ VÀ LIÊN HỆ", 11, WHITE, 600, spacing=.8),
             text(1338, 371, "BƯỚC 02 / 04", 9, DIM, 500, anchor="end"),
             label(629, 401, "01  VẬT LIỆU IN"),
             option(629, 413, 220, "PLA+", "Nét cao · Bề mặt mịn", selected=not configured),
             option(860, 413, 220, "PETG", "Bền · Kháng ẩm", selected=configured),
             option(1091, 413, 248, "Cần tư vấn", "Kỹ sư đề xuất vật liệu", selected=False),
             label(629, 490, "02  ĐỘ MỊN LỚP IN"),
             spec_option(629, 502, 220, "0.12 mm", "Siêu mịn", selected=not configured),
             spec_option(860, 502, 220, "0.16 mm", "Cân bằng", selected=configured),
             spec_option(1091, 502, 248, "0.20 mm", "In nhanh", selected=False),
             label(629, 579, "03  MÀU NHỰA"),
             circle(643, 603, 9, RED, WHITE if not configured else None, 2),
             circle(673, 603, 9, GOLD, WHITE if configured else None, 2),
             circle(703, 603, 9, "#242A32", STROKE),
             circle(733, 603, 9, "#F0EFEA", STROKE),
             text(755, 608, "Đỏ cam MinhLab" if not configured else "Vàng kim Champagne", 11, MUTED),
             label(1004, 579, "04  SỐ LƯỢNG"),
             rect(1090, 585, 91, 36, PANEL2, 6, STROKE),
             text(1108, 609, "−", 16, MUTED, anchor="middle"),
             text(1135, 609, qty, 12, WHITE, 600, anchor="middle"),
             text(1163, 609, "+", 16, WHITE, anchor="middle"),
             line(629, 640, 1339, 640),
             text(629, 670, "05  THÔNG TIN NHẬN BÁO GIÁ", 11, WHITE, 600, spacing=.6),
             label(629, 694, "HỌ VÀ TÊN"), label(991, 694, "SỐ ĐIỆN THOẠI / ZALO *"),
             field(629, 703, 344, "Tên của bạn", "Nguyễn Minh" if filled else None),
             field(991, 703, 348, "Số điện thoại / Zalo", "0901 234 567" if filled else None,
                   error=error, prefix="+84"),
             line(629, 772, 1339, 772)]
    if error:
        parts += [circle(638, 755, 6, RED), text(651, 759, "Vui lòng nhập số điện thoại hoặc Zalo để nhận tư vấn.", 10, RED, 500)]
    else:
        parts += [text(629, 755, "Xưởng sẽ liên hệ sau khi kiểm tra mô hình.", 10, DIM)]
    parts += [rect(629, 791, 16, 16, "#25191C" if filled else PANEL2, 3, RED if filled else STROKE),
              check_small(633, 794) if filled else "",
              text(654, 804, "Tôi có quyền sử dụng tệp thiết kế 3D này.", 11, MUTED),
              button(629, 835, 710, 50, "Tạo bản tóm tắt thông số", RED, arrow=True),
              circle(638, 916, 5, GREEN), text(651, 920, "MinhLab kiểm tra file và xác nhận giá trước khi in.", 10, DIM)]
    return group("04-Print-settings-and-contact-form", *parts)


def check_small(x, y):
    return f'<path d="M{x} {y+4}l3 3 6-7" fill="none" stroke="{RED}" stroke-width="1.5"/>'


def option(x, y, w, title, subtitle, selected=False):
    stroke = RED if selected else STROKE
    fill = "#25191C" if selected else PANEL2
    return group("Material-" + title.replace("+", "plus").replace(" ", "-"),
                 rect(x, y, w, 58, fill, 7, stroke),
                 text(x+13, y+24, title, 12, WHITE, 600), text(x+13, y+44, subtitle, 10, MUTED))


def spec_option(x, y, w, title, subtitle, selected=False):
    return group("Layer-" + title.replace(" ", "-"),
                 rect(x, y, w, 48, "#25191C" if selected else PANEL2, 7, RED if selected else STROKE),
                 text(x+13, y+21, title, 11, WHITE, 600), text(x+13, y+38, subtitle, 9, MUTED))


def button(x, y, w, h, title, fill, arrow=False):
    items = [rect(x, y, w, h, fill, 8), text(x+20, y+h/2+5, title, 13, BG if fill == GOLD else WHITE, 700)]
    if arrow:
        items.append(f'<path d="M{x+w-37} {y+h/2}h16m-6-6 6 6-6 6" fill="none" stroke="{BG if fill == GOLD else WHITE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>')
    return group("Button-" + title.replace(" ", "-"), *items)


def overlay_screen():
    parts = [rect(0, 0, 1440, 1024, "#050608", opacity=.82),
             rect(397, 166, 646, 694, PANEL, 16, STROKE),
             circle(438, 211, 15, "#1B3022"),
             f'<path d="M431 211l5 5 9-11" fill="none" stroke="{GREEN}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
             text(470, 207, "BẢN TÓM TẮT ĐÃ SẴN SÀNG", 10, GREEN, 600, spacing=.8),
             text(470, 239, "Kiểm tra lại yêu cầu in", 23, WHITE, 700),
             text(470, 265, "Bạn có thể quay lại sửa thông tin trước khi gửi xưởng.", 12, MUTED),
             rect(990, 185, 34, 34, PANEL2, 7, STROKE), text(1007, 209, "×", 20, MUTED, anchor="middle"),
             line(430, 286, 1010, 286),
             text(430, 320, "TỆP MÔ HÌNH", 9, DIM, 600, spacing=.7),
             text(1010, 320, "mascot-voxel.stl  ·  2.8 MB", 12, WHITE, 600, anchor="end"),
             line(430, 337, 1010, 337),
             text(430, 370, "VẬT LIỆU", 9, DIM, 600, spacing=.7), text(1010, 370, "PETG", 12, WHITE, 600, anchor="end"),
             text(430, 401, "ĐỘ MỊN LỚP IN", 9, DIM, 600, spacing=.7), text(1010, 401, "0.16 mm", 12, WHITE, 600, anchor="end"),
             text(430, 432, "KÍCH THƯỚC TỆP", 9, DIM, 600, spacing=.7), text(1010, 432, "140 × 100 × 180 mm", 12, WHITE, 600, anchor="end"),
             text(430, 463, "SỐ LƯỢNG", 9, DIM, 600, spacing=.7), text(1010, 463, "02", 12, WHITE, 600, anchor="end"),
             line(430, 483, 1010, 483),
             text(430, 516, "THÔNG TIN LIÊN HỆ", 9, DIM, 600, spacing=.7),
             text(430, 549, "Nguyễn Minh", 12, WHITE, 500), text(1010, 549, "0901 234 567", 12, WHITE, 500, anchor="end"),
             rect(430, 577, 580, 100, PANEL2, 9, STROKE),
             text(449, 605, "ƯỚC TÍNH BÁO GIÁ", 9, DIM, 600, spacing=.7),
             text(449, 635, "Kỹ sư sẽ kiểm tra mô hình", 13, WHITE, 600),
             text(449, 658, "và gửi giá cụ thể qua Zalo trước khi in.", 11, MUTED),
             line(430, 704, 1010, 704),
             button(430, 727, 280, 48, "Quay lại chỉnh sửa", PANEL2),
             button(726, 727, 284, 48, "Mở chat Zalo", RED, arrow=True),
             text(720, 819, "Bản xem trước này chưa gửi yêu cầu đến xưởng.", 10, DIM, anchor="middle")]
    return group("06-Summary-confirmation-overlay", *parts)


def make_svg(filename, state, step, selected=False, configured=False, error=False, filled=False, is_overlay=False):
    sections = [] if is_overlay else [rect(0, 0, 1440, 1024, BG)]
    if is_overlay:
        sections += [overlay_screen()]
    else:
        sections += [header(), heading(), progress(step), preview_panel(selected),
                     form_panel(configured, error, filled)]
        sections += [group("05-Flow-caption",
                           text(72, 989, state, 10, DIM, 500, spacing=.6),
                           text(1368, 989, "MINHLAB 3D  ·  PROTOTYPE #2", 9, DIM, 500, anchor="end", spacing=.6))]
    title = f"HO #5 / {state}"
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1024" viewBox="0 0 1440 1024" role="img" aria-label="{esc(title)}">'
           f'<title>{esc(title)}</title>{"".join(sections)}</svg>')
    (HERE / filename).write_text(svg, encoding="utf-8")


def main():
    HERE.mkdir(parents=True, exist_ok=True)
    make_svg("01-bat-dau.svg", "01 / Tải tệp", 1, selected=False)
    make_svg("02-da-nap-tep.svg", "02 / Tệp đã nạp", 2, selected=True)
    make_svg("03-chon-cau-hinh.svg", "03 / Đổi cấu hình", 2, selected=True, configured=True)
    make_svg("04-loi-thieu-so-dien-thoai.svg", "04 / Báo lỗi số điện thoại", 3, selected=True, configured=True, error=True)
    make_svg("05-thong-tin-hop-le.svg", "05 / Thông tin hợp lệ", 3, selected=True, configured=True, filled=True)
    make_svg("06-tom-tat-overlay.svg", "06 / Tóm tắt yêu cầu", 4, is_overlay=True)
    print("Created 6 SVG prototype states in", HERE)


if __name__ == "__main__":
    main()
