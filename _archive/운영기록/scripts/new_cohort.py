#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""새 기수 앱 폴더 자동 생성기 (2026-09-09, 9기 세팅에서 손으로 했던 것 전부를 코드로).

사용: python3 _archive/운영기록/scripts/new_cohort.py --from 9th --to 10th --cohort 10기 \
        --start 2026-10-19 --end 2026-11-13 --theme "#9C6B3F,#6E4A28,#E8D5BE,#F5EDE1" \
        [--kakao https://open.kakao.com/o/xxxx]

하는 일 (전부 자동):
 1. {from}/ → {to}/ 복사, 이전 기수 리포트(report-*.html) 제거
 2. sw.js 캐시 prefix · manifest(start_url/scope/id/name) · localStorage 키(yb{N}_) 분리
 3. CHALLENGE.cohort / start_date / end_date / APP_BUILD / <title> / 화면의 "N기" 문구 전부 치환
 4. MEMBER_DIRECTORY 운영진 3명만 남김 · MEMBER_REPORTS · PREMIUM_MEETING_STATS 비움
 5. 테마색 4종 치환 (--orange 계열 + 인라인 hex + 아이콘 SVG 색)
 6. 카톡방 링크 (있으면) · 미팅 recordingUrl/recap 비움
 7. 검증 3종 (script 파싱 · em dash 0 · 가비 0)
사람이 해야 남는 것은 스크립트 끝에 출력된다 (단어 60개, 유의어 사전, 회의 시뮬, 유버디 톡 원고, 완주 보상 문구).
"""
import argparse, os, re, shutil, json, subprocess, sys
p=argparse.ArgumentParser()
p.add_argument('--from',dest='src',required=True); p.add_argument('--to',dest='dst',required=True)
p.add_argument('--cohort',required=True); p.add_argument('--start',required=True); p.add_argument('--end',required=True)
p.add_argument('--theme',default='', help='주색,진한색,연한색,고스트색 (hex 4개)')
p.add_argument('--kakao',default='')
a=p.parse_args()
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.chdir(ROOT)
src,dst=a.src,a.dst
n_src=re.match(r'(\d+)',src).group(1); n_dst=re.match(r'(\d+)',dst).group(1)
prev_cohort=f'{n_src}기'
assert not os.path.exists(dst), f'{dst} 이미 있음'
shutil.copytree(src,dst)
for f in os.listdir(dst):
    if f.startswith('report-'): os.remove(os.path.join(dst,f))
# sw.js
sw=open(f'{dst}/sw.js',encoding='utf-8').read().replace(src,dst).replace(prev_cohort,a.cohort)
open(f'{dst}/sw.js','w',encoding='utf-8').write(sw)
# manifest
m=json.load(open(f'{dst}/manifest.json',encoding='utf-8'))
m['name']=f'YouBuddy 비즈니스 영어 챌린지 {a.cohort}'; m['short_name']=f'유비챌 {a.cohort}'
m['start_url']=f'/{dst}/'; m['scope']=f'/{dst}/'; m['id']=f'/{dst}/'
idx=f'{dst}/index.html'; s=open(idx,encoding='utf-8').read()
# 기수 문구·키
s=s.replace(f'yb{n_src}_',f'yb{n_dst}_').replace(prev_cohort,a.cohort)
s=re.sub(r"start_date: '\d{4}-\d{2}-\d{2}',[^\n]*", f"start_date: '{a.start}',  // {a.cohort}: 자동 생성 (new_cohort.py)", s, count=1)
s=re.sub(r"end_date: '\d{4}-\d{2}-\d{2}',", f"end_date: '{a.end}',", s, count=1)
s=re.sub(r"const APP_BUILD = '[^']*';", f"const APP_BUILD = '{a.start}';", s, count=1)
# 멤버 명단: 운영진 3명 이후 ~ ]; 사이 제거
i1=s.find('  // COHORT-SLOT(manual):', s.find('const MEMBER_DIRECTORY')); i2=s.find('];', i1)
if i1>0:
    s=s[:i1]+f"  // COHORT-SLOT(manual): {a.cohort} 멤버 명단. 결제 확정되면 code 순으로 추가.\n  // 형식: {{ code: '03', id: 'b2', name: '홍길동', color: 'cream', tier: 'basic' }},  // 영어닉네임\n"+s[i2:]
for key in ['const MEMBER_REPORTS = {','const PREMIUM_MEETING_STATS = {']:
    i1=s.find(key); i2=s.find('};',i1)
    if i1>0: s=s[:i1]+key+'\n'+s[i2:]
# 미팅 녹화본·리캡 비움
s=re.sub(r"recordingUrl: '[^']*'", "recordingUrl: ''", s)
s=re.sub(r"recap: '(?:[^'\\]|\\.)*'", "recap: ''", s)
# 테마
if a.theme:
    c=[x.strip() for x in a.theme.split(',')]
    cur=re.findall(r"--orange: (#[0-9A-Fa-f]{6});\s*--orange-dark: (#[0-9A-Fa-f]{6});\s*--orange-soft: (#[0-9A-Fa-f]{6});\s*--orange-ghost: (#[0-9A-Fa-f]{6});", s)
    if cur:
        old=cur[0]
        for o,nw in zip(old,c): s=s.replace(o,nw)
        m['theme_color']=c[0]
        for ic in m['icons']: ic['src']=ic['src'].replace('%23'+old[0][1:],'%23'+c[0][1:])
        s=s.replace('%23'+old[0][1:],'%23'+c[0][1:])
json.dump(m,open(f'{dst}/manifest.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
# 카톡방
if a.kakao:
    s=re.sub(r"(basic: ')https://open\.kakao\.com/o/[A-Za-z0-9]+(')", r"\g<1>"+a.kakao+r"\2", s, count=1)
    s=re.sub(r"(premium: ')https://open\.kakao\.com/o/[A-Za-z0-9]+(')", r"\g<1>"+a.kakao+r"\2", s, count=1)
open(idx,'w',encoding='utf-8').write(s)
# 검증
r=subprocess.run(['node','-e',"const fs=require('fs'),vm=require('vm');const h=fs.readFileSync(process.argv[1],'utf8');const m=[...h.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];m.forEach((b,i)=>{new vm.Script(b[1])});console.log('script OK '+m.length)",idx],capture_output=True,text=True)
print(r.stdout.strip() or r.stderr.strip())
print('em dash:', s.count('—'), '· 가비:', s.count('가비'))
print(f"""
✅ {dst}/ 생성 완료 ({a.cohort}, {a.start} ~ {a.end})

사람이 해야 남는 것 (순서대로):
 1. 단어 60개: _archive/{a.cohort}/운영/ 커리큘럼 확정 → CHALLENGE.weeks 교체 (9기 때 /tmp/9gi_words.py 방식: 파이썬 리스트 → weeks 블록 생성)
 2. 유의어 뜻 사전(SYNONYM 사전) · 회의 시뮬 12문항 · 파이널 퀴즈 풀 → 새 단어 기준으로 재작성
 3. 유버디 톡 OPS_TALK(모닝 20일 + 스푼) 원고 리라이트
 4. 완주 보상 문구 (투어 ①·FAQ) 확인
 5. 상세페이지·노션 동기화, 카톡방 링크(--kakao 안 줬으면 KAKAO_ROOMS)
 6. 멤버 명단 code 순 입력 (결제 확정 후)
 7. 커밋 전 검증 3종 다시 → push → 라이브 curl 확인
""")
