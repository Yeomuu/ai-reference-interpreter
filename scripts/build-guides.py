"""Build the participant guide and the separate facilitator/video brief.

Uses verified user-provided Paperlogy locally; does not copy font files to outputs.
Run with the bundled Python runtime (reportlab). Content is intentionally separated
so operator task answers/recording notes do not enter the public participant guide.
"""
from pathlib import Path
import json
import re
import shutil
from html import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
PUBLIC = ROOT / 'public/guide'
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
tokens = (ROOT / 'src/styles/tokens.css').read_text(encoding='utf-8')
def token(name):
    return re.search(r'--' + re.escape(name) + r'\s*:\s*(#[0-9a-fA-F]{6})', tokens).group(1)
INK, MUTED, LINE, ACCENT, TINT = [token(n) for n in ['neutral-900', 'neutral-600', 'neutral-200', 'violet-700', 'violet-50']]

def p(text): return {'type': 'p', 'text': text}
def h(text): return {'type': 'h', 'text': text}
def note(text): return {'type': 'note', 'text': text}
def table(head, rows): return {'type': 'table', 'head': head, 'rows': rows}
def steps(items): return {'type': 'steps', 'items': items}

participant = [
 {'id': 'start', 'title': '공간의 조건을 정리하고, 시안을 비교하세요', 'tag': '사용 · 실험 참여 가이드', 'blocks': [
   p('공간 레퍼런스 해석기는 기존 공간에서 유지할 구조와 참고 이미지의 적용 요소를 정하고, 도면 위 위치와 출력 시점을 연결하는 서비스입니다. 필요한 조건만 수정하며 시안을 비교할 수 있습니다.'),
   note('핵심 흐름: 공간 준비 → 유지할 요소 → 참고 이미지 → 배치 → 시점 → 생성 전 확인 → 시안'),
   h('처음이라면'),
   steps(['PC에서 서비스를 열고 샘플 프로젝트로 조작을 익힙니다. 세밀한 도면 작업은 마우스와 키보드 사용을 권장합니다.', '상단의 사용 가이드에서 이 안내를 다시 열 수 있습니다. 프로젝트는 현재 브라우저에 자동 저장됩니다.', '진행자가 실험을 안내한 경우에만 하단의 실험 기록을 시작합니다. 연습은 기록을 시작하지 않고 진행합니다.']),
   h('자료마다 역할이 다릅니다'),
   table(['자료', '무엇을 정하는 데 쓰나요?'], [
    ['기존 공간 사진', '현재 공간의 외관과 재질을 참고합니다. 사진에서 실제 치수를 자동 측정하지 않습니다.'],
    ['평면도', '구조·영역·배치·시점의 기준입니다. 업로드 후 필요한 위치를 직접 표시합니다.'],
    ['분위기·요소 참고 이미지', '조명, 색감, 그래픽 등 적용할 내용을 선택합니다. 참고 사진의 방 구조를 복제하는 자료가 아닙니다.'],
    ['제품 이미지', '진열할 상품이나 사용할 물체를 지정합니다. 상품은 놓을 진열대와 연결할 수 있습니다.']]),
   p('도면이 없으면 가로·세로 개략 도면이나 직접 그린 윤곽을 사용할 수 있습니다. 개략 도면은 치수가 확인된 설계 도면이 아닙니다.') ]},
 {'id': 'prepare', 'title': '01–03 · 공간과 적용 조건 준비', 'tag': '서비스 사용법', 'blocks': [
   h('01 공간 준비'),
   p('기존 공간 사진을 추가하고 평면도를 등록합니다. 새 도면을 올릴 때 이전 표시를 지울지 유지할지 확인합니다. 업로드 이미지만으로 벽이나 치수가 자동 생성되지는 않습니다.'),
   table(['하려는 일', '조작'], [
    ['벽·가벽 표시', '구조 그리기에서 종류를 고르고 시작점부터 끝점까지 끕니다. 필요하면 수평·수직 교정과 수치 입력을 사용합니다.'],
    ['기둥·기존 조명 표시', '도형과 크기를 정하고 도면에서 위치를 클릭합니다.'],
    ['창·문·출입구 표시', '이름과 강조선으로 연결할 벽을 확인한 뒤 그 벽을 따라 끕니다.'],
    ['영역·동선 표시', '용도를 고르고 대각선으로 끌어 범위를 만듭니다. 윤곽 도구는 점을 찍고 Enter 또는 윤곽 저장으로 끝냅니다.']]),
   p('저장해도 현재 그리기 도구가 유지됩니다. 모두 그린 뒤 직접 그리기 마치기를 누르세요. 빈 도면을 끄는 동작은 화면 이동 기능이 아닙니다.'),
   h('02 유지할 요소'),
   p('기존 벽·창·기둥 등 유지할 구조를 확인합니다. 이름 옆 자물쇠나 필수 보존 스위치로 위치 고정을 켜고 끕니다. 고정을 끄면 검증을 거쳐 도면 표시를 수정할 수 있습니다.'),
   note('잠긴 벽에도 탈착식 포스터나 조명을 연결할 수 있습니다. 잠금은 벽 자체를 유지한다는 뜻입니다. 도면에서 잠금을 푸는 것이 실제 철거나 이전 가능성을 뜻하지는 않습니다.'),
   h('03 참고 이미지'),
   p('분위기·요소·제품에 맞는 이미지를 추가하고 전체 이미지 또는 필요한 부분을 선택합니다. 적용할 요소의 이름·유형·적용 및 제외 조건을 저장합니다. 저장된 글은 조건 편집을 눌러 수정합니다.'),
   p('조명 분위기는 전체 공간 또는 특정 영역에 연결합니다. 실제 등기구는 천장·벽·바닥 중 해당 유형의 위치에 둡니다. 선택한 이미지에서 만든 요소만 오른쪽 목록에 표시됩니다. 불필요한 이미지는 삭제 후 되돌릴 수 있습니다.') ]},
 {'id': 'place', 'title': '04–07 · 위치를 정하고 시안 검토', 'tag': '서비스 사용법', 'blocks': [
   h('04 배치'),
   table(['요소', '연결할 위치'], [
    ['진열대·가구·스탠드 조명', '바닥 위치 또는 허용된 바닥 영역'],
    ['포스터·벽 그래픽·벽 조명', '벽 구간. 연결된 모서리를 따라 끌면 다른 벽으로 이동할 수 있습니다.'],
    ['천장 조명·매달린 요소', '등록한 천장 영역'],
    ['조명 분위기·공간 색감', '전체 공간 또는 이름이 있는 영역'],
    ['진열 상품', '선택한 진열대 위. 사용할 진열대가 없으면 기본 진열대를 직접 추가합니다.']]),
   p('배치할 요소를 선택한 뒤 허용 위치를 클릭합니다. 바닥 물체는 몸체를 끌어 이동하고 회전 손잡이로 돌립니다. 빗금은 비워 둘 동선·문 여닫이 공간입니다. 잘못된 위치는 이유와 함께 거절되며 이전 위치가 유지됩니다.'),
   h('05 시점'),
   p('카메라 몸체는 위치, 회전 손잡이는 바라보는 방향을 바꿉니다. 빈 바닥을 클릭해도 카메라가 갑자기 이동하지 않습니다. 추가 시점을 만들거나 선택한 시점을 삭제할 수 있습니다. 생성하려면 유효한 시점이 하나 이상 필요합니다.'),
   h('06 생성 전 확인'),
   p('유지할 구조, 적용·제외 요소와 연결 위치, 시점을 확인합니다. 오류 항목을 누르면 해당 편집 단계로 이동합니다. AI 이미지 생성은 선택한 시점마다 한 장씩 만듭니다. 생성 가능 여부 확인은 남은 횟수와 접수 가능 상태만 갱신합니다.'),
   p('오늘 내 남은 생성은 같은 익명 브라우저 기준 하루 20회, 서비스 전체는 하루 60회입니다. 한국 시간 자정에 갱신됩니다. 요청이 접수되면 실패해도 차감될 수 있으며 여러 시점은 장수만큼 차감됩니다. 처리 중에는 중복 요청이 막힙니다.'),
   h('07 시안'),
   p('저장된 배치 도면과 비교를 펼쳐 구조·위치·시점·색감을 직접 대조합니다. 필요한 조건을 수정하면 이전 시안에는 이전 조건 표시가 붙습니다. 검토 후 승인한 이미지를 내보낼 수 있습니다.'),
   note('사전 제공 샘플은 현재 조건으로 생성한 이미지가 아닙니다. 실제 AI 시안도 도면과 정확히 일치하는지 직접 확인해야 합니다. 여러 시점 중 일부가 실패하면 먼저 완성된 이미지는 유지됩니다.') ]},
 {'id': 'experiment', 'title': '실험 참여 · A와 B는 무엇인가요?', 'tag': '참여자 안내', 'blocks': [
   p('과업 A·B는 서로 다른 공간 연출 자료 묶음을 구분하는 이름입니다. 원 기획의 예시는 A: 빈 상가의 화장품 팝업스토어, B: 기존 쇼룸의 라이프스타일 전시 공간입니다. 실제 내용은 진행자가 제공한 과업지를 따릅니다.'),
   note('과업 A·B와 사용 방식은 별개입니다. 현재 앱의 A/B 선택은 기록에 과업 이름을 붙입니다. 선택만으로 사진·도면·기능이 바뀌지 않습니다. 현재 앱은 두 과업 모두 제안 인터페이스 방식으로 기록합니다.'),
   h('참여 순서'),
   steps(['진행자에게 익명 번호, 과업 A/B, 사용할 자료·프로젝트, 종료 기준을 받습니다. 이름과 학번은 입력하지 않습니다.', '다른 연습 예시로 조작을 익힙니다. 본 과업 자료의 정답을 미리 따라 만들지 않습니다.', '진행자가 지정한 프로젝트를 열고 하단 실험 기록을 펼칩니다. 익명 번호(예: P01), 과업, 기록 수집 동의를 확인합니다.', '이 프로젝트 기록 시작을 누른 뒤 과업을 수행합니다. 같은 브라우저의 한 탭을 사용하고 사이트 데이터를 삭제하지 않습니다.', '과업지의 종료 기준에 도달하면 기록을 시작한 프로젝트에서 과업 종료를 누릅니다. 종료 시점의 조건이 고정됩니다.', '과업 직후 설문 6개에 응답하고, 실험 기록 ZIP 받기를 누릅니다. 파일의 참여 번호·과업을 확인해 진행자에게 전달합니다.']),
   h('종료 기준은 시작 전에 확인하세요'),
   p('조건 지정 과업은 생성 전 확인에서 최종 조건 검토를 마쳤을 때 끝낼 수 있습니다. 이미지 평가를 포함하는 과업은 진행자가 지정한 생성·비교 절차까지 수행합니다. 모든 참여자에게 같은 기준을 적용해야 합니다.'),
   p('설문을 바꿨다면 ZIP을 다시 다운로드하세요. 과업을 종료한 뒤 프로젝트를 수정해도 이미 종료한 과업의 최종 조건은 바뀌지 않습니다. 다음 과업은 별도 기록으로 시작합니다.') ]},
 {'id': 'recover', 'title': '복구·제출·자주 묻는 질문', 'tag': '빠른 참고', 'blocks': [
   table(['상황', '할 일'], [
    ['실수로 이동하거나 삭제함', '캔버스에서 Ctrl+Z, 다시 실행은 Ctrl+Shift+Z. 텍스트 입력 중에는 글 편집 단축키가 동작합니다. 삭제 안내의 삭제 되돌리기도 사용할 수 있습니다.'],
    ['겹친 영역이 많아 보기 어려움', '영역·동선 표시 설정에서 필요한 종류와 선택 영역을 확인합니다. 동선과 문 여유 공간은 항상 표시됩니다.'],
    ['잠금을 껐는데 벽이 움직이지 않음', '연결된 창·문이 잠겨 있는지, 다른 구조나 동선을 침범하는지 이유를 확인합니다.'],
    ['생성이 일부만 완료됨', '시안에서 완성된 이미지를 먼저 확인합니다. 실패 원인과 남은 횟수를 확인한 뒤 필요한 시점만 선택합니다.'],
    ['응답이 불확실하다는 안내', '자동 재전송하지 않습니다. 안내된 대기와 확인 절차를 따르거나 진행자에게 알립니다.'],
    ['브라우저 저장 오류', '탭을 닫기 전에 실험 기록 ZIP과 필요한 이미지부터 받습니다. 진행자에게 알리고 임의로 데이터를 지우지 않습니다.']]),
   h('제출 파일에는 무엇이 들어가나요?'),
   p('실험 ZIP에는 익명 번호·과업·시각, 단계 이동·수정·오류 등 행동 기록, 시작·최종 조건, 설문, 계산 지표와 평가 양식이 들어갑니다. 원본 사진·도면·결과 이미지 파일은 들어가지 않습니다. 최종 조건에는 작성한 문장이 포함될 수 있으므로 개인 정보를 쓰지 마세요.'),
   p('파일은 진행자에게 직접 전달해야 합니다. 서버 자동 제출이나 다른 기기 간 동기화는 제공하지 않습니다. 완료 전 ZIP은 중간 백업입니다. 실제 시안 이미지를 별도로 요청받았다면 진행자의 제출 방법을 따릅니다.'),
   h('포커스와 저장'),
   p('마우스로 버튼을 클릭할 때 기본 검은 테두리는 표시하지 않습니다. 텍스트 입력에는 입력 중 표시가 남고, Tab 키로 조작할 때는 현재 조작 위치가 보입니다. 단계는 브라우저 뒤로 가기·앞으로 가기로 이동할 수 있습니다.'),
   p('이 안내는 2026-09-29 구현과 제공된 14페이지 기획서의 절차를 기준으로 작성했습니다. 세부 과업 내용과 수집 동의·제출 방법은 진행자의 안내를 우선합니다.') ]},
]

operator = [
 {'id': 'protocol', 'title': '실험 진행 전, 과업과 방식을 구분하세요', 'tag': '진행자 전용 · 배포 가이드와 별도', 'blocks': [
   p('근거: 제공 기획서 14페이지 중 3–4쪽의 비교 조건·과업·교차 설계, 6–10쪽의 로그 정의, 11–14쪽의 코딩·분석 계획. Google 문서에 직접 접근했다고 주장하지 않으며 제공 PDF와 현재 구현을 기준으로 한다.'),
   table(['축', '구분', '현재 서비스 상태'], [
    ['과업 자료', 'A: 화장품 팝업 / B: 라이프스타일 전시 (기획 예시)', 'A/B는 기록 태그. 자료는 진행자가 별도로 준비한다.'],
    ['비교 방식', '자유 텍스트 / 제안 인터페이스', '현재는 제안 인터페이스(structured)만 구현되어 있다.'],
    ['평가 대상', '최종 조건 / 실제 생성 이미지', '조건 정확도는 사람의 코딩. 생성 이미지 평가는 실제 생성한 경우 별도 시행.']]),
   h('현재 가능한 실험'),
   p('구조화 인터페이스의 사용성 파일럿과 조건 작성 과정의 로그 수집·ZIP 제출이 가능하다. A/B를 번갈아 선택해도 자유 텍스트 비교 실험이 되지는 않는다. 완전한 비교 실험에는 동일 사이트의 자유 텍스트 화면과 동일한 자료·생성 설정·평가 절차가 별도로 필요하다.'),
   h('실험 자료 준비'),
   steps(['A/B 각각 기존 공간 사진, 단순 도면, 참고 이미지 3장, 과업지, 정답 기준표를 준비한다. 이미지 수·필수 조건 수·조작 부담을 맞춘다.', '샘플 AURA POP-UP은 정답에 해당하는 요소와 배치가 이미 저장돼 있으므로 본 과업의 미완성 시작 상태로 그대로 쓰지 않는다. 연습에는 다른 예시를 사용한다.', '시작 프로젝트에는 제공 자료와 공통 기본 구조만 준비한다. 측정하려는 Keep 선택·요소 추출·위치·시점은 참여자가 지정하게 하고, 사전 입력한 값은 양식에 명시한다.', '각 참여자 시작 전 이전 참여자의 프로젝트나 완료 상태를 덮어쓰지 말고 지정한 시작 자료인지 확인한다. 실제 지급 자료의 파일명 대신 비식별 자료 ID를 사용한다.']),
   note('이 문서의 과업 카드와 위치 범위는 운영 초안이다. 난이도 동등성이나 평가 타당성이 검증됐다는 뜻이 아니다. 파일럿 후 본 실험 전에 확정한다.') ]},
 {'id': 'task-cards', 'title': '동등한 판단 수의 과업 카드 초안', 'tag': '진행자 전용 · 정답 기준 준비', 'blocks': [
   p('기획서 기준 각 과업은 필수 유지 4개, 적용 요소 3개, 요소–위치 연결 3개, 제외 조건 1개, 대표 시점 1개를 포함한다. 요소 존재와 위치 연결을 별도 기준으로 코딩하면 12개 판단이다. 같은 항목을 중복 집계하지 않도록 코드북에 평가 단위를 고정한다.'),
   table(['판단', '과업 A · 화장품 팝업 예시', '과업 B · 라이프스타일 전시 제안'], [
    ['유지 4개', '후면 벽·창·기둥·입구 유지', '지정 벽·창·기둥·입구 유지'],
    ['요소 3개', '곡선형 독립 진열대 / 간접 조명 / 탈착식 벽 그래픽', '직선형 독립 전시대 / 부드러운 조명 / 탈착식 브랜드 그래픽'],
    ['위치 연결 3개', '지정 중앙 바닥 / 전체 공간 / 지정 후면 벽 구간', '지정 중앙 바닥 / 전체 공간 / 지정 벽 구간'],
    ['제외 1개', '참고 A의 벽 마감은 적용하지 않음', '참고 A의 바닥 마감은 적용하지 않음'],
    ['시점 1개', '입구에서 중앙을 바라봄', '입구에서 지정 전시대를 바라봄']]),
   p('A는 원 기획의 예시를 바탕으로 하고 B의 세부 요소는 이 가이드에서 제안한 초안이다. 실제 B 이미지와 도면은 아직 제공 세트가 아니므로 실험 전에 준비한다. 서로 다른 판단 난이도를 만들 수 있는 제품-진열대 연결이나 추가 시점은 핵심 비교 과업에 임의로 한쪽만 추가하지 않는다.'),
   h('정답 기준표를 먼저 확정'),
   p('과업·조건 ID, 유형, 출처 자료 ID, 요소 ID/설명, 위치 대상과 허용 범위, 제외 조건, 시점 위치·방향의 허용 범위, 평가자, 0/1 점수, 오류 유형을 작성한다. 실제 도면을 보고 허용 범위를 정하며 임의의 좌표를 정답으로 확정하지 않는다.'),
   p('오류 유형: 누락, 잘못된 참고 이미지, 잘못된 요소, 잘못된 위치·범위, 잘못된 시점, 모호한 표현. 로그의 배치 성공은 최종 조건 정확도나 실제 생성 이미지 보존 성공을 뜻하지 않는다.'),
   note('참여자용 과업지는 요구 조건만 제시하고 정답 위치 ID·평가자 메모를 포함하지 않는다. 이 진행자 문서와 코드북은 참여자 가이드와 분리해 보관한다.') ]},
 {'id': 'run', 'title': '한 명의 진행 순서와 기록 수거', 'tag': '실험 운영', 'blocks': [
   table(['순서', '진행 기준'], [
    ['동의·사전 설문', '원 기획 예시 5분. AI/공간 과제/도면 이해 경험을 별도 양식에 기록한다.'],
    ['연습', '다른 예시로 3–5분. 모든 참여자에게 같은 조작 안내를 제공하고 본 과업의 해답은 보여주지 않는다.'],
    ['과업 시작', '프로젝트·익명 번호·과업을 확인하고 참여자가 기록 시작을 누른 시점부터 측정한다.'],
    ['과업 수행', '힌트가 필요하면 동일한 중립 안내를 사용한다. 도움·중단·네트워크 문제는 별도 메모한다.'],
    ['과업 종료·설문', '미리 정한 종료 기준에서 종료. 6개 설문 완료 후 ZIP을 다운로드한다.'],
    ['휴식·다음 과업', '다음 자료와 시작 상태를 준비한다. 별도 세션으로 기록하며 이전 ZIP을 덮어쓰지 않는다.'],
    ['인터뷰', '원 기획 예시 10–15분. 위치 연결·수정·통제감·부담과 실제 작업 적용 의향을 묻는다.']]),
   h('교차 배정'),
   p('원 기획 예시: 그룹 1은 자유 텍스트(A) → 제안 인터페이스(B), 그룹 2는 제안 인터페이스(A) → 자유 텍스트(B). 가능하면 균등 배정한다. 이 배정은 사용 방식의 순서를 바꾸지만 A는 항상 먼저이므로 과업 순서 효과까지 완전히 제거하지 않는다. 분석 전에 이 한계를 명시하거나 연구자가 추가 균형 배정을 검토한다.'),
   p('현재 구조화 방식만 실행한 파일럿은 해당 방식의 관찰 자료로 기록한다. 미구현 자유 텍스트 시행을 한 것처럼 조건 값을 바꾸거나 대체 사이트의 차이를 숨기지 않는다.'),
   h('ZIP 수거 확인'),
   steps(['참여 번호·과업·세션 ID·완료 시각과 설문 응답을 확인한다. 중간 백업과 최종 제출을 구분한다.', 'ZIP을 실제로 풀어 12개 파일, 한글·이벤트·최종 조건을 확인한다. 정답과 인터뷰 템플릿이 비어 있는 것은 실제 평가 미실시를 뜻한다.', '이미지 평가가 있다면 생성 결과 ID와 별도 이미지 파일을 대응시킨다. 원본 사진이나 결과 이미지가 로그 ZIP에 포함된 것으로 가정하지 않는다.']) ]},
 {'id': 'analysis', 'title': '분석 가능한 범위와 실행 전 확인', 'tag': '진행자 점검표', 'blocks': [
   table(['자료', '용도와 해석'], [
    ['events.jsonl / events.csv', '의미 있는 이동·수정·거절·복구 이벤트. 키 입력·매 프레임 좌표 수집 아님.'],
    ['initial_conditions.json / final_outputs.json', '시작 상태와 종료 시점 조건. 실제 생성 이미지의 정확도 점수 아님.'],
    ['metrics.json', '전체 시간·중단·수정·되돌아가기·검토 수정 루프·오류 분포. 정확도 항목은 사람의 코딩 필요.'],
    ['surveys.csv', '과업 직후 6문항 1–5점. 미응답은 비어 있음.'],
    ['sessions, manifest, README, 평가·인터뷰 양식', '참여자·과업·완료 여부 및 해석 범위 확인. 서버 수집 시각은 null.']]),
   h('파일럿에서 확인할 항목'),
   steps(['원 기획 권장 2–3명으로 안내 이해, 시작 상태, 종료 기준, 과업 난이도, 오류와 ZIP 제출을 점검한다.', '브라우저 한 탭을 유지한다. 저장 실패 시 닫기 전에 중간 ZIP을 받고 재개·제외 여부를 진행자가 기록한다.', '정답 코딩은 가능하면 평가자 두 명이 사용 방식을 모른 채 독립 실시하고 불일치를 합의한다.', '생성 이미지 평가는 같은 모델·입력·출력 설정을 사용하고 조건 보존·요소·위치·제외·시점을 별도 코딩한다. 이미지 생성 시간을 조건 작성 시간과 혼합하지 않도록 종료 기준을 고정한다.']),
   h('현재 남아 있는 검증 경계'),
   p('실제 이미지 두 장은 이전 QA에서 수신에 성공했으나 창 위치·기둥 단면·전체 온색 불일치가 남았다. 이후 생성 지시를 보완했지만 실제 모델 재검증은 완료되지 않았다. 기능 QA 성공을 공간 재현 품질의 성공으로 발표하지 않는다.'),
   p('현재 버전은 자유 텍스트 비교 화면, A/B 완성 자료 세트, 자동 교차 배정, 서버 실험 로그 수집, 자동 정답 코딩을 제공하지 않는다. 본 비교 실험은 이 준비가 완료된 뒤 실행한다. 사용성 파일럿은 현재 범위에서 진행할 수 있다.'),
   note('생성 한도: 서비스 전체 하루 60회, 익명 브라우저 하루 20회, 한국 시간 자정 갱신. 요청이 접수된 실패도 차감될 수 있다. 여러 참여자가 같은 브라우저를 쓰면 생성 한도도 공유한다. 실험 번호는 생성 한도 식별자가 아니다.') ]},
 {'id': 'video', 'title': '소개영상 · 2분 10초 화면 녹화 구성', 'tag': '기능을 검증한 최종 버전 기준', 'blocks': [
   p('목적: 여러 참고 이미지에서 가져올 요소와 적용 위치를 명시하고, 시안을 확인한 뒤 필요한 조건만 수정하는 과정을 보여준다. 기능 나열보다 한 공간의 작업 흐름을 따른다. 아래 구성은 녹화 계획이며 실제 영상을 제작·검증했다는 뜻은 아니다.'),
   table(['시간', '화면·조작', '전달할 내용'], [
    ['00–10초', '기존 공간 → 참고 이미지 3장', '좋아하는 이미지에서 무엇을 어디에 가져올지 정리하는 문제'],
    ['10–25초', '공간 준비: 사진과 도면을 함께 보여줌', '사진은 현재 모습, 도면은 위치 기준'],
    ['25–40초', '유지할 요소: 벽·창·기둥 이름과 자물쇠', '기존 구조를 유지하면서 새 요소를 더함'],
    ['40–60초', '참고 이미지: 진열대 선택 → 요소/조건 저장', '이미지 → 적용 요소 연결'],
    ['60–80초', '배치: 진열대 이동, 그래픽의 벽 연결, 조명 범위', '유형에 맞는 위치와 범위 지정'],
    ['80–92초', '시점: 카메라 몸체와 회전 손잡이 조작', '어디에서 무엇을 바라볼지 선택'],
    ['92–106초', '생성 전 확인: 누락 확인, 생성 클릭', '만들기 전에 조건을 읽고 검토'],
    ['106–122초', '시안과 저장 도면 비교 → 한 조건 수정', '결과를 직접 확인하고 필요한 부분만 수정'],
    ['122–130초', '검토된 시안·승인·내보내기, 서비스명', '조건을 정리하고 비교하는 공간 연출 도구']]),
   p('실제 대기 구간을 줄일 때는 생성 대기 구간 축약 자막을 넣는다. 사전 제공 샘플을 쓰면 샘플 표시를 유지한다. 도면과 다른 실제 결과를 편집으로 맞는 것처럼 만들거나 비교 성공을 자막으로 단정하지 않는다.'),
   p('실험 제출 방법은 본편에서 길게 다루지 않는다. 참여자용 별도 20초 보충 화면으로 익명 번호·과업 선택 → 기록 시작 → 종료·설문 → ZIP 제출을 보여줄 수 있다.') ]},
 {'id': 'script', 'title': '내레이션과 녹화 준비', 'tag': '촬영용 메모', 'blocks': [
   h('내레이션 초안'),
   p('“여러 참고 이미지에서 마음에 드는 요소를 찾았지만, 어떤 공간에 어떻게 적용할지 설명하기는 쉽지 않습니다. 공간 레퍼런스 해석기는 이 조건을 차례로 정리합니다.”'),
   p('“먼저 기존 공간 사진과 도면을 준비합니다. 유지할 벽과 창, 기둥을 확인하고, 참고 이미지에서 적용할 요소를 선택합니다. 진열대는 바닥에, 그래픽은 벽에, 조명 분위기는 원하는 공간 범위에 연결합니다.”'),
   p('“카메라 위치와 방향을 정한 뒤 생성 전 확인에서 조건을 읽어봅니다. 선택한 시점마다 시안을 만들고, 저장된 도면과 비교합니다. 수정이 필요하면 해당 조건으로 돌아가 바꿀 수 있습니다. 검토한 시안은 승인하고 내보냅니다.”'),
   p('“어떤 이미지를, 어떤 요소로, 어디에 적용할지. 공간 레퍼런스 해석기로 공간 연출의 조건을 정리해 보세요.”'),
   h('녹화 체크리스트'),
   steps(['1920×1080 또는 1440×900, 브라우저 확대율 100%, 알림과 개인 정보가 없는 전용 프로젝트를 사용한다. 자료 이름은 실제 화면에서 읽을 수 있게 짧게 정리한다.', '한 장면에 한 조작을 보여주고 클릭 후 1초 정도 멈춘다. 편집 확대가 필요하면 원본 화면 비율을 유지한다. 클릭 강조 효과는 버튼/도형을 가리지 않게 작게 사용한다.', '처음 자료, 잠금, 레퍼런스 선택, 위치 연결, 시점, 검토, 시안 비교의 순서로 촬영한다. 성공 화면뿐 아니라 동선 침범을 거절하고 정상 위치로 옮기는 짧은 장면을 한 번 넣을 수 있다.', '생성 장면은 실제 생성 기록과 연결된 결과를 쓴다. 모델 실행 전 비용·한도를 확인한다. 승인 버튼은 검토한 결과에서만 누른다.', '공개 전 자막·단계 이름·버튼 이름을 배포 화면과 맞춘다. 정확한 치수·구조 재현이나 연구 효과를 검증 없이 홍보 문구로 쓰지 않는다.']),
   h('녹화 시작 조건'),
   p('기능 QA, 현재 공개 가이드와 버튼명, 실제 시안의 수동 검토가 끝난 버전을 촬영한다. “완성된 버전”이라는 가정은 구성의 기준이며, 현재 남은 생성 품질 문제를 해결됐다고 표현하는 근거가 아니다.') ]},
]

pdfmetrics.registerFont(TTFont('Guide', str(ROOT / 'Paperlogy/Paperlogy-4Regular.ttf')))
pdfmetrics.registerFont(TTFont('GuideBold', str(ROOT / 'Paperlogy/Paperlogy-7Bold.ttf')))
styles = {
 'title': ParagraphStyle('title', fontName='GuideBold', fontSize=22, leading=31, textColor=colors.HexColor(INK), spaceAfter=18, wordWrap='CJK'),
 'h': ParagraphStyle('h', fontName='GuideBold', fontSize=12, leading=18, textColor=colors.HexColor(INK), spaceBefore=13, spaceAfter=6, wordWrap='CJK', keepWithNext=True),
 'p': ParagraphStyle('p', fontName='Guide', fontSize=10, leading=16, textColor=colors.HexColor(INK), spaceAfter=9, wordWrap='CJK'),
 'cell': ParagraphStyle('cell', fontName='Guide', fontSize=9, leading=14, textColor=colors.HexColor(INK), wordWrap='CJK'),
 'head': ParagraphStyle('head', fontName='GuideBold', fontSize=9, leading=14, textColor=colors.HexColor(INK), wordWrap='CJK'),
 'tag': ParagraphStyle('tag', fontName='GuideBold', fontSize=9, leading=14, textColor=colors.HexColor(ACCENT), spaceAfter=9, wordWrap='CJK'),
}
def para(text, style='p'): return Paragraph(escape(text), styles[style])
def render_block(block, width):
    typ = block['type']
    if typ in ['p', 'h']: return [para(block['text'], typ)]
    if typ == 'note':
        box = Table([[para(block['text'])]], colWidths=[width])
        box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor(TINT)),('BOX',(0,0),(-1,-1),.5,colors.HexColor(LINE)),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
        return [box, Spacer(1,9)]
    if typ == 'steps': return [para(f'{i+1}. {text}') for i,text in enumerate(block['items'])]
    if typ == 'table':
        count = len(block['head'])
        widths = [width*.26,width*.74] if count == 2 else [width*.19,width*.37,width*.44]
        data = [[para(text,'head') for text in block['head']]] + [[para(text,'cell') for text in row] for row in block['rows']]
        t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(TINT)),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.5,colors.HexColor(LINE)),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
        return [t,Spacer(1,10)]
    raise ValueError(typ)

def make_pdf(name,pages):
    out=OUT/name
    doc=SimpleDocTemplate(str(out),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=54,bottomMargin=46,title=name.removesuffix('.pdf'),author='공간 레퍼런스 해석기')
    def footer(canvas,doc):
        canvas.setFillColor(colors.HexColor(MUTED));canvas.setFont('Guide',8)
        canvas.drawString(44,A4[1]-30,'공간 레퍼런스 해석기  /  2026.09.29')
        canvas.drawRightString(A4[0]-44,25,f'{doc.page}')
        canvas.setStrokeColor(colors.HexColor(LINE));canvas.line(44,40,A4[0]-44,40)
    story=[]
    for i,page in enumerate(pages):
        if i: story.append(PageBreak())
        story += [para(page['tag'],'tag'),para(page['title'],'title')]
        for block in page['blocks']:story += render_block(block,A4[0]-88)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return out

def html_block(block):
    typ=block['type']
    if typ in ['p','h','note']:
        tag='h3' if typ=='h' else 'p'
        return f'<{tag}'+(' class="note"' if typ=='note' else '')+'>'+escape(block['text'])+f'</{tag}>'
    if typ=='steps':return '<ol>'+''.join('<li>'+escape(x)+'</li>' for x in block['items'])+'</ol>'
    return '<div class="table-scroll"><table><thead><tr>'+''.join('<th scope="col">'+escape(x)+'</th>' for x in block['head'])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+escape(x)+'</td>' for x in row)+'</tr>' for row in block['rows'])+'</tbody></table></div>'

def markdown(pages):
    result=[]
    for page in pages:
        result += ['# '+page['title'],'',page['tag'],'']
        for block in page['blocks']:
            if block['type']=='h':result += ['## '+block['text'],'']
            elif block['type'] in ['p','note']:result += [block['text'],'']
            elif block['type']=='steps':result += [f'{i+1}. {x}' for i,x in enumerate(block['items'])]+['']
            else:result += ['| '+' | '.join(block['head'])+' |','| '+' | '.join(['---']*len(block['head']))+' |']+['| '+' | '.join(row)+' |' for row in block['rows']]+['']
    return '\n'.join(result)

participant_path=make_pdf('서비스_사용_실험_참여_가이드.pdf',participant)
operator_path=make_pdf('실험_진행_및_소개영상_구성안.pdf',operator)
shutil.copyfile(participant_path,PUBLIC/'user-guide.pdf')
(ROOT/'docs/USER_GUIDE.md').write_text(markdown(participant),encoding='utf-8')
(ROOT/'docs/EXPERIMENT_RUNBOOK_AND_VIDEO.md').write_text(markdown(operator),encoding='utf-8')
html='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>사용·실험 참여 가이드 | 공간 레퍼런스 해석기</title><link rel="icon" href="/brand/mark.svg"><link rel="stylesheet" href="guide.css"></head><body><header><a class="identity" href="/"><img src="/brand/mark.svg" alt="" width="30" height="30">공간 레퍼런스 해석기</a><a class="download" href="user-guide.pdf" download>가이드 PDF 받기</a></header><div class="layout"><nav aria-label="가이드 목차"><strong>사용 가이드</strong>'''+''.join(f'<a href="#{page["id"]}">{escape(page["title"])}</a>' for page in participant)+'''<p>가이드는 새 탭에서 열립니다.<br>작업 탭으로 돌아가 계속하세요.</p></nav><main>'''+''.join(f'<section id="{page["id"]}"><p class="eyebrow">{escape(page["tag"])}</p><h1>{escape(page["title"])}</h1>'+''.join(html_block(block) for block in page['blocks'])+'</section>' for page in participant)+'''</main></div><footer>2026.09.29 · 프로젝트와 실험 기록은 현재 브라우저에 저장됩니다.</footer></body></html>'''
(PUBLIC/'index.html').write_text(html,encoding='utf-8')
css=f''':root{{--ink:{INK};--muted:{MUTED};--line:{LINE};--accent:{ACCENT};--tint:{TINT};--paper:{token('neutral-white')};--workspace:{token('neutral-50')};}}\n'''+'''
*{box-sizing:border-box}html{scroll-padding-top:90px}body{margin:0;color:var(--ink);background:var(--workspace);font:16px/1.8 "Noto Sans KR",system-ui,sans-serif}a{color:var(--accent);text-underline-offset:3px}a:focus:not(:focus-visible){outline:none}a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 32px;border-bottom:1px solid var(--line);background:var(--paper);position:sticky;top:0;z-index:2}.identity{display:flex;align-items:center;gap:12px;font-weight:700;text-decoration:none;color:var(--ink);font-size:16px}.download{padding:8px 16px;border:1px solid var(--line);border-radius:12px;min-height:44px;white-space:nowrap;font-size:14px}.layout{display:grid;grid-template-columns:240px minmax(0,780px);gap:32px;max-width:1120px;margin:32px auto;padding:0 24px}nav{position:sticky;top:110px;align-self:start;font-size:14px}nav strong{display:block;margin-bottom:16px}nav a{display:block;padding:10px 0;text-decoration:none}nav a:hover{text-decoration:underline}nav p{color:var(--muted);font-size:12px;margin-top:24px}main{min-width:0}section{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:32px;margin-bottom:24px;scroll-margin-top:16px}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;margin:0 0 8px}h1{font-size:26px;line-height:1.5;margin:0 0 24px;word-break:keep-all}h3{font-size:18px;margin:24px 0 8px}p{margin:0 0 16px;overflow-wrap:anywhere}.note{background:var(--tint);border-radius:8px;padding:16px}ol{padding-left:24px}li{margin-bottom:12px}.table-scroll{overflow:auto;margin:16px 0}table{border-collapse:collapse;width:100%;font-size:14px;min-width:380px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:12px}th{background:var(--tint)}td:first-child{width:27%;font-weight:600}footer{max-width:1120px;margin:auto;padding:16px 24px 40px;color:var(--muted);font-size:12px}@media(max-width:800px){.layout{display:block;margin-top:16px;padding:0 16px}nav{position:static;margin-bottom:20px}nav a{padding:6px 0}nav p{display:none}section{padding:20px}header{padding:12px 16px;flex-wrap:wrap}.identity{font-size:14px}h1{font-size:22px}}@media(print){header,nav,footer{display:none}.layout{display:block;margin:0;padding:0}body{background:var(--paper)}section{border:0;padding:0;break-before:page}.table-scroll{overflow:visible}table{min-width:0}}
'''
(PUBLIC/'guide.css').write_text(css,encoding='utf-8')
print(json.dumps({'pdfs':[str(participant_path),str(operator_path)],'public':'/guide/index.html'},ensure_ascii=False))
