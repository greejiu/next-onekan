import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/tracking-stats.js", import.meta.url), "utf8");
const css = await readFile(new URL("../css/tracking-stats.css", import.meta.url), "utf8");

assert.doesNotMatch(source, /오늘 시간 통계|ensureHomePanel|uw-home-mini-stats|renderHome\(latestRawState\)/, "홈 시간 통계 생성 코드가 없어야 합니다.");
assert.doesNotMatch(css, /uw-home-stats-ready|uw-home-mini-stats/, "홈 시간 통계 전용 레이아웃이 없어야 합니다.");
assert.match(source, /function renderTracking\(raw\)/, "시간추적 탭 통계는 유지되어야 합니다.");
assert.match(source, /function renderReports\(raw\)/, "리포트 통계는 유지되어야 합니다.");

console.log("remove home time stats regression: ok");
