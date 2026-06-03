# -*- coding: utf-8 -*-
"""6기 마감 손질: ①5기 미팅 Drive URL 제거 ②테마색 주황->로즈레드 ③em/en dash 정리"""
import re

PATH = "/sessions/lucid-gallant-dirac/mnt/youbuddy-challenge-claude/6th/index.html"
with open(PATH, encoding="utf-8") as f:
    t = f.read()
orig = t

# 1) 5기 미팅 녹화 Drive 공유 URL 전부 제거 (recordingUrl 빈값화 -> 팝업 자동 비활성)
drive_before = len(re.findall(r"drive\.google\.com/file/d/", t))
t = re.sub(r"https://drive\.google\.com/file/d/[A-Za-z0-9_\-]+/view\?usp=sharing", "", t)
drive_after = len(re.findall(r"drive\.google\.com/file/d/", t))

# 2) 테마색: 주황 계열 -> 로즈레드(빨강·분홍 사이)
color_map = {
    "#E8743C": "#E94C6B",  # --orange (메인)
    "#C95721": "#C82F50",  # --orange-dark
    "#FAE3D1": "#F8D4DE",  # --orange-soft
    "#FDF0E2": "#FDEAF0",  # --orange-ghost
    "#F07D38": "#E94C6B",  # 인라인 하드코딩 주황
    "240,125,56": "233,76,107",   # rgba(240,125,56,..) -> 로즈
    "232,116,60": "233,76,107",   # rgba(232,116,60,..) -> 로즈
    "240, 125, 56": "233, 76, 107",
    "232, 116, 60": "233, 76, 107",
}
color_hits = {}
for a, b in color_map.items():
    c = t.count(a)
    if c:
        color_hits[a] = c
        t = t.replace(a, b)

# 3) em dash / en dash 정리 (Buddy 전역 규칙)
em_before = t.count("—")  # —
en_before = t.count("–")  # –
t = t.replace(" — ", ", ").replace("—", "-")   # em dash
t = t.replace(" – ", ", ").replace("–", "-")   # en dash

with open(PATH, "w", encoding="utf-8") as f:
    f.write(t)

print("Drive URL: 제거 전", drive_before, "-> 후", drive_after)
print("색상 치환:", color_hits)
print("em dash:", em_before, "-> 0 / en dash:", en_before, "-> 0")
print("총 변경 길이차:", len(orig) - len(t))
