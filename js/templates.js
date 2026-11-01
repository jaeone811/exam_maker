/* =========================================================
   시험지 틀(템플릿)과 예시 문항
   ========================================================= */
(function (global) {
  "use strict";

  let seq = 0;
  const uid = (p) => (p || "q") + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

  function q(over) {
    return Object.assign(
      { id: uid("q"), type: "mc", points: 3, text: "", choices: ["", "", "", "", ""], answer: "", solution: "", breakBefore: "", slots: "", images: {} },
      over || {}
    );
  }
  function sec(over) {
    return Object.assign({ id: uid("s"), name: "공통", subtitle: "", startNo: "", restartPage: true, include: true, questions: [] }, over || {});
  }

  const baseMeta = {
    examTitle: "2027학년도 대학수학능력시험 6월 모의평가 문제지",
    period: "제 2 교시",
    subject: "수학 영역",
    typeMark: "",
    showNameRow: false,
    idDigits: 8,
    idDash: 0,
    showSelectBox: false,
    layout: "slots",
    slotsPerCol: 2,
    flowGap: 7,
    justify: true,
    fontSize: 8.5,
    lineHeight: 1.85,
    paper: "A4",
    showTwoPoint: true,
    autoTypeLabel: true,
    mcLabel: "5지선다형",
    shortLabel: "단답형",
    bigInline: true,
    showNotice: true,
    answerPage: true,
    solutionPages: false,
  };

  /** 수능/평가원 수학 배점 구조 (2022~2027학년도 체제: 공통 22 + 선택 8) */
  function mathCommonSkeleton() {
    const pts = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 3, 17: 3, 18: 3, 19: 3, 20: 4, 21: 4, 22: 4 };
    const list = [];
    for (let n = 1; n <= 22; n++) list.push(q({ type: n <= 15 ? "mc" : "short", points: pts[n] }));
    return list;
  }
  function mathElectiveSkeleton() {
    const pts = { 23: 2, 24: 3, 25: 3, 26: 3, 27: 3, 28: 4, 29: 4, 30: 4 };
    const list = [];
    for (let n = 23; n <= 30; n++) list.push(q({ type: n <= 28 ? "mc" : "short", points: pts[n] }));
    return list;
  }

  /* ---------- 예시 문항 (직접 만든 연습용 문항) ---------- */
  function sampleMath() {
    const common = [
      q({ points: 2, text: "$\\sqrt[3]{8}\\times 9^{\\frac{1}{2}}$의 값은?", choices: ["$2$", "$4$", "$6$", "$8$", "$10$"], answer: 3, solution: "$\\sqrt[3]{8}=2$, $9^{\\frac{1}{2}}=3$ 이므로 $2\\times 3=6$" }),
      q({
        points: 2,
        text: "함수 $f(x)=x^3-3x+1$에 대하여 $\\lim_{h\\to 0}\\frac{f(2+h)-f(2)}{h}$의 값은?",
        choices: ["$5$", "$7$", "$9$", "$11$", "$13$"],
        answer: 3,
        solution: "$f'(x)=3x^2-3$ 이므로 구하는 값은 $f'(2)=9$",
      }),
      q({
        points: 3,
        text: "첫째항이 $3$이고 공차가 $2$인 등차수열 $\\{a_n\\}$에 대하여 $\\sum_{k=1}^{10}a_k$의 값은?",
        choices: ["$110$", "$120$", "$130$", "$140$", "$150$"],
        answer: 2,
        solution: "$\\sum_{k=1}^{10}a_k=\\frac{10\\{2\\times 3+9\\times 2\\}}{2}=120$",
      }),
      q({
        points: 3,
        text: "$\\cos\\theta<0$이고 $\\sin\\theta=\\frac{3}{5}$일 때, $\\tan\\theta$의 값은?",
        choices: ["$-\\frac{4}{3}$", "$-\\frac{3}{4}$", "$0$", "$\\frac{3}{4}$", "$\\frac{4}{3}$"],
        answer: 2,
        solution: "$\\cos\\theta=-\\frac{4}{5}$ 이므로 $\\tan\\theta=-\\frac{3}{4}$",
      }),
      q({
        points: 4,
        text: "함수 $f(x)=|x-1|$에 대하여 <보기>에서 옳은 것만을 있는 대로 고른 것은?\n[보기]\nㄱ. 함수 $f(x)$는 $x=1$에서 연속이다.\nㄴ. 함수 $f(x)$는 $x=1$에서 미분가능하다.\nㄷ. 모든 실수 $x$에 대하여 $f(x)\\ge 0$이다.\n[/보기]",
        choices: ["ㄱ", "ㄴ", "ㄱ, ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"],
        answer: 3,
        solution: "ㄱ. 참\nㄴ. 좌미분계수 $-1$, 우미분계수 $1$ 이므로 거짓\nㄷ. 절댓값이므로 참",
      }),
      q({
        type: "short",
        points: 3,
        text: "부등식 $\\log_2(x-1)<3$을 만족시키는 모든 자연수 $x$의 개수를 구하시오.",
        answer: "7",
        solution: "$1<x<9$ 이므로 $x=2,3,\\cdots,8$ 의 $7$개",
      }),
      q({
        type: "short",
        points: 3,
        text: "$\\int_{0}^{2}(3x^2+2x)\\,dx$의 값을 구하시오.",
        answer: "12",
        solution: "$\\left[x^3+x^2\\right]_0^2=8+4=12$",
      }),
      q({
        type: "short",
        points: 4,
        text: "최고차항의 계수가 $1$인 이차함수 $f(x)$가 다음 조건을 만족시킬 때, $f(4)$의 값을 구하시오.\n[조건]\n(가) $f(1)=f(3)$\n(나) $f(0)=5$\n[/조건]",
        answer: "5",
        solution: "(가)에서 대칭축이 $x=2$ 이므로 $f(x)=(x-2)^2+c$\n(나)에서 $4+c=5$, $c=1$\n따라서 $f(4)=4+1=5$",
      }),
    ];
    const prob = [
      q({ points: 2, text: "$5$개의 문자 $a$, $a$, $b$, $b$, $c$를 모두 일렬로 나열하는 경우의 수는?", choices: ["$20$", "$24$", "$30$", "$36$", "$40$"], answer: 3, solution: "$\\frac{5!}{2!\\,2!}=30$" }),
      q({
        points: 3,
        text: "이산확률변수 $X$의 확률분포를 표로 나타내면 다음과 같다.\n[표]\n!$X$ | $0$ | $1$ | $2$ | !합계\n!$\\mathrm{P}(X=x)$ | $\\frac{1}{5}$ | $a$ | $\\frac{2}{5}$ | $1$\n[/표]\n$\\mathrm{E}(X)$의 값은?",
        choices: ["$1$", "$\\frac{6}{5}$", "$\\frac{7}{5}$", "$\\frac{8}{5}$", "$\\frac{9}{5}$"],
        answer: 2,
        solution: "$a=\\frac{2}{5}$ 이므로 $\\mathrm{E}(X)=\\frac{2}{5}+\\frac{4}{5}=\\frac{6}{5}$",
      }),
      q({
        type: "short",
        points: 4,
        text: "한 개의 주사위를 두 번 던질 때 나오는 눈의 수를 차례로 $a$, $b$라 하자. $a+b=7$일 확률이 $\\frac{q}{p}$일 때, $p+q$의 값을 구하시오.\n(단, $p$와 $q$는 서로소인 자연수이다.)",
        answer: "7",
        solution: "순서쌍 $6$가지, 확률 $\\frac{6}{36}=\\frac{1}{6}$ 이므로 $p+q=7$",
      }),
    ];
    return {
      meta: Object.assign({}, baseMeta, { examTitle: "2027학년도 나만의 모의평가 문제지" }),
      sections: [sec({ name: "공통", questions: common }), sec({ name: "선택", subtitle: "확률과 통계", startNo: 23, questions: prob })],
    };
  }

  function sampleInquiry() {
    const qs = [
      q({
        points: 2,
        text: "다음 자료에 대한 설명으로 옳은 것은?\n[박스 갑국의 연도별 인구 구성]\n[표 머리 전체]\n구분 | 2015년 | 2020년 | 2025년\n유소년 인구 비율(%) | 18 | 15 | 12\n노년 인구 비율(%) | 13 | 16 | 20\n[/표]\n[/박스]",
        choices: [
          "2015년 대비 2025년 유소년 인구 비율은 증가하였다.",
          "2020년 노년 인구 비율은 유소년 인구 비율보다 낮다.",
          "조사 기간 동안 노년 인구 비율은 지속적으로 증가하였다.",
          "2025년 유소년 인구 비율과 노년 인구 비율의 합은 30%이다.",
          "2015년에는 노년 인구 비율이 유소년 인구 비율보다 높다.",
        ],
        answer: 3,
        solution: "노년 인구 비율은 13 → 16 → 20(%)으로 계속 증가하였다.",
      }),
      q({
        points: 3,
        text: "밑줄 친 ㉠~㉢에 대한 설명으로 옳지 __않은__ 것은?\n[박스]\n갑은 ㉠ 시민 단체 활동을 하며 지역 문제를 알렸고, 이후 ㉡ 지방 의회 의원 선거에 출마하였다. 당선된 뒤에는 ㉢ 조례 제정을 통해 공약을 실천하고자 하였다.\n[/박스]",
        choices: [
          "㉠은 사회 문제를 공론화하는 역할을 한다.",
          "㉡은 대표자를 선출하는 절차이다.",
          "㉢은 지방 의회의 권한에 해당한다.",
          "㉠은 정권 획득을 직접적인 목적으로 한다.",
          "㉡과 ㉢은 모두 지방 자치와 관련된다.",
        ],
        answer: 4,
        solution: "정권 획득을 목적으로 하는 집단은 정당이다.",
      }),
      q({
        points: 2,
        text: "(가), (나)에 들어갈 내용으로 옳은 것은?\n[박스]\n교사: 국가 기관 간 견제와 균형을 위한 제도에는 무엇이 있나요?\n학생: 국회는 [[(가)]]을/를 통해 행정부를 견제하고, 법원은 [[(나)]]을/를 통해 행정부를 견제합니다.\n[/박스]",
        choices: [
          "(가) 국정 감사, (나) 명령·규칙 심사",
          "(가) 법률안 거부, (나) 위헌 법률 심판",
          "(가) 국정 감사, (나) 탄핵 심판",
          "(가) 사면, (나) 명령·규칙 심사",
          "(가) 법률안 거부, (나) 탄핵 소추",
        ],
        answer: 1,
        solution: "국회는 국정 감사·조사, 법원은 명령·규칙·처분 심사로 행정부를 견제한다.",
      }),
    ];
    for (let k = qs.length; k < 20; k++) qs.push(q({ points: k % 2 ? 3 : 2 }));
    return {
      meta: Object.assign({}, baseMeta, {
        examTitle: "2027학년도 6월 고3 전국연합학력평가 문제지",
        period: "제 4 교시",
        subject: "사회탐구 영역",
        showNameRow: true,
        showSelectBox: true,
        layout: "flow",
        fontSize: 8.5,
        lineHeight: 1.62,
        showTwoPoint: false,
        autoTypeLabel: false,
        bigInline: false,
        flowGap: 7,
      }),
      sections: [sec({ name: "과목", subtitle: "정치와 법", questions: qs })],
    };
  }

  const TEMPLATES = [
    { id: "sample-math", name: "예시: 수학 (공통+확통, 문항 채워짐)", desc: "기능 확인용 예시 시험지. 바로 인쇄해 볼 수 있음", make: sampleMath },
    {
      id: "math-full",
      name: "수학 30문항 (공통 22 + 선택 8)",
      desc: "평가원 수학 배점 그대로: 1~15 객관식, 16~22 단답형, 23~28 객관식, 29~30 단답형",
      make: () => ({
        meta: Object.assign({}, baseMeta),
        sections: [
          sec({ name: "공통", questions: mathCommonSkeleton() }),
          sec({ name: "선택", subtitle: "확률과 통계", startNo: 23, questions: mathElectiveSkeleton() }),
          sec({ name: "선택", subtitle: "미적분", startNo: 23, questions: mathElectiveSkeleton() }),
          sec({ name: "선택", subtitle: "기하", startNo: 23, questions: mathElectiveSkeleton() }),
        ],
      }),
    },
    {
      id: "math-single",
      name: "수학 30문항 (선택과목 없음)",
      desc: "1~21 객관식, 22~30 단답형 한 묶음. 학교 시험·자작 모의고사용",
      make: () => {
        const list = [];
        for (let n = 1; n <= 30; n++) list.push(q({ type: n <= 21 ? "mc" : "short", points: n <= 3 ? 2 : n <= 14 || (n >= 22 && n <= 26) ? 3 : 4 }));
        return { meta: Object.assign({}, baseMeta, { examTitle: "나만의 수학 모의고사 문제지" }), sections: [sec({ name: "수학", questions: list })] };
      },
    },
    { id: "sample-inquiry", name: "예시: 탐구 20문항 (학평 스타일)", desc: "성명·수험번호란, 밀집 배치, 자료 박스. 50점 만점", make: sampleInquiry },
    {
      id: "inquiry-blank",
      name: "탐구 20문항 빈 틀",
      desc: "2점 10개 + 3점 10개 = 50점, 4쪽 분량",
      make: () => {
        const d = sampleInquiry();
        d.sections[0].questions = Array.from({ length: 20 }, (_, k) => q({ points: k % 2 ? 3 : 2 }));
        d.sections[0].subtitle = "과목명";
        return d;
      },
    },
    {
      id: "blank",
      name: "빈 시험지",
      desc: "문항 1개부터 직접 시작",
      make: () => ({ meta: Object.assign({}, baseMeta, { examTitle: "모의고사 문제지", subject: "○○ 영역", period: "제 1 교시" }), sections: [sec({ name: "본문", questions: [q()] })] }),
    },
  ];

  function fromTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    const d = t.make();
    return { version: 1, meta: d.meta, sections: d.sections };
  }

  global.ExamTemplates = { TEMPLATES, fromTemplate, newQuestion: q, newSection: sec, uid, baseMeta };
})(window);
