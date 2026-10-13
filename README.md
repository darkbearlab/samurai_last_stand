# Samurai Last Stand

以歷史上武士的最後一戰為題材的瀏覽器第一人稱刀戰 roguelike 合集。每位人物、每場戰役各自一個目錄，根目錄的 `index.html` 是選擇入口。

## 收錄

| 目錄 | 人物 | 戰場 | 狀態 |
| --- | --- | --- | --- |
| [`nijo_gosho/`](nijo_gosho/) | 足利義輝 | 永祿之變（1565）・二條御所 | 原型 v0.1.0 |
| [`nijo_gosho_gun/`](nijo_gosho_gun/) | 足利義輝（？） | 二條御所・銃（搞笑變體：全員熱兵器） | 原型，共用 `nijo_gosho/js` |
| [`nijo_gosho_survivor/`](nijo_gosho_survivor/) | 足利義輝 | 二條御所・生存者（大量湧入、刀不會鈍） | 原型，共用 `nijo_gosho/js` |

## 執行

不需要建置，直接用瀏覽器開啟根目錄的 `index.html`，或任一作品目錄下的 `index.html`。開啟 GitHub Pages 後，根網址就是選擇入口。

## 新增人物或模式

1. 在根目錄新增一個作品目錄，例如 `some_battle/`，放入該作品的 `index.html`。
2. 在根目錄 `index.html` 的 `SCENARIOS` 陣列加一筆資料（路徑、年份、人物、戰場、簡介、標籤）。
3. 只改設定、文字、美術的變體，可以像 `nijo_gosho_gun/` 一樣共用本篇的程式，只放一個 `index.html` 與覆寫用的 `variant.js`。
4. 作品的開始畫面可以放一個 `../index.html` 的返回連結，回到選擇入口。
