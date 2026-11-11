# Dizai-Website

Website của Đìzai Studio. HTML/CSS tĩnh, không cần build: mở `index.html` hoặc deploy cả thư mục lên bất kỳ static host nào (GitHub Pages, Netlify, Vercel…).

## Cấu trúc
- `index.html`: trang Home, dựng từ Figma *Đìzai Studio – Website – NEW*, frame **Home** (node `10:1457`, 1512 × 813)
- `assets/css/style.css`: toàn bộ style và token màu (`--paper`, `--green-900`, `--green-500`)
- `assets/fonts/`: AnNam Serif bản variable woff2 (Roman + Italic, wght 400–700), lấy từ repo `dizai-serif` v0.900
- `assets/img/dizai-studio-seal.svg`: con dấu tròn Đìzai Studio, xuất từ Figma

## Ghi chú dựng
- **Desktop:** phóng to/thu nhỏ đúng tỉ lệ khung Figma. Mọi kích thước tính theo bề rộng nội dung 1432 px (`100cqi` của `body`). Ở 1512 px, vị trí khớp Figma từng pixel.
- **Mobile (≤ 720 px):** ba dòng chữ lớn giữ nguyên tỉ lệ. Menu nằm trên cùng; dịch vụ, liên hệ và mạng xã hội xếp xuống dưới.
- **Cắt dòng chữ:** dòng chữ được cắt sát mép chữ hoa và đường chân chữ, giống `text-box-trim` trong Figma, tính theo metric của AnNam Serif (cap 700, ascender 960, descender 240).
- **Mũi tên ←:** AnNam Serif chưa có glyph này, nên mũi tên ở menu đang dùng font hệ thống.
- **Chưa xong:** các trang `work/` và `contact/` chưa có. Link mạng xã hội đang là trang chủ của từng nền tảng, cần thay bằng link profile của studio.
