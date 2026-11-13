import json, base64, html
S=json.load(open('summary.json'))
e=html.escape
img=lambda i: 'data:image/jpeg;base64,'+base64.b64encode(open(f'jpg/c{i:02d}.jpg','rb').read()).decode()
J=lambda L: '  '.join(L)
t=S['tot']; f=lambda n:f"{n:,}"
CS="http://pf.kakao.com/_ExdxcGX"
REPORT="https://youbuddy.co.kr/10th/#report"
WAIT="https://docurise.io/youbuddy/d/youbuddy-challenge-11-apply?src=kakao_10th"
OB="https://1day-1biz.youbuddy.co.kr/onboarding"
REVIEW="https://www.latpeed.com/products/en0l_/reviews/create"

tonight=f"""📌 문의 · 1일1비 안내는 전부 고객센터 채널로 나가요
{CS}

해피 day20입니다 :)
드디어... 마지막 날이에요!!

<오늘 할 일>
1. Day 20 인증 (오늘 자정 전까지 하면 정시)
2. 인증 마치면 열리는 파이널 테스트
   (10분이면 끝나요~ 점수로 거르지 않으니 가볍게!)

<받아가는 것>
· 18일 이상 + 파이널 = 4주 단어집 PDF + 1일1비 1개월 정기권
· 정시 18일 이상 + 파이널 = 위에 더해서 나만의 약점 복습 노트

<빠진 날이 있는 분들께>
빠진 날은 지금 채워도 1일로 인정돼요 (지각으로 표시).
다만 1일1비 1개월 정기권은 명단을 한 번에 모아서 등록해드려야 해서...
내일(토) 자정까지 채운 기록 + 파이널 응시 기준으로 취합할게요!
(단어집 PDF는 그 뒤에 채우셔도 앱에서 그대로 받으실 수 있어요 :))

<1일1비, 나는 어떻게 되나요?>
· 이미 쓰고 계신 분: 따로 하실 것 없어요. 지금 계정에 1개월 더해드려요
· 예전에 쓰다 쉬고 계신 분: 쓰시던 계정 그대로 1개월 다시 열어드려요
· 처음이신 분: 내일 수료식에서 가입 방법 알려드릴게요~

그럼 내일 수료식에서 만나요 :)"""

cards=[
("오프닝", f"""📌 문의는 언제든 고객센터 채널로!
{CS}

10기 여러분 :)
드디어 수료식이에요!!
오늘은 점수 발표가 아니라, 4주 동안 각자 빛났던 순간을 한 분씩 불러드리는 시간이에요 🧡
카드 한 장씩 올릴게요. 가볍게 즐겨주세요~"""),
("숫자로 본 10기", f"""먼저 우리가 4주 동안 쌓은 것부터 볼게요.

하루 인증 {f(t['verif'])}번,
직접 쓴 내 업무 문장 {f(t['sent'])}개,
AI 첨삭으로 다시 고친 게 {f(t['ai'])}번...!

한 문장씩 쌓은 게 이만큼이에요. 진짜 대단하지 않나요 :)"""),
("완주상", f"""첫 번째는 <완주상>!
18일 넘게, 끝까지 해낸 분들이에요.

{J(S['comp'])}

한 분 한 분 박수받아 마땅해요 👏👏👏
(파이널 테스트까지 보시면 수료 선물이 전부 열려요~)"""),
("정시 장인상", f"""두 번째는 <정시 장인상>.
18일을 전부 자정 전에 끝낸 분들이에요.

{J(S['ontime'])}

그리고 20일을 하루도 안 빠진 <올클리어>는...
바로.. {J(S['allclear'])} 님!!

하루도 안 밀린다는 거, 해본 사람은 알죠 :)"""),
("얼리버드상 / 막차 장인상", f"""이번엔 시간대별 장인들이에요 ㅎㅎ

<얼리버드상> 아침 10시 전에 인증을 끝낸 분들
{'  '.join(f'{n} ({c}번)' for n,c in S['eb'])}

<막차 장인상> 밤 10시 넘어 하루를 영어로 마무리한 분들
{'  '.join(f'{n} ({c}번)' for n,c,_ in S['ow'])}

언제 하든, 한 날이 이긴 날이에요 :)"""),
("예문 장인상 / AI 단짝상", f"""문장에 진심이었던 분들도 있어요.

<예문 장인상> 가장 많이 쓴 분들
{'  '.join(f'{n} ({f(c)}자)' for n,c in S['wr'])}

<AI 단짝상> AI 첨삭으로 가장 많이 다시 고친 분들
{'  '.join(f'{n} ({c}번)' for n,c in S['ai'])}

고쳐 쓴 문장이 제일 오래 남아요. 이분들 문장은 진짜 본인 거예요!"""),
("퀴즈 만점왕 / 수집왕 / 시차 불사상", f"""각자의 방식으로 빛난 분들이에요.

<퀴즈 만점왕> 데일리 퀴즈를 거의 전부 만점으로
{J([n for n,_,_ in S['quiz']])}

<수집왕> 표현이랑 유의어를 제일 많이 저장한 분들
{'  '.join(f'{n} ({c}개)' for n,c in S['coll'])}

<시차 불사상> 한국 밖에서 시차를 넘어 함께한 분들
{J(S['tz'])}

(시차 계산하면서 인증하는 거... 저는 못 할 것 같아요 ㅎㅎ)"""),
("보너스: 가장 헷갈린 표현", f"""보너스 하나 갑니다 ㅎㅎ
10기가 첫 시도에 가장 많이 틀린 표현 TOP 3!

1. {S['top3'][0][0]}
2. {S['top3'][1][0]}
3. {S['top3'][2][0]}

다들 여기서 한 번씩 멈칫하셨죠? :)
틀렸던 표현이 제일 오래 기억나요. 오늘 이 세 개만 다시 보고 가세요~"""),
("전원 호명", f"""그리고 한 분도 빠짐없이 불러드릴게요.
10기를 함께한 모든 이름이에요.

{J(S['roll'])}

속도는 각자 달랐어도, 같이 걸은 4주였어요.
끝까지 손 놓지 않아주셔서 고마워요 🧡"""),
("받아가실 선물", f"""마지막으로 선물 안내예요!

1. 단어집 PDF: 18일 이상 + 파이널 응시 (지각 포함)
2. 1일1비 1개월 정기권: 18일 이상 + 파이널 응시
3. 나만의 약점 복습 노트: 정시 18일 이상 + 파이널 응시

단어집이랑 약점 노트는 앱 수료 리포트에서 바로 받으실 수 있어요.
{REPORT}

1일1비는 바로 아래에 따로 안내드릴게요 👇"""),
]

after=[
("1일1비 1개월 정기권 받는 법", f"""<1일1비 1개월 정기권, 이렇게 받으세요>

오늘(토) 자정까지 채운 기록 + 파이널 응시 기준으로 명단을 모아서,
내일(일) 중으로 1일1비에 등록해둘게요. 등록 끝나면 여기 다시 알려드릴게요!

· 1일1비가 처음이신 분
  유비챌에 가입한 이메일 그대로 1일1비에 가입하시면, 1개월이 바로 열려요.
  {OB}
  11/22(일)까지 가입해주셔야 적용돼요!

· 이미 쓰고 계신 분
  따로 하실 것 없어요. 지금 쓰시는 계정에 1개월을 더해드려요.

· 예전에 쓰다 쉬고 계신 분
  쓰시던 계정 그대로 1개월 다시 열어드려요. 로그인만 하시면 돼요.

혹시 유비챌 이메일이랑 1일1비 이메일이 다르면,
고객센터 채널로 1일1비 이메일만 알려주세요 :)
{CS}"""),
("앱은 그대로 열려 있어요", f"""<앱이랑 자료는 그대로 열려 있어요>

· 60개 표현, 내가 쓴 문장, AI 첨삭 기록 전부 그대로 다시 볼 수 있어요
· 빠진 날은 나중에 채워도 1일로 인정돼요 (지각으로 표시)
· 단어집 PDF 맨 뒤 QR로 랜덤 테스트 / 약점 테스트도 해보세요

배운 표현은 2주 안에 실제 회의나 메일에서 한 번만 써보세요.
한 번 써본 표현은 진짜 내 거가 되더라고요 :)"""),
("다음 유비챌 (2027년 1월)", f"""<다음 유비챌은 2027년 1월이에요>

2026년 유비챌은 11기로 마감됐어요.
1월 오픈 알림은 대기 등록하신 분들께 먼저 가요.
한 번 더 하고 싶으신 분들은 여기 남겨주세요 :)
{WAIT}"""),
("후기 한 줄", f"""<후기 한 줄만 부탁드려도 될까요?>

4주 해보신 솔직한 얘기가 다음 기수를 고민하는 분들께 제일 큰 도움이 돼요.
(아쉬웠던 점도 좋아요. 솔직한 게 좋아요!!!)
{REVIEW}
부담 없이, 시간 되시는 분만요 :)"""),
("마무리", f"""4주 동안 매일 문 열어주셔서 고맙습니다.
회의에서 오늘 배운 표현이 툭 튀어나오는 날, 꼭 알려주세요 ㅎㅎ

수료 진심으로 축하드려요 🧡
회사 제출용 수강증이 필요하신 분은 고객센터 채널로 말씀해주세요~
{CS}"""),
]

faq=[
("아직 18일이 안 됐는데, 지금 채워도 되나요?","네! 빠진 날은 지금 채워도 1일로 인정돼요 (지각으로 표시). 1일1비 1개월 정기권은 토요일 자정까지 채운 기록으로 취합하고, 단어집 PDF는 그 뒤에 채우셔도 받으실 수 있어요.",0),
("파이널 테스트를 아직 못 봤어요.","Day 20 인증을 마치면 열려요. 10분이면 끝나고 점수로 거르지 않아요. 토요일 자정까지 보시면 1일1비 명단에 들어가요.",0),
("파이널 점수가 낮으면 선물을 못 받나요?","아니에요. 응시만 하시면 돼요.",0),
("제가 정시 18일인지 어떻게 알아요?","앱 수료 리포트에 '나만의 약점 복습 노트 열기' 버튼이 보이면 해당돼요. 지각으로 채운 날은 정시에는 들어가지 않아요.",0),
("1일1비를 이미 구독 중이에요.","따로 하실 것 없어요. 지금 쓰시는 계정에 1개월을 더해드려요. 다음 결제일이 한 달 뒤로 밀려요.",1),
("예전에 쓰다가 해지했어요.","쓰시던 계정 그대로 1개월 다시 열어드려요. 로그인하시면 예전 기록 그대로 이어서 하실 수 있어요.",1),
("유비챌 이메일이랑 1일1비 이메일이 달라요.","고객센터 채널로 1일1비에서 쓰시는 이메일만 알려주세요. 그 계정에 넣어드릴게요.",0),
("1개월이 끝나면 자동으로 결제되나요?","처음 가입하신 분은 카드 등록이 없어서 자동 결제되지 않아요. 이미 구독 중이신 분은 1개월 뒤부터 원래대로 결제돼요.",1),
("1일1비 가입은 언제까지 해야 하나요?","11/22(일)까지 유비챌 이메일로 가입해주세요.",1),
("1개월권을 나중에 쓰거나 다른 사람에게 줄 수 있나요?","본인 계정에만 적용되고, 기한 안에 가입하셔야 열려요.",1),
("11기도 신청했는데, 1일1비 1개월권도 같이 샀어요.","10기 완주 1개월 + 구매하신 1개월, 합쳐서 2개월로 넣어드려요.",0),
("단어집 PDF는 어디서 받아요?",f"앱 수료 리포트 화면에서 받으실 수 있어요. {REPORT}",0),
("앱은 언제까지 볼 수 있어요?","계속 열려 있어요. 표현, 내 문장, 첨삭 기록 모두 그대로예요.",0),
("회사에 낼 수강증(참가확인서)이 필요해요.","고객센터 채널로 이름과 제출처만 알려주시면 발급해드려요.",0),
("다음 기수는 언제예요? 재등록 할인이 있나요?","2027년 1월이에요. 대기 등록해두시면 오픈 알림을 먼저 받으세요. 할인은 아직 정해진 게 없어서 지금은 약속드리지 않아요.",1),
("11기에 지금이라도 들어갈 수 있나요?","11기는 마감됐어요. 사정이 있으시면 고객센터 채널로 따로 말씀해주세요.",1),
("이 단톡방은 어떻게 되나요?","방은 그대로 두고 공지만 가끔 올릴게요. 나가셔도 앱은 그대로 쓰실 수 있어요.",1),
]

confirm=[
("수료식 시작 시간","대본은 시간에 상관없이 쓸 수 있게 써뒀어요. 1일1비 블록의 '오늘(토) 자정', '내일(일)'은 토요일 기준이에요."),
("1일1비 가입 기한","'일주일 내'를 11/22(일)로 적었어요. 등록 완료 안내를 일요일에 한다고 봤을 때 기준이에요."),
("1개월 끝난 뒤 자동 결제","처음 가입자는 자동 결제 없음, 구독 중인 분은 결제일이 한 달 밀림으로 적었어요. 1일1비 실제 동작이 맞는지 봐주세요."),
("10기 단톡방","유지한다고 적었어요. 닫을 예정이면 FAQ 마지막 답을 바꿔야 해요."),
("지흔(Lehn), 재환님 호명","지금 카드에는 두 분이 없어요. 지흔은 스태프라 뺐고, 재환님은 앱 기록이 없어요."),
("재등록 할인","11기가 마감돼서 쿠폰 블록은 뺐어요. 1월 재등록 혜택을 약속하고 싶으면 알려주세요."),
]
miss=[
"수료식 직전에 카드를 최종 데이터로 다시 뽑기. 지금은 금요일 오후 4시 기준이에요. 유니, 루크 님이 오늘 인증하면 완주상에 추가돼요.",
"고객센터 채널을 첫 메시지 맨 위에 두기 (대본에 넣어뒀어요).",
"전원 호명. 9번 카드에 21명 닉네임이 다 들어 있는지 한 번 세어보기.",
"'마감 없어요'라고 말하지 않기. 대신 '나중에 채워도 1일로 인정 (지각으로 표시)'.",
"1일1비 기한을 말할 때 '단어집은 그 뒤에 채워도 받을 수 있다'를 꼭 같이 말하기. 안 그러면 기준을 중간에 조인 것처럼 들려요.",
"없는 혜택 말하지 않기. 재등록 쿠폰, 얼리버드 같은 건 대본에 없어요.",
"일요일: 최종 명단 뽑아서 지흔에게 전달 → 1일1비 등록 → 단톡에 '등록 끝났어요' 한 줄.",
"월요일 전: 예외용 결제폼 닫기, 앱 수료 팝업의 '다음 기수' 버튼이 아직 옛 판매 페이지로 가는 것 바꾸기.",
"시크릿 라운지 초대는 이번 대본에 넣지 않았어요. 넣고 싶으면 링크와 함께 알려주세요.",
]

def block(label, text, i=None, tag=''):
    im=f"<img class='card' src='{img(i)}' alt='카드 {i}'>" if i else ''
    num=f"<span class='n'>{tag}</span>" if tag else ''
    return f"<article class='step{' has' if i else ''}'>{im}<div class='say'><header>{num}<h3>{e(label)}</h3><button class='cp' type='button'>복사</button></header><pre>{e(text)}</pre></div></article>"

H=f"""<title>10기 수료식 진행표</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* layout: one reading column; each step = card image left, kakao script right, stacks on phone */
:root{{--bg:#F7F2EE;--paper:#FFFFFF;--ink:#2B1A21;--mute:#6B5F58;--line:#D8C9CC;--wine:#7B3B4E;--tint:#F1E1E6;--warn:#8A5A00;--warnbg:#FFF3D6;
--f:'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#1D1317;--paper:#2B1A21;--ink:#F7EFF1;--mute:#C3B2B7;--line:#4A2F39;--wine:#E0A6B8;--tint:#3A232C;--warn:#F2CF7A;--warnbg:#3A2E12;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#1D1317;--paper:#2B1A21;--ink:#F7EFF1;--mute:#C3B2B7;--line:#4A2F39;--wine:#E0A6B8;--tint:#3A232C;--warn:#F2CF7A;--warnbg:#3A2E12;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--ink);font-family:var(--f);font-size:16px;line-height:1.6;padding-block:28px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
main{{max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:44px}}
h1{{font-size:34px;font-weight:900;letter-spacing:-1px;margin:0;line-height:1.2}}
.lead{{color:var(--mute);margin:8px 0 0;max-width:60ch}}
nav{{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}
nav a{{border:2px solid var(--ink);padding:6px 12px;font-weight:800;font-size:14px;color:var(--ink);text-decoration:none}}
nav a:hover,nav a:focus-visible{{background:var(--ink);color:var(--bg)}}
section{{display:flex;flex-direction:column;gap:14px}}
h2{{font-size:24px;font-weight:900;letter-spacing:-.5px;margin:0;padding-bottom:10px;border-bottom:3px solid var(--ink)}}
h2 small{{font-size:14px;font-weight:700;color:var(--mute);margin-left:8px;letter-spacing:0}}
.note{{color:var(--mute);margin:0;max-width:70ch}}
.step{{background:var(--paper);border:1px solid var(--line);display:grid;grid-template-columns:1fr;}}
.step.has{{grid-template-columns:minmax(0,300px) minmax(0,1fr)}}
.card{{display:block;width:100%;height:auto;aspect-ratio:1/1}}
.say{{min-width:0;padding:16px 18px;display:flex;flex-direction:column;gap:10px}}
.say header{{display:flex;align-items:center;gap:10px}}
.say h3{{font-size:17px;font-weight:900;margin:0;flex:1;min-width:0}}
.n{{font-weight:900;font-size:13px;color:var(--wine);border:2px solid var(--wine);padding:1px 7px;white-space:nowrap}}
.cp{{font:inherit;font-size:13px;font-weight:800;border:2px solid var(--ink);background:transparent;color:var(--ink);padding:4px 12px;cursor:pointer}}
.cp:hover,.cp:focus-visible{{background:var(--ink);color:var(--paper)}}
.cp.ok{{background:var(--wine);border-color:var(--wine);color:var(--paper)}}
pre{{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--f);font-size:15px;line-height:1.65;background:var(--tint);padding:14px 16px}}
ul.chk,ol.q{{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}}
ul.chk li{{background:var(--paper);border:1px solid var(--line);padding:12px 16px}}
ul.chk b{{display:block}}
.q li{{background:var(--paper);border:1px solid var(--line);padding:14px 16px}}
.q .qq{{font-weight:900}}.q .aa{{margin-top:4px}}
.flag{{display:inline-block;font-size:12px;font-weight:800;color:var(--warn);background:var(--warnbg);padding:1px 7px;margin-left:6px;white-space:nowrap}}
@media (max-width:640px){{.step.has{{grid-template-columns:1fr}}h1{{font-size:27px}}}}
</style>
<main>
<div>
<h1>유비챌 10기 수료식 진행표</h1>
<p class="lead">위에서부터 순서대로 보내면 돼요. 카드 한 장 올리고, 옆의 글을 복사해서 붙여넣는 흐름이에요. 카드 숫자와 이름은 금요일 오후 4시 기준 초안이라, 수료식 직전에 최종 데이터로 다시 뽑아드려요.</p>
<nav><a href="#confirm">먼저 확인</a><a href="#tonight">오늘 저녁</a><a href="#ceremony">수료식 카드 10장</a><a href="#after">카드 뒤 공지</a><a href="#faq">질문 대비</a><a href="#miss">빠뜨리기 쉬운 것</a></nav>
</div>

<section id="confirm"><h2>먼저 확인해주세요<small>제가 가정하고 쓴 것</small></h2>
<ul class="chk">{''.join(f"<li><b>{e(a)}</b>{e(b)}</li>" for a,b in confirm)}</ul></section>

<section id="tonight"><h2>오늘 저녁 9시 단톡<small>금요일</small></h2>
{block('파이널 리마인드 + 1일1비 기준 안내', tonight)}</section>

<section id="ceremony"><h2>수료식<small>카드 10장 + 멘트</small></h2>
{''.join(block(l,tx,i+1,f'카드 {i+1}') for i,(l,tx) in enumerate(cards))}</section>

<section id="after"><h2>카드 뒤에 이어서 보낼 공지</h2>
{''.join(block(l,tx,None,f'공지 {i+1}') for i,(l,tx) in enumerate(after))}</section>

<section id="faq"><h2>질문 대비<small>나올 만한 것과 답</small></h2>
<p class="note">'확인' 표시는 위에서 가정한 내용이 들어간 답이에요. 버디가 정하면 그 답만 바꾸면 돼요.</p>
<ol class="q">{''.join(f"<li><div class='qq'>Q. {e(q)}{'<span class=flag>확인</span>' if c else ''}</div><div class='aa'>{e(a)}</div></li>" for q,a,c in faq)}</ol></section>

<section id="miss"><h2>빠뜨리기 쉬운 것</h2>
<ul class="chk">{''.join(f"<li>{e(m)}</li>" for m in miss)}</ul></section>
</main>
<script>
document.querySelectorAll('.cp').forEach(function(b){{b.addEventListener('click',function(){{
  var pre=b.closest('.say').querySelector('pre');var done=function(){{b.textContent='복사됨';b.classList.add('ok');setTimeout(function(){{b.textContent='복사';b.classList.remove('ok')}},1400)}};
  var sel=function(){{var r=document.createRange();r.selectNodeContents(pre);var s=getSelection();s.removeAllRanges();s.addRange(r)}};
  try{{navigator.clipboard.writeText(pre.textContent).then(done,sel)}}catch(e){{sel()}}
}})}});
</script>"""
for bad in ['—','–','가비']:
    assert bad not in H.replace("'마감 없어요'라고 말하지 않기",''), bad
open('10기_수료식_진행표.html','w').write(H)
md=["# 10기 수료식 진행표 (2026-11-13 초안)\n","## 오늘 저녁\n```\n"+tonight+"\n```\n","## 수료식 카드 멘트\n"]+[f"### 카드 {i+1} {l}\n```\n{tx}\n```\n" for i,(l,tx) in enumerate(cards)]+["## 카드 뒤 공지\n"]+[f"### {l}\n```\n{tx}\n```\n" for l,tx in after]+["## FAQ\n"]+[f"- Q. {q}{' (확인 필요)' if c else ''}\n  A. {a}\n" for q,a,c in faq]
open('10기_수료식_대본_비공개.md','w').write('\n'.join(md))
print(len(H))
