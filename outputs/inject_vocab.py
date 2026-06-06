# -*- coding: utf-8 -*-
"""6기 어휘를 6th/index.html 의 Day1~20 단어객체에 안전 주입.
각 'day 헤더' 라인의 title/goal 교체 + 헤더 바로 뒤 3개 { en: ... } 단어라인만 교체.
미팅/빙고/퀴즈 블록의 en 객체는 건드리지 않음."""
import re
from collections import defaultdict
from vocab_6th import all_words

PATH = "/sessions/lucid-gallant-dirac/mnt/youbuddy-challenge-claude/6th/index.html"

# Day별 goal (en은 큰따옴표, kr은 작은따옴표로 들어감)
GOALS = {
 1:("Pull in the right people and get the lay of the land.","필요한 사람 모으고 판부터 파악하기."),
 2:("Get a ballpark, stub out a start, and decide who runs point.","대략 추정하고 초안 잡고 담당 정하기."),
 3:("Brainstorm freely and nail the table stakes.","자유롭게 펼치되 기본은 확실히."),
 4:("Carve out time, get your ducks in a row, and park the rest.","시간 확보, 준비 완료, 나머지는 보류."),
 5:("See eye to eye and let everyone weigh in.","방향 맞추고 다 같이 의견 보태기."),
 6:("Build on others, hash it out, and be a sounding board.","얹어 말하고 끝까지 정리하기."),
 7:("Run a temperature check and stop talking past each other.","분위기 보고 동문서답 막기."),
 8:("Mind the details, flag concerns, and avoid tangents.","디테일 챙기고 우려는 짚고 곁가지는 차단."),
 9:("Boil it down, bring something to the table, and run with it.","핵심으로 좁히고 기여하고 밀고 가기."),
 10:("Take it with a grain of salt and watch the goalposts.","걸러 듣고 기준 변경 경계하기."),
 11:("Find the root cause and get to the bottom of it, no band-aids.","근본 원인까지 파헤치기, 임시방편 금지."),
 12:("Untangle the mess, iron out the kinks, and stop spinning your wheels.","엉킨 거 풀고 헛바퀴 멈추기."),
 13:("Don't cut corners; go back to the drawing board if needed.","날림 금지, 필요하면 원점에서."),
 14:("De-risk, future-proof, and stop kicking the can down the road.","리스크 줄이고 미래 대비, 미루기 끝."),
 15:("Keep things from falling through the cracks and move the needle.","누락 막고 실질 성과 만들기."),
 16:("Ship it, push it live, and get the greenlight.","내보내고 띄우고 승인받기."),
 17:("Tie up loose ends and get real traction.","잔무 정리하고 탄력 받기."),
 18:("Up the ante across the board and rally the team.","전반의 수준 높이고 팀 결집."),
 19:("Exceed expectations, overdeliver, and hit the nail on the head.","기대 뛰어넘고 정곡 찌르기."),
 20:("Skip the bells and whistles, protect your bread and butter, sunset the rest.","군더더기 빼고 핵심은 지키고 나머진 정리."),
}

def sq(s):  # 작은따옴표 필드 이스케이프
    return s.replace("\\", "\\\\").replace("'", "\\'")
def dq(s):  # 큰따옴표 필드 이스케이프
    return s.replace("\\", "\\\\").replace('"', '\\"')

assert "—" not in "".join(g[0]+g[1] for g in GOALS.values()), "em dash in goals!"

by_day = defaultdict(list)
for w in all_words():
    by_day[w["day"]].append(w)
for d in by_day:
    assert len(by_day[d]) == 3, f"day {d} != 3 words"

def word_line(w):
    syn = ", ".join("'%s'" % sq(s) for s in w["syn"])
    line = ("            { en: '%s', pos: '%s', def: '%s', ex_en: \"%s\", ex_kr: '%s', syn: [%s], nuance: '%s' },"
            % (sq(w["en"]), sq(w["pos"]), sq(w["def"]), dq(w["ex_en"]), sq(w["ex_kr"]), syn, sq(w["nuance"])))
    assert "—" not in line, "em dash in word line: " + w["en"]
    return line

header_re = re.compile(r"^(\s*)\{ day: (\d+), title: '.*?', goal_en: \".*?\", goal_kr: '.*?',\s*$")
enstart_re = re.compile(r"""^\s*\{ en: ['"]""")
# 단어객체 데이터에서 day title 가져오기
day_title = {}
import vocab_6th
for wk in vocab_6th.WEEKS:
    for dd in wk["days"]:
        day_title[dd["day"]] = dd["title"]

with open(PATH, encoding="utf-8") as f:
    lines = f.readlines()

out = []
i = 0
cur_day = None
words_left = 0
wi = 0
replaced_headers = 0
replaced_words = 0
while i < len(lines):
    line = lines[i]
    m = header_re.match(line)
    if m and int(m.group(2)) in GOALS:
        indent = m.group(1)
        d = int(m.group(2))
        ge, gk = GOALS[d]
        title = day_title[d]
        out.append("%s{ day: %d, title: '%s', goal_en: \"%s\", goal_kr: '%s',\n" % (indent, d, sq(title), dq(ge), sq(gk)))
        cur_day = d
        words_left = 3
        wi = 0
        replaced_headers += 1
        i += 1
        continue
    if words_left > 0 and enstart_re.match(line):
        # 단어 객체 전체(여러 줄 가능) 소비: rstrip 이 '},' 로 끝나는 줄까지
        j = i
        while j < len(lines) and not lines[j].rstrip().endswith("},"):
            j += 1
        out.append(word_line(by_day[cur_day][wi]) + "\n")
        wi += 1
        words_left -= 1
        replaced_words += 1
        i = j + 1
        continue
    out.append(line)
    i += 1

assert replaced_headers == 20, f"headers replaced {replaced_headers} != 20"
assert replaced_words == 60, f"words replaced {replaced_words} != 60"

with open(PATH, "w", encoding="utf-8") as f:
    f.writelines(out)
print(f"OK: 헤더 {replaced_headers}개, 단어 {replaced_words}개 교체 완료")
