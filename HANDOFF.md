# HANDOFF — 이지 하네스

## 현재 작업
- **실설치 GUI 스모크 완료** (2026-07-06, M3 머지 직후). 가재코드로 설치→자동 인증→verify→성공 화면까지 실물 관통. 사용자 맥 실변화: bun 1.2.22→1.3.14, gajae-code 0.8.1 설치, gjc 금고에 anthropic·openai-codex 자격증명 가져오기 성공, installed.json에 bun·gajaecode(authDone true) 기록 확인
- 스모크가 잡은 결함 4건 수정 완료 (fix/m3-real-install-smoke 브랜치 → main 머지):
  1. StepStatus 직렬화 snake_case로 터미널 이벤트 유실 (rename_all_fields로 수정)
  2. 터미널 100칸 고정으로 출력 좌우 잘림 (FitAddon + pty_resize 커맨드 + PtyMasterRegistry)
  3. 가재코드 인증 명령이 실존하지 않음 → `gjc setup credentials --yes` + **automatic 인증 패턴 신설** (터미널 아예 안 띄움)
  4. 안내 카드 좁은 칸에서 글자 부서짐(stacked 1열) + 성공 화면이 내부 id 노출(표시 이름 전달)
- 게이트: cargo 56+7 · vitest 34 · clippy 0 · fmt 클린 · build OK

## 다음 스텝
1. M4(플러그인 5종 레시피) 착수. 이월 백로그에 스모크 발견 항목 추가됨 (아래)
2. GitHub 리모트 미등록 (CI 실행하려면 필요) · 레시피 원격 저장소 생성은 M5
- (완료) 서명 개인키 백업: 2026-07-06 Dashlane 보안 메모 "easy-harness recipe signing key"에 저장, dcli 재조회로 sha256 대조 일치 확인. 참고: dcli note 출력엔 개행 1개가 붙으므로 복원 시 개행 제거 후 44자로 저장할 것

## M4 이월 백로그 (스모크 신규 발견 ★ 포함)
- ★ verify가 인증을 실검증 못 함: gjc --smoke-test는 자격증명 없어도 ok. 자격증명 0개 상태에서 `setup credentials --yes`의 종료 코드도 미확인 (실패 안내 경로 없음)
- ★ bun detect가 버전 미검사: 구버전 bun(<1.3.14, gajae-code engines)이어도 detect 통과. 이번엔 "준비물 매회 재설치" 동작이 우연히 업그레이드해줘서 통과했음 — detect에 버전 조건 도입 검토
- ★ 제품 원칙(사용자 확정): 초보 사용자에게 까만 터미널 노출 최소화. browser_login 도구들(codex 등)도 터미널을 기본 숨김/접기 방향으로 재설계 검토
- ★ Success 카피 "첫 인사까지 나눠봤어요"와 실제 verify 내용(모델 호출 아님) 불일치
- 기존: api_key 실사용 시 provideSecret 피드백+SecretForm 초기화 · PTY reader UTF-8 버퍼링+워치독 · Catalog listen 가드 · run_logs 정리 · reqwest 타임아웃+부분파일 정리 · stderr 패턴 매칭 에러 안내 · Dashboard done 이벤트 유실 시 "지우는 중" 고정(N1)

## 핵심 결정/주의
- 인증 패턴 4종: browser_login · api_key · interactive_terminal · **automatic**(무대화형, 터미널 미표시). 가재코드는 automatic
- gjc 0.8.1 실물: login·auth-broker 명령 없음. 인증 = `gjc setup credentials [--yes]` (Claude Code·Codex 자격증명 가져오기). verify = `gjc --smoke-test`(숨은 플래그, 실존 확인)
- PTY 기본 80x24, 프런트 fit 후 pty_resize로 실크기 반영. @xterm/addon-fit 0.11.0 = xterm 6.0.0 짝 (2026-07-06 npm 확인)
- 준비물(bun 등)은 앱 store에 기록 없으면 재설치 흐름을 탄다 (bun.sh 스크립트 재실행 = 사실상 업그레이드)
- Windows 실검증은 M6 VM 스모크. 어긋나면 레시피 원격 갱신으로 수정
- SDD 실행 기록: .superpowers/sdd/progress.md (gitignored) · 계획: docs/superpowers/plans/2026-07-05-easy-harness-m3-real-recipes.md
