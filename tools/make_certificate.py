#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""유비챌 참가확인서(회사 제출용 수강증) PDF 생성기 (2026-10-22, 10기 양지유님 건으로 형식 확정)

멤버가 "회사 제출용 수강증"을 요청하면 이걸로 만든다. 수강자명 · 수강기간 · 수강금액이 들어가고,
발급자(브랜드·사업자등록번호) · 직인까지 찍힌다. 상호·대표 이름은 안 넣는다.

사용:
  python3 tools/make_certificate.py --name 양지유 --cohort 10 \
      --start 2026-10-19 --end 2026-11-13 --amount 99000 --paid 2026-10-11 \
      [--course 베이직] [--issued 2026-10-19] [--seq 1]

출력: _archive/{N}기/운영/확인서/{N}기_참가확인서_{이름}.pdf  (PDF 는 .gitignore 로 공개 저장소에 안 올라감)
문서번호: YB-{N}-{발급연도}-{seq 3자리}. 같은 기수에서 두 번째 발급이면 --seq 2.
"""
import argparse, datetime, os, sys

# ── 발급자 정보 (바뀌면 여기만 고친다) ──
ISSUER_BRAND = '유버디 (YOUBUDDY)'
SEAL_TEXT = '유버디인'              # 직인 글자 4자 (2x2). 상호·대표 이름은 넣지 않기로 함 (2026-10-22 버디)
ISSUER_BIZNO = '703-91-02314'
ISSUER_CONTACT = 'youbuddy.co.kr · 문의 http://pf.kakao.com/_ExdxcGX'

p = argparse.ArgumentParser()
p.add_argument('--name', required=True)
p.add_argument('--cohort', required=True, type=int)
p.add_argument('--start', required=True)
p.add_argument('--end', required=True)
p.add_argument('--amount', required=True, type=int, help='부가세 포함 결제 금액 (원)')
p.add_argument('--paid', required=True, help='결제일 YYYY-MM-DD')
p.add_argument('--course', default='베이직')
p.add_argument('--issued', default=None, help='발급일 (기본: 시작일과 오늘 중 늦은 날)')
p.add_argument('--seq', default=1, type=int)
p.add_argument('--days', default=20, type=int)
p.add_argument('--out', default=None)
a = p.parse_args()

WD = '월화수목금토일'
def d(s): return datetime.date.fromisoformat(s)
def kdate(x, wd=False): return f"{x.year}년 {x.month}월 {x.day}일" + (f"({WD[x.weekday()]})" if wd else '')

start, end, paid = d(a.start), d(a.end), d(a.paid)
issued = d(a.issued) if a.issued else max(start, datetime.date.today())
weeks = round(((end - start).days + 3) / 7)
docno = f"YB-{a.cohort}-{issued.year}-{a.seq:03d}"
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = a.out or os.path.join(root, '_archive', f'{a.cohort}기', '운영', '확인서', f'{a.cohort}기_참가확인서_{a.name}.pdf')
os.makedirs(os.path.dirname(out), exist_ok=True)

# 직인: 붉은 원형 도장 (유버디인, 2x2). 살짝 기울이고 번짐을 줘서 찍은 느낌.
seal = f"""<span class="seal"><span class="s1">{SEAL_TEXT[0]}</span><span class="s2">{SEAL_TEXT[1]}</span><span class="s3">{SEAL_TEXT[2]}</span><span class="s4">{SEAL_TEXT[3]}</span></span>"""

html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
@page {{ size: A4; margin: 20mm 20mm 16mm; }}
body {{ font-family: 'Noto Sans CJK KR','Noto Sans KR',sans-serif; color:#2C2420; font-size:12pt; line-height:1.65; }}
.top {{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #7B3B4E; padding-bottom:8px; }}
.brand {{ font-size:10.5pt; letter-spacing:.12em; color:#7B3B4E; font-weight:700; }}
.docno {{ font-size:9pt; color:#8a7f82; text-align:right; }}
h1 {{ text-align:center; font-size:23pt; letter-spacing:.3em; margin:26px 0 20px; font-weight:800; }}
table {{ width:100%; border-collapse:collapse; margin:6px 0 14px; }}
th, td {{ border:1px solid #d9cfd3; padding:8px 12px; vertical-align:top; }}
th {{ width:28%; background:#F6EEF1; text-align:left; font-weight:700; color:#55253A; }}
.body {{ margin:16px 4px 0; font-size:12.5pt; }}
.date {{ text-align:center; margin-top:26px; font-size:12.5pt; }}
.issuer {{ text-align:center; margin-top:18px; line-height:1.9; }}
.issuer b {{ font-size:15pt; letter-spacing:.1em; }}
.ceo {{ position:relative; display:inline-block; font-size:13pt; }}
.seal {{ position:absolute; right:-22px; top:-16px; width:60px; height:60px; border:2.8px solid #C8262B; border-radius:50%;
        transform:rotate(-8deg); opacity:.86; box-sizing:border-box; }}
.seal span {{ position:absolute; width:22px; text-align:center; font-family:'Noto Serif CJK KR','Noto Serif CJK SC',serif; font-weight:900; color:#C8262B; font-size:12.5pt; line-height:20px; }}
.seal .s1 {{ left:7px; top:7px; }} .seal .s2 {{ right:7px; top:7px; }}
.seal .s3 {{ left:7px; top:27px; }} .seal .s4 {{ right:7px; top:27px; }}
.small {{ font-size:10pt; color:#5a5054; }}
.foot {{ margin-top:22px; font-size:9pt; color:#8a7f82; border-top:1px solid #e6dde0; padding-top:8px; line-height:1.5; }}
</style></head><body>
<div class="top">
  <div class="brand">YOUBUDDY · 유버디 비즈니스 영어 챌린지</div>
  <div class="docno">문서번호 {docno}<br>발급일 {kdate(issued)}</div>
</div>
<h1>참 가 확 인 서</h1>
<table>
  <tr><th>성명</th><td>{a.name}</td></tr>
  <tr><th>프로그램명</th><td>유버디 비즈니스 영어 챌린지 {a.cohort}기 ({a.course} 과정)</td></tr>
  <tr><th>교육 기간</th><td>{kdate(start, True)} ~ {kdate(end, True)} · {weeks}주 · 총 {a.days}일 (평일)</td></tr>
  <tr><th>교육 방식</th><td>온라인 (학습 웹페이지 + 카카오톡 오픈채팅 · 매일 20분 자기주도 학습)</td></tr>
  <tr><th>교육 내용</th><td>외국계 실무 비즈니스 영어 표현 60개 학습 · 상황별 문장 작성 및 AI 교정 · 일일 단어 시험 · 주간 복습 테스트 · 음성 발화 인증 · 파이널 테스트</td></tr>
  <tr><th>수강료</th><td>{a.amount:,}원 (부가세 포함) · {kdate(paid)} 결제 완료</td></tr>
</table>
<div class="body">위 사람은 본 프로그램에 정식으로 등록하여 상기 기간 동안 교육에 참가함을 확인합니다.</div>
<div class="date">{kdate(issued)}</div>
<div class="issuer">
  <span class="ceo"><b>{ISSUER_BRAND}</b> (인){seal}</span><br>
  <span class="small">사업자등록번호 {ISSUER_BIZNO} · {ISSUER_CONTACT}</span>
</div>
<div class="foot">본 확인서는 교육 참가 사실을 증명하기 위해 발급되었으며, 수료 여부는 교육 종료 후 별도 수료증으로 확인합니다. 위·변조 시 효력이 없습니다.</div>
</body></html>"""

from weasyprint import HTML
HTML(string=html).write_pdf(out)
print(out)
