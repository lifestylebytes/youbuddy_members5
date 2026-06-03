# -*- coding: utf-8 -*-
import re
from collections import Counter
from vocab_6th import all_words

def norm(s):
    s = s.lower().strip()
    s = s.replace("’", "'").replace("‘", "'")
    s = re.sub(r"^the\s+", "", s)
    s = re.sub(r"^get your\b", "get one's", s)
    s = re.sub(r"\byour\b", "one's", s)
    s = re.sub(r"[^a-z' ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

FIVE = """Anchor|Benefit of the doubt|Bite the bullet|Blank canvas|Call the shots|Competitive edge|Connect the dots|Constructive criticism|Contingency plan|Cross the finish line|Cut to the chase|Damage control|Deep work|Deliver the goods|Drill down|Elephant in the room|First pass|Flesh out|Front-load|Game changer|Get buy-in|Get in the zone|Get it over the line|Give time back|Go the extra mile|Go-to person|Gut check|Heavy lifting|Hit the ground running|Jump through hoops|Key driver|Laser-focused|Lessons learned|Meet halfway|Middle ground|Move in lockstep|Pain point|Post-mortem|Put the finishing touches|Ramp up|Read the room|Red tape|Reinvent the wheel|Scale up|Scratch the surface|Set the stage|Silver lining|Stay ahead of the pack|Stumbling block|Sugarcoat|Synergy|Take it offline|Timebox|Unpack|Uphill battle|Value proposition|Vetting process|Viability""".split("|")

ONE = """put a pin in it|play it by ear|in the pipeline|ahead of the curve|iron out|raise a red flag|at face value|on the back burner|bumping up|corporate jargon|ducks in a row|time-bound|in flux|take ownership|off track|pencil it in|soft commit|rumor mill|hunch|dial down|dialed in|move the needle|table it for now|in flight|on my radar|swamped|have the cycles|keep an eye on|bandwidth|High level view|get ahead of|quick sanity check|TL;DR|signing off|touch base|circling back|quick win|low hanging fruit|edge case|moving pieces|our very own|second nature|on your end|a second pair of eyes|I doubt about it|hive mind|by any chance|hectic|with a caveat|down the line""".split("|")

TWO = """false premise|go off on a tangent|kick the can down the road|see it through|too many stakeholders|fix at the root|scope creep|push back gently|fall through the cracks|stalled out|sharpen the focus|get traction|skirt around|nitpick|scramble|build in buffer time|ease the load|warrants further review|for context|key takeaway|might be redundant|lag behind|out of scope|hand off|bottleneck|get a clear read on|on the surface|in the grand scheme of things|helter-skelter|get the ball rolling""".split("|")

THREE = """out of scope|by any chance|hand off|follow up|touch base|loop in|Same old, same old|I've been meaning to|That reminds me|I might be wrong|From my perspective|One thing to consider is|bandwidth|prioritizing|tight deadlines|work around|tackle|run into|FYI|action items|next steps|get back to|leave a message|put through|change in the timeline|look into|I'd appreciate|would you|heads up|sync up|walk through|wrap up|dive into|Copy that|Noted|on my radar|You're cutting off|reconvene|take the lead|social battery|air quality|That's how the cookie crumbles|initiative|ownership|proactivity|behind schedule|hard stop|by EOD|Is now a good time|quick call|This is from|raise the bar|scope creep|shake things up|stock options|severance pay|year-end tax adjustment|clarify|deliverables|No further changes needed|sign off|open items|handoff notes|context|best wishes|continued success|in your next role""".split("|")

FOUR = """knock out|commitments|To recap|key takeaway|nitpick|a second pair of eyes|data point|assumption|lay the groundwork for|deprioritize|tentative|by EOD|table it for now|open items|lock this in|iterate|pros and cons|a couple of paths forward|out of scope|scope creep|on my radar|jump in|knowledge transfer|double-click on|hand off|deliverables|get on the same page|DRI|decide on|stalled out|gentle reminder|close the loop|circling back|TL;DR|please find attached|For visibility|push back|swamped|down the line|downside risk|raise a red flag|path forward|in flight|bottleneck|Here's where we are|I see where you're coming from|raise a concern|trade-off|best approach|ICYMI|switched gears to|just to clarify|On that note|kick off|two main perspectives|at the core|align on|North Star|watch closely|monitor|to-dos|tasks|in summary|to summarize|key message|main point|focus on trivial details|be overly picky|double-check|hypothesis|a quick review|premise|figure|metric|per the document|based on the doc|push down the list|lower priority|pending items|outstanding items|park it|before COB|put it on hold|provisional|not final|by end of day|finalize|confirm|improve|refine|trade-offs|advantages and disadvantages|one option is|we can either|not included|beyond scope|in my queue|expanding scope|requirements creep|on my list|If I may|May I add something|be aligned|align|connect|handover doc|transition doc|work products|outputs|transfer|pass along|point person|choose|settle on|owner|got stuck|hit a standstill|quick reminder|friendly reminder|get back to you|checking in|quick summary|following up|for your reference|in short|I've included|attached is|just so you know|extend|postpone|leave wiggle room|slammed|overloaded|add slack|minimize|sound the alarm|reduce|concern|flag an issue|potential issue|what we'll do next|in progress|underway|quick update|current status is|constraint|triaging|compromise|blocker|give-and-take|ranking|voice a concern|flag a concern|have concerns|I'm not convinced|I get your point|That makes sense|As a heads-up|I'd like to shift to|Just in case|Before we move on|Speaking of which|highlighting the risk around|So you're saying|If I understood correctly|differing views on|The key point is|Bottom line|launch|get started|true north|guiding principle""".split("|")

five = {norm(x) for x in FIVE}
one = {norm(x) for x in ONE}
two = {norm(x) for x in TWO}
three = {norm(x) for x in THREE}
four = {norm(x) for x in FOUR}

rows = all_words()
print("총 단어 수:", len(rows))
print("출처 분포:", dict(Counter(r["src"] for r in rows)))

# 1) 6기 내부 중복
seen = Counter(norm(r["en"]) for r in rows)
dups = {k: v for k, v in seen.items() if v > 1}
print("\n[1] 6기 내부 중복:", dups if dups else "없음 ✅")

# 2) 모든 6기 단어가 3기/4기/5기와 겹치는지 (재사용 1·2기는 1·2기 매칭 허용)
print("\n[2] 전체 6기 단어 vs 3·4·5기 충돌 (핵심 더블체크):")
bad = False
for r in rows:
    n = norm(r["en"])
    hits = []
    if n in three: hits.append("3기")
    if n in four: hits.append("4기")
    if n in five: hits.append("5기")
    if hits:
        bad = True
        print(f"  ⚠️ [{r['src']}] {r['en']} (Day{r['day']}) → {hits}")
if not bad:
    print("  3·4·5기 충돌 없음 ✅")

# 2b) 신규 단어가 1·2기와도 안 겹치는지
print("\n[2b] 신규(new) 단어 vs 1·2기 충돌:")
bad2 = False
for r in rows:
    if r["src"] != "new":
        continue
    n = norm(r["en"])
    hits = []
    if n in one: hits.append("1기")
    if n in two: hits.append("2기")
    if hits:
        bad2 = True
        print(f"  ⚠️ {r['en']} → {hits}")
if not bad2:
    print("  충돌 없음 ✅")

# 3) 재사용 단어가 실제로 해당 기수에 존재하는지
print("\n[3] 재사용 단어 출처 검증:")
for r in rows:
    if r["src"] == "1기":
        ok = norm(r["en"]) in one
        print(f"  {'✅' if ok else '❌'} [1기] {r['en']}")
    elif r["src"] == "2기":
        ok = norm(r["en"]) in two
        print(f"  {'✅' if ok else '❌'} [2기] {r['en']}")

# 4) Day별 3단어 확인
print("\n[4] Day별 단어 수:")
byday = Counter(r["day"] for r in rows)
prob = {d: c for d, c in byday.items() if c != 3}
print("  이상 있는 Day:", prob if prob else "없음 (전 Day 3단어) ✅")
print("  Day 범위:", min(byday), "~", max(byday), f"({len(byday)}일)")
