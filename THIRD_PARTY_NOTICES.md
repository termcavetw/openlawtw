# 第三方元件

分享圖卡使用 qrcode-generator 2.0.4（Copyright (c) 2009 Kazuhiko Arase，MIT）。完整聲明見 [vendor/qrcode-generator.LICENSE.txt](vendor/qrcode-generator.LICENSE.txt)；QR Code 直接在本機產生，未使用第三方製圖服務。

本專案使用 Vite、React、Tailwind CSS、Shadcn 元件、Radix UI、Lucide、Sonner 及其相依套件。

原始版本與依賴關係以 package.json、package-lock.json 為準。這些套件遵循各套件隨附的 LICENSE / NOTICE；本專案的 MIT 聲明不改變其授權。

UI 元件與執行腳本沿用網站起始專案。重新散布時請保留原始程式內註記，並隨所發布依賴保留其授權檔。官方法規資料另外依 DATA_LICENSE.md 處理。

視覺與互動設計參考 Emil Kowalski 的 `emil-design-eng` 與 `mobile-native` skills（MIT）：https://github.com/emilkowalski/skills 。本專案採用其按壓回饋、具體 transition 屬性、減少動態效果、行動端 safe area 與輸入字級等原則；未修改或重新發布該 skills 套件。

## Thinking Orbs

The 20px working Canvas2D preset in `components/thinking-orb.tsx` is adapted from [Thinking Orbs](https://github.com/RareFormLabs/thinking-orbs), upstream commit `e09bfa600c9196e0e8979f5ba59bcda45cbe1fa7`. The React lifecycle integration is local; no Vue runtime or external service is used.

MIT License

Copyright (c) 2026 Jakub Antalik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
