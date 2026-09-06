import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../css/editorial-pastel.css", import.meta.url), "utf8");

assert.match(html, /css\/editorial-pastel\.css\?v=\d+/, "새 홈 테마 CSS가 로드되어야 합니다.");
assert.match(html, /class="home-focus-grid"[\s\S]*id="focusTaskCard"[\s\S]*id="timerClock"/, "홈에 지금 할 일과 실제 타이머가 함께 있어야 합니다.");
assert.match(html, /id="page-tracking"[\s\S]*id="todaySessions"/, "시간추적 화면의 기록 목록은 유지되어야 합니다.");

for (const id of ["timerClock", "timerStart", "timerPause", "timerStop", "timerTaskSelect", "trackingTodayTotal"]) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, "g")) || [];
  assert.equal(matches.length, 1, `${id}는 한 번만 존재해야 합니다.`);
}

assert.match(css, /grid-template-columns:minmax\(0,7fr\) minmax\(340px,5fr\)/, "데스크톱 포커스 영역은 7:5 2열이어야 합니다.");
assert.match(css, /@media\(max-width:900px\)/, "모바일 전용 레이아웃이 있어야 합니다.");
assert.match(css, /\.home-dashboard-track\{display:flex;min-height:328px\}/, "모바일 TODAY·D-DAY 스냅 구조를 유지해야 합니다.");

console.log("editorial pastel home regression: ok");
