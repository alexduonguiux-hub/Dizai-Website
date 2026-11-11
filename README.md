# Dizai-Website

Website của Đìzai Studio. HTML/CSS tĩnh, không cần build: mở `index.html` hoặc deploy cả thư mục lên bất kỳ static host nào (GitHub Pages, Netlify, Vercel…).

## Cấu trúc
- `index.html`: trang Home, dựng từ Figma *Đìzai Studio – Website – NEW*: desktop là frame **Home** `10:1457` (1512 × 813), mobile là frame **Home** `13:8` (390 × 844)
- `assets/js/loader.js`: trang loading (Figma frame **Loading** `13:257`). Số đếm kiểu bảng lật chạy 0 → 100% theo tiến độ tải trang; xong thì cả màn loading thành tấm màn vải 3D (WebGL), tách đôi ở giữa và kéo về hai bên để hiện Home
- `assets/css/style.css`: toàn bộ style và token màu (`--paper`, `--green-900`, `--green-500`)
- `assets/fonts/`: AnNam Serif bản variable woff2 (Roman + Italic, wght 400–700), lấy từ repo `dizai-serif` v0.900
- `assets/img/dizai-studio-seal.svg`: con dấu tròn Đìzai Studio, xuất từ Figma
- `assets/img/star.svg`: dấu ✱ ngăn cách LinkedIn và Facebook trên mobile, xuất từ Figma

## Ghi chú dựng
- **Desktop:** phóng to/thu nhỏ đúng tỉ lệ khung Figma. Mọi kích thước tính theo bề rộng nội dung 1432 px (`100cqi` của `body`). Ở 1512 px, vị trí khớp Figma từng pixel.
- **Mobile (≤ 720 px):** theo frame `13:8`. Bốn dòng chữ 118 px (trên bề rộng 358 px): DESIGN căn giữa, STUDIO căn phải, logo + EST căn giữa, 2024 căn giữa. Danh sách dịch vụ nằm dưới, cách 16 px; cả khối căn giữa màn hình theo chiều dọc. Menu là một hàng ngang trên cùng (→HOME · WORK · CONTACT), liên hệ căn giữa ngay dưới, mạng xã hội là một hàng LINKEDIN ✱ FACEBOOK ở đáy.
- **Cắt dòng chữ:** dòng chữ được cắt sát mép chữ hoa và đường chân chữ, giống `text-box-trim` trong Figma, tính theo metric của AnNam Serif (cap 700, ascender 960, descender 240).
- **Trang loading:** hiện mỗi lần mở trang. Số lật tự chạy tới 90% trong khoảng 1,8 giây, chỉ lên 100% khi trình duyệt tải xong font, ảnh và CSS. Mỗi chữ số là một ô bảng lật (split-flap): nửa trên chữ số cũ gập xuống, nửa dưới chữ số mới rơi vào. Ở 100%, màn loading được vẽ lên một lưới vải WebGL: vải tách ở giữa, phần trên đi trước còn mép dưới đi sau, nếp gấp sâu dần và đổ bóng, trong khoảng 2 giây. Số nếp tính theo bề rộng màn hình. Không có WebGL thì màn loading mờ dần. Bật giảm chuyển động thì không lật số, không kéo màn. Tắt JavaScript thì bỏ qua loading.
- **Mũi tên ←:** AnNam Serif chưa có glyph này, nên mũi tên ở menu đang dùng font hệ thống.
- **Chưa xong:** các trang `work/` và `contact/` chưa có. Link mạng xã hội đang là trang chủ của từng nền tảng, cần thay bằng link profile của studio.

## Xuất bản bằng GitHub Pages
Repo có file `.nojekyll` để GitHub Pages đưa nguyên các file tĩnh lên, không chạy qua Jekyll. Cách bật: vào **Settings → Pages → Build and deployment**, chọn **Source: Deploy from a branch**, rồi chọn nhánh chứa trang (thư mục `/ (root)`) và bấm Save. Trang sẽ có ở `https://alexduonguiux-hub.github.io/Dizai-Website/`.
