# Dizai-Website

Website của Đìzai Studio. HTML/CSS tĩnh, không cần build: mở `index.html` hoặc deploy cả thư mục lên bất kỳ static host nào (GitHub Pages, Netlify, Vercel…).

## Cấu trúc
- `index.html`: trang Home, dựng từ Figma *Đìzai Studio – Website – NEW*: desktop là frame **Home** `10:1457` (1512 × 813), mobile là frame **Home** `13:8` (390 × 844)
- `assets/js/loader.js`: trang loading (Figma frame **Loading** `13:257`). Số đếm chạy 0 → 100% (chữ số trượt dọc) theo tiến độ tải trang; xong thì chữ của loading thấm tan vào giấy, logo lớn thu nhỏ và trượt về chỗ của nó trên Home, rồi các phần của Home in ra bằng mực thấm
- `assets/js/ink.js`: hiệu ứng lem mực in khi rê chuột
- `assets/js/cursor.js`: con trỏ chấm tròn màu chữ, đảo sang màu nền khi chồng lên chữ đậm (chỉ trên máy có chuột)
- `assets/css/style.css`: toàn bộ style và token màu (`--paper`, `--green-900`, `--green-500`)
- `assets/fonts/`: AnNam Serif bản variable woff2 (Roman + Italic, wght 400–700), lấy từ repo `dizai-serif` v0.900
- `assets/img/dizai-studio-seal.svg`: logo mark (con dấu tròn) Đìzai Studio, bản mới xuất từ Figma (`17:261`, 198.9 × 231)
- `assets/img/star.svg`: dấu ✱ ngăn cách LinkedIn và Facebook trên mobile, xuất từ Figma

## Ghi chú dựng
- **Desktop:** phóng to/thu nhỏ đúng tỉ lệ khung Figma. Mọi kích thước tính theo bề rộng nội dung 1432 px (`100cqi` của `body`). Ở 1512 px, vị trí khớp Figma từng pixel.
- **Lem mực in khi rê chuột** (`assets/js/ink.js`): bình thường chữ sắc nét. Rê chuột vào một dòng (DESIGN, STUDIO, EST, 2024, từng mục menu, dịch vụ, mạng xã hội, khối liên hệ, SCROLL DOWN) thì mực lem ra mép chữ trong khoảng 0,35 giây: mép loang theo sợi giấy, đọng ở góc trong, và vết lem tiếp tục loang nhẹ trong lúc chuột còn ở đó. Rời chuột thì mực co lại khoảng 0,6 giây, xong thì gỡ bộ lọc. Mỗi dòng có bộ lọc SVG riêng; có ba mức theo cỡ chữ. Chỉ chạy khi dùng chuột, và không chạy trong lúc loading.
- **Màu:** logo mark màu xanh đậm `#215028` ở cả Home và Loading; số 100% ở Loading màu xanh nhạt `#749674` (Figma).
- **Con dấu ở Home:** là một miếng cắt mỏng hình con dấu, không có nền, xoay chậm quanh trục dọc (9 giây một vòng). Độ dày khoảng 2,5% chiều cao, làm từ 24 lớp con dấu xanh đậm xếp sát nhau; các lớp này chỉ hiện khi nghiêng, nên nhìn thẳng thì giống hệt Figma. Mặt sau là hình ngược của con dấu, như khi lật một miếng giấy cắt. Con dấu chỉ bắt đầu xoay khi màn loading kết thúc, từ góc 0°. Bật giảm chuyển động thì con dấu đứng yên.
- **Desktop:** SCROLL DOWN màu xanh nhạt nằm ở góc dưới bên phải hàng DESIGN; LINKEDIN và FACEBOOK nằm ngay dưới khối liên hệ, cách 32 px.
- **Mobile (≤ 720 px):** theo frame `13:8`. Bốn dòng chữ 118 px (trên bề rộng 358 px): DESIGN căn giữa, STUDIO căn phải, logo + EST căn giữa, 2024 căn giữa. Danh sách dịch vụ nằm dưới, cách 16 px; cả khối căn giữa màn hình theo chiều dọc. Menu là một hàng ngang trên cùng (→HOME · WORK · CONTACT), liên hệ căn giữa ngay dưới, mạng xã hội là một hàng LINKEDIN ✱ FACEBOOK ở đáy, phía trên có dòng SCROLL DOWN màu xanh nhạt, cách 32 px.
- **Cắt dòng chữ:** dòng chữ được cắt sát mép chữ hoa và đường chân chữ, giống `text-box-trim` trong Figma, tính theo metric của AnNam Serif (cap 700, ascender 960, descender 240).
- **Trang loading:** hiện mỗi lần mở trang. Số đếm tự chạy tới 90% trong khoảng 1,8 giây, chỉ lên 100% khi trình duyệt tải xong font, ảnh và CSS. Mỗi chữ số là một ô cửa sổ: số cũ trượt lên ra khỏi ô, số mới trượt lên vào chỗ. Trong lúc đếm, các ô rộng bằng nhau (bằng chữ số rộng nhất) nên hàng số không lắc ngang, và các cú trượt nối nhau với tốc độ đều. Tới 100%, cú trượt cuối chậm lại, và cả hàng co một lần về độ rộng thật của từng chữ số cùng kerning của font, để khớp Figma trước khi chuyển sang Home. Ba chấm của LOADING... hiện lần lượt rồi tắt, lặp lại. Ở desktop, logo trên màn loading được vẽ lớn (cao 381 px, Figma `17:323`) và số 100% căn theo đáy logo. Ở 100%, số đếm, khối liên hệ và chữ LOADING... lần lượt thấm tan vào giấy. Cùng lúc, logo lớn thu nhỏ và trượt về đúng chỗ con dấu trên Home (1 giây, chậm dần ở đầu và cuối); trên mobile logo trượt từ góc dưới lên cạnh chữ EST. Khi logo đáp xuống, con dấu 3D của Home thế chỗ và bắt đầu xoay. Các phần của Home lần lượt in ra: mực hiện ở lõi nét dày trước, nhạt rồi đậm dần, loang ra tới nét mảnh, có vân sợi giấy. Cả chuỗi khoảng 2 giây. Phần mực thấm là bộ lọc SVG cho từng phần tử: nhiễu sợi giấy (`feTurbulence`) trộn với nét chữ đã làm mờ (lõi nét), lấy ngưỡng (`feComponentTransfer`) tăng dần theo thời gian. Bật giảm chuyển động thì số không trượt, màn loading chỉ mờ đi. Tắt JavaScript thì bỏ qua loading.
- **Con trỏ:** chấm 12 px. Hai lớp chồng nhau (`difference` với trắng, rồi `plus-lighter` cộng rgb(18 64 23)) cho kết quả (nền + mực − màu bên dưới) theo từng pixel: trên nền giấy chấm có màu #215028, trên chữ #215028 thì vùng chồng thành #f0efee, trên chữ xanh nhạt thì thành xám xanh sáng. Rê vào link thì chấm to lên 48 px. Chỉ bật khi có chuột (không bật trên màn cảm ứng), và chỉ ẩn con trỏ hệ thống sau lần di chuột đầu tiên. Trình duyệt không hỗ trợ `plus-lighter` thì hiện chấm xanh thường, không đảo màu.
- **Mũi tên ←:** AnNam Serif chưa có glyph này, nên mũi tên ở menu đang dùng font hệ thống.
- **Chưa xong:** các trang `work/` và `contact/` chưa có. Link mạng xã hội đang là trang chủ của từng nền tảng, cần thay bằng link profile của studio.

## Xuất bản bằng GitHub Pages
Repo có file `.nojekyll` để GitHub Pages đưa nguyên các file tĩnh lên, không chạy qua Jekyll. Cách bật: vào **Settings → Pages → Build and deployment**, chọn **Source: Deploy from a branch**, rồi chọn nhánh chứa trang (thư mục `/ (root)`) và bấm Save. Trang sẽ có ở `https://alexduonguiux-hub.github.io/Dizai-Website/`.

**Cache:** GitHub Pages cho trình duyệt giữ CSS/JS tới 10 phút. Vì vậy `index.html` gắn `?v=…` vào đường dẫn `style.css`, `loader.js` và `cursor.js`. Mỗi lần sửa các file này, đổi số `v` để người xem nhận bản mới ngay.
