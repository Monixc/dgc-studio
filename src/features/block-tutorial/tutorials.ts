/**
 * 블록 코딩 기본 튜토리얼 데이터.
 * 설명부터 하지 않고 "문제 → 학생 행동 → 실행 결과 → 개념 설명" 순서로 구성한다.
 * 튜토리얼 하나는 하나의 Python 개념을 담당하되, 그 개념을 여러 미션(스텝)에 걸쳐 단계적으로 익힌다.
 * 전체 튜토리얼은 유령 캐릭터가 몬스터와 싸우는 하나의 배틀 스토리로 이어진다.
 * 교사가 문제 관리에서 직접 추가하는 문제 리스트와 달리, 이 콘텐츠는 코드로 고정 관리한다.
 */

export interface TutorialMission {
  id: string;
  /** 상황 설명(이모지 포함 가능) */
  story: string;
  /** 학생이 할 일 한 줄 */
  objective: string;
  /** 항상 보이는 짧은 문법 안내(따옴표 등). 힌트와 달리 클릭 없이 바로 노출 */
  tip?: string;
  /** 작업대 초기 코드. 빈 문자열이면 빈 작업대에서 시작 */
  starterCode: string;
  /** 워크스페이스 락 — 이 미션에서 팔레트에 노출할 블록 id만 지정 */
  allowedBlockIds: string[];
  /** 실행 시 표준입력으로 넣어줄 값(입력 미션용) */
  stdin?: string;
  /** 학생이 오래 멈춰 있을 때 순서대로 보여줄 힌트 */
  hints: string[];
  /** 성공 후 보여줄 개념 설명 */
  explanation: string;
  validate: (ctx: { code: string; output: string }) => boolean;
}

export interface Tutorial {
  id: string;
  title: string;
  concept: string;
  summary: string;
  missions: TutorialMission[];
}

const QUOTE_TIP = '💬 글자(문자열)를 쓸 땐 큰따옴표(" ")로 감싸야 해요. 안 그러면 파이썬이 이름으로 착각해서 오류가 나요. 예: "안녕하세요!"';

function nonEmptyLines(output: string): string[] {
  return output.split("\n").map((l) => l.trim()).filter(Boolean);
}

export const BLOCK_TUTORIALS: Tutorial[] = [
  {
    id: "print",
    title: "유령을 말하게 하기",
    concept: "print",
    summary: "print() 로 화면에 글자를 출력하는 법을 배웁니다.",
    missions: [
      {
        id: "print-1",
        story: "유령이 말을 하지 않습니다. 말하게 만들어주세요.",
        objective: '"말하기" 블록을 작업 영역에 놓고, 하고 싶은 말을 적어보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["print"],
        hints: [
          '왼쪽 팔레트의 "말하기" 블록을 작업 영역으로 끌어다 놓아보세요.',
          '블록 안 빈 칸을 눌러서 큰따옴표로 감싼 말을 적어보세요. 예: "안녕하세요!"',
        ],
        explanation:
          '방금 만든 "말하기" 블록은 파이썬에서 print() 라고 부릅니다. print() 는 화면에 글자를 보여주는 명령이에요.',
        validate: ({ code, output }) => code.includes("print(") && output.trim().length > 0,
      },
      {
        id: "print-2",
        story: "이번엔 유령이 인사도 하고 이름도 말했으면 좋겠어요.",
        objective: '"말하기" 블록을 두 개 놓고, 위에는 인사말을, 아래에는 이름을 순서대로 말하게 하세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["print"],
        hints: [
          '"말하기" 블록을 하나 더 끌어다 놓아서 먼저 놓은 블록 아래에 붙여보세요.',
          "코드는 위에서 아래 순서로 실행돼요. 첫 번째 블록이 먼저, 두 번째가 그다음에 나와요.",
        ],
        explanation: "블록을 순서대로 쌓으면 파이썬 코드도 그 순서 그대로 위에서 아래로 실행됩니다.",
        validate: ({ code, output }) => {
          const printCount = (code.match(/print\(/g) ?? []).length;
          return printCount >= 2 && nonEmptyLines(output).length >= 2;
        },
      },
      {
        id: "print-3",
        story: '유령이 신나서 전투 기합 "얍!"을 세 번 외치고 싶어합니다.',
        objective: '"말하기" 블록을 세 개 놓고 모두 "얍!"이라고 적어보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["print"],
        hints: [
          '"말하기" 블록을 세 번 끌어다 놓아보세요.',
          '세 블록 모두 "얍!" 을 큰따옴표로 감싸서 적어보세요.',
          "블록 세 개를 일일이 놓는 게 좀 번거롭죠? 이런 반복은 나중에 반복문으로 훨씬 짧게 만드는 법을 배워요.",
        ],
        explanation: "지금처럼 같은 걸 여러 번 반복해서 만드는 건 번거롭습니다. 이 불편함, 나중에 반복문으로 해결해요!",
        validate: ({ code, output }) => {
          const printCount = (code.match(/print\(/g) ?? []).length;
          return printCount >= 3 && nonEmptyLines(output).length >= 3;
        },
      },
    ],
  },
  {
    id: "input",
    title: "용사 이름 물어보기",
    concept: "input",
    summary: "input() 으로 값을 입력받아 화면에 보여주는 법을 배웁니다.",
    missions: [
      {
        id: "input-1",
        story: "유령이 함께 모험할 용사의 이름이 궁금합니다. 이름을 물어보고 그대로 말하게 해주세요.",
        objective: '"입력받기" 블록으로 이름을 받고, "말하기" 블록으로 그 이름을 출력하세요.',
        starterCode: "",
        allowedBlockIds: ["input_stmt", "print", "variable"],
        stdin: "테스트",
        hints: [
          '먼저 오른쪽 "변수" 탭에서 "+ 변수 만들기"로 이름을 담을 상자를 하나 만드세요. 예: name',
          '"입력받기" 블록을 놓고, 방금 만든 상자를 선택하세요.',
          '그 아래 "말하기" 블록을 놓고, 안에 그 상자를 넣어보세요. (따옴표 없이 상자 이름만 적으면 돼요)',
        ],
        explanation:
          '"입력받기"는 파이썬의 input() 입니다. 용사가 답한 값을 상자(변수)에 기억해뒀다가 다시 쓸 수 있어요.',
        validate: ({ code, output }) => code.includes("input(") && output.includes("테스트"),
      },
      {
        id: "input-2",
        story: "이번엔 이름만 말하지 말고, 인사말이랑 같이 말하게 해주세요.",
        objective: '입력받은 이름 앞에 "안녕, " 을 붙여서 "안녕, 철수!" 처럼 말하게 하세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["input_stmt", "operator_add", "print", "variable"],
        stdin: "철수",
        hints: [
          '"변수" 탭에서 이름을 담을 상자(name)와 인사말을 담을 상자(greeting)를 만드세요.',
          '"입력받기"로 name 을 받으세요.',
          '"+" 블록으로 "안녕, " 과 name 을 합쳐서 greeting 에 저장한 다음, "말하기"로 greeting 을 출력하세요.',
        ],
        explanation: "파이썬에서는 문자열끼리 + 로 이어 붙일 수 있어요. 상자에 담긴 값도 그대로 이어 붙일 수 있습니다.",
        validate: ({ code, output }) => code.includes("input(") && output.includes("철수") && output.length > "철수".length,
      },
    ],
  },
  {
    id: "variable",
    title: "공격력 저장하기",
    concept: "variable",
    summary: "값을 변수에 저장하고 계산해서 다시 출력하는 법을 배웁니다.",
    missions: [
      {
        id: "variable-1",
        story: "전투가 시작되면 공격력은 10부터 시작합니다. 공격력을 상자에 저장해주세요.",
        objective: "power 라는 상자를 만들어 10을 넣고, 화면에 출력하세요.",
        starterCode: "",
        allowedBlockIds: ["var_set", "print", "variable"],
        hints: [
          '"변수" 탭에서 "+ 변수 만들기"로 power 라는 상자를 만드세요.',
          '"변수 = 값" 블록으로 power 를 10으로 만들어보세요.',
          '"말하기" 블록으로 power 를 출력해보세요. (따옴표 없이 power 라고만 적으면 상자 안의 값이 나와요)',
        ],
        explanation: "상자(변수)는 값을 기억해뒀다가 나중에 다시 쓸 수 있게 해줍니다. 파이썬에서는 이걸 변수라고 불러요.",
        validate: ({ code, output }) => code.includes("=") && output.trim() === "10",
      },
      {
        id: "variable-2",
        story: "훈련으로 공격력이 강화됐습니다! 상자 안의 값을 바꿔봅시다.",
        objective: "power 에 5를 더한 다음, 바뀐 공격력을 출력하세요.",
        starterCode: "power = 10\n",
        allowedBlockIds: ["var_set", "operator_add", "print", "variable"],
        hints: [
          '"+" 블록으로 power 에 5를 더해서 다시 power 에 저장해보세요.',
          '마지막에 "말하기" 블록으로 power 를 출력해보세요.',
        ],
        explanation: "변수는 이름 그대로 '변하는 값'이에요. 같은 상자에 새 값을 다시 저장하면 이전 값은 사라지고 새 값으로 바뀝니다.",
        validate: ({ code, output }) => code.includes("=") && output.trim() === "15",
      },
    ],
  },
  {
    id: "loop",
    title: "전투 시작! 기합 외치기",
    concept: "for",
    summary: "같은 동작을 여러 번 반복하는 for 문을 배웁니다.",
    missions: [
      {
        id: "loop-1",
        story: '전투에 나서기 전, 기합으로 "파이팅!"을 5번 외치고 싶어합니다.',
        objective: '"말하기" 블록을 5개 놓아서 "파이팅!"을 5번 출력하세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["print"],
        hints: ['"말하기" 블록을 다섯 번 끌어다 놓고, 모두 "파이팅!" 이라고 적어보세요.'],
        explanation:
          '블록 5개를 일일이 놓느라 좀 힘들었죠? 100번 외쳐야 한다면 블록을 100개 놓아야 할까요? 이렇게 "정해진 횟수만큼 반복"해야 할 때 쓰는 도구가 있어요 — 바로 반복문입니다.',
        validate: ({ code, output }) => {
          const printCount = (code.match(/print\(/g) ?? []).length;
          return printCount >= 5 && nonEmptyLines(output).length >= 5;
        },
      },
      {
        id: "loop-2",
        story: "반복문이 어떻게 동작하는지 먼저 눈으로 확인해봅시다.",
        objective:
          "for 반복문을 쓰면 정해진 횟수만큼 블록을 자동으로 반복 실행할 수 있어요. 상자 i 를 0부터 4까지 5번 바꿔가면서, 그때그때 i 값을 출력해보세요.",
        starterCode: "",
        allowedBlockIds: ["for_range", "print", "variable"],
        hints: [
          '"변수" 탭에서 반복하며 쓸 상자를 하나 만드세요. 예: i',
          '"제어" 탭의 "for range" 블록을 놓고, 반복 변수로 i를, 반복 횟수로 5를 넣으세요.',
          'for 블록 안쪽에 "말하기" 블록을 넣고, 안에 i 라고만 적어보세요. (따옴표 없이)',
        ],
        explanation:
          "for 블록은 안쪽 코드를 5번 반복하는 동안 i 값을 0, 1, 2, 3, 4 로 자동으로 바꿔줍니다. 직접 5번 쓰지 않아도 돼요.",
        validate: ({ code, output }) => code.includes("for ") && nonEmptyLines(output).length >= 5,
      },
      {
        id: "loop-3",
        story: '아까 블록 5개를 직접 놓아서 만들었던 "파이팅!" 5번을, 이번엔 for 문 하나로 끝내봅시다.',
        objective: '"파이팅!" 를 5번 반복해서 출력하세요. (이번엔 블록 2개면 충분해요)',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["for_range", "print", "variable"],
        hints: [
          '이전 미션처럼 "변수" 탭에서 i 상자를 만들고, "for range" 블록에 i와 5를 넣으세요.',
          '이번엔 안쪽 "말하기" 블록에 i 대신 "파이팅!" 을 큰따옴표로 감싸서 적어보세요.',
        ],
        explanation: "아까는 블록 5개, 이번엔 for + 말하기 블록 2개로 끝났죠? 반복 횟수가 100번이어도 코드 길이는 그대로예요 — 이게 반복문의 힘입니다.",
        validate: ({ code, output }) => code.includes("for ") && nonEmptyLines(output).length >= 5,
      },
    ],
  },
  {
    id: "while",
    title: "체력이 0 될 때까지 공격하기",
    concept: "while",
    summary: "몇 번 반복할지 미리 정해지지 않았을 때 쓰는 while 반복문을 배웁니다.",
    missions: [
      {
        id: "while-1",
        story: "몬스터 체력이 3입니다. 한 대씩 때릴 때마다 남은 체력을 알려주세요.",
        objective:
          "hp 상자를 3으로 만든 다음, hp에서 1을 뺀 값을 다시 hp에 저장하고 출력하는 과정을 hp가 0이 될 때까지 직접 반복해보세요. (지금은 딱 3번이면 돼요)",
        starterCode: "",
        allowedBlockIds: ["var_set", "print", "variable"],
        hints: [
          '"변수" 탭에서 hp 상자를 만들고 "변수 = 값" 블록으로 3을 넣으세요.',
          '"변수 = 값" 블록을 하나 더 놓고, 값 칸에 hp - 1 이라고 적어서 다시 hp에 저장하세요. 그 아래 "말하기"로 hp를 출력하세요.',
          "이 두 블록(빼고 출력하기)을 hp가 0이 될 때까지 총 3번 반복해서 늘어놓아보세요.",
        ],
        explanation:
          "hp가 3이라 3번이면 됐지만, 몬스터 체력이 몇인지 모른다면 몇 번을 반복해야 할지도 알 수 없겠죠? '조건이 만족할 때까지' 반복하는 도구가 필요해요 — 바로 while 입니다.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          return !code.includes("while") && lines.length >= 3 && lines[lines.length - 1] === "0";
        },
      },
      {
        id: "while-2",
        story: "이제 반복문으로 자동화해봅시다.",
        objective:
          "while을 쓰면 조건이 True인 동안 계속 반복할 수 있어요. hp를 3으로 만들고, hp가 0보다 큰 동안 hp에서 1을 뺀 값을 다시 저장하고 출력하는 걸 반복해보세요.",
        starterCode: "hp = 3\n",
        allowedBlockIds: ["while_loop", "var_set", "compare_gt", "print", "variable"],
        hints: [
          '"제어" 탭의 "while" 블록을 놓고, 조건 칸에 hp > 0 이라고 적어보세요.',
          "while 블록 안쪽에 hp = hp - 1 을 저장하는 블록과, hp를 출력하는 블록을 순서대로 넣으세요.",
        ],
        explanation:
          "while은 조건(hp > 0)이 True인 동안 안쪽 블록을 계속 반복하고, False가 되는 순간 멈춰요. 몇 번 반복할지 미리 세지 않아도 조건이 알아서 끝을 정해줍니다.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          return code.includes("while") && lines.length >= 3 && lines[lines.length - 1] === "0";
        },
      },
      {
        id: "while-3",
        story: "이번엔 공격 횟수도 세어봅시다.",
        objective:
          "while 안에서 상자 값을 계속 늘려가면 반복 횟수를 셀 수 있어요. hp를 5로 시작해서 0이 될 때까지 1씩 빼고, count 상자로 몇 번 공격했는지 세어서 반복이 끝난 뒤 출력하세요.",
        starterCode: "hp = 5\ncount = 0\n",
        allowedBlockIds: ["while_loop", "var_set", "print", "variable"],
        hints: [
          '"while" 블록의 조건 칸에 hp > 0 이라고 적으세요.',
          "while 안쪽에서 hp = hp - 1 과 count = count + 1 을 순서대로 저장하세요.",
          'while 블록 바깥(아래)에 "말하기" 블록을 놓고 count 를 출력하세요.',
        ],
        explanation:
          "count 처럼 반복할 때마다 값을 1씩 늘려가는 상자를 '누적 변수'라고 불러요. while이 몇 번 돌았는지 직접 세지 않아도 count가 대신 세어줍니다.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          return code.includes("while") && code.includes("count") && lines[lines.length - 1] === "5";
        },
      },
    ],
  },
  {
    id: "compare",
    title: "승패 판정하기",
    concept: "if",
    summary: "조건이 맞을 때만 코드를 실행하는 if 문을 배웁니다.",
    missions: [
      {
        id: "compare-1",
        story: "몬스터의 HP가 정말 0이 됐는지, 컴퓨터한테 직접 물어봅시다.",
        objective: "hp 가 0인지 비교한 결과를 그대로 출력하세요. (지금 hp는 0이에요)",
        starterCode: "hp = 0\n",
        allowedBlockIds: ["compare_eq", "print", "variable"],
        hints: [
          '"말하기" 블록을 놓고, 안에 hp == 0 이라고 적어보세요. (연산 탭의 "==" 블록을 끼워도 돼요)',
          "따옴표 없이 적어야 해요 — 지금은 글자가 아니라 '참인지 거짓인지' 그 자체를 물어보는 거예요.",
        ],
        explanation:
          "hp == 0 처럼 비교를 하면 파이썬은 True(참) 또는 False(거짓) 라는 값을 만들어냅니다. if 문은 바로 이 값을 보고 움직여요.",
        validate: ({ code, output }) => !code.includes("if") && output.trim() === "True",
      },
      {
        id: "compare-2",
        story: "이번엔 몬스터가 아직 쓰러지지 않은 상황도 확인해봅시다.",
        objective: "hp 가 0인지 비교한 결과를 그대로 출력하세요. (지금 hp는 3이에요)",
        starterCode: "hp = 3\n",
        allowedBlockIds: ["compare_eq", "print", "variable"],
        hints: ['이전과 똑같이 hp == 0 을 "말하기" 블록에 적어보세요.'],
        explanation:
          "같은 코드인데 hp 값이 다르니 결과도 True에서 False로 바뀌었죠? 이제 이 True/False 에 따라 다른 행동을 하게 만들어봅시다 — 그게 if 입니다.",
        validate: ({ code, output }) => !code.includes("if") && output.trim() === "False",
      },
      {
        id: "compare-3",
        story: "이제 진짜 승패 판정기를 만들어봅시다. 몬스터를 쓰러뜨렸으면 승리를, 아니면 아직임을 알려주세요.",
        objective:
          'if를 쓰면 조건이 True 냐 False 냐에 따라 서로 다른 코드를 실행할 수 있어요. hp 가 0 이면 "승리!", 아니면 "아직이에요" 를 출력해보세요. (지금 hp는 0이에요)',
        tip: QUOTE_TIP,
        starterCode: "hp = 0\n",
        allowedBlockIds: ["if_else", "compare_eq", "print", "variable"],
        hints: [
          '"제어" 탭의 "if / else" 블록을 작업 영역에 놓으세요.',
          "if 옆 조건 칸에 hp == 0 이라고 적어보세요. (지난 미션과 똑같아요)",
          'if 블록 안쪽엔 "말하기"로 "승리!" 를, else 안쪽엔 "말하기"로 "아직이에요" 를 놓아보세요.',
        ],
        explanation:
          "if 는 조건이 True 일 때만, else 는 조건이 False 일 때만 안쪽 블록을 실행합니다. 방금 두 미션에서 본 True/False 가 바로 승패를 가르는 갈림길이에요.",
        validate: ({ code, output }) => code.includes("if") && output.trim() === "승리!",
      },
    ],
  },
  {
    id: "random",
    title: "공격력 랜덤 뽑기",
    concept: "random",
    summary: "random 모듈을 불러와 무작위 값을 만드는 법을 배웁니다.",
    missions: [
      {
        id: "random-1",
        story: "공격력이 매번 똑같이 5로 나가서 전투가 뻔하고 재미없어요.",
        objective: "attack 상자를 만들어 5를 넣고 출력하세요.",
        starterCode: "",
        allowedBlockIds: ["var_set", "print", "variable"],
        hints: [
          '"변수" 탭에서 attack 상자를 만드세요.',
          '"변수 = 값" 블록으로 attack 을 5로 만들어보세요.',
          '"말하기" 블록으로 attack 을 출력해보세요.',
        ],
        explanation:
          "매번 값이 똑같으니 다음 공격력도 미리 다 보이죠? 예측 불가능한 무작위 값을 뽑는 방법을 배워봅시다 — random 모듈입니다.",
        validate: ({ code, output }) => !code.includes("randint") && output.trim() === "5",
      },
      {
        id: "random-2",
        story: "이번엔 공격력을 1~10 사이 무작위 값으로 뽑아봅시다.",
        objective:
          "random 모듈을 불러오면 random.randint(a, b) 로 a부터 b 사이의 무작위 정수를 뽑을 수 있어요. random 모듈을 불러온 다음, attack 상자에 random.randint(1, 10) 결과를 저장하고 출력해보세요.",
        starterCode: "",
        allowedBlockIds: ["ext_import_random", "ext_random_randint", "print", "variable"],
        hints: [
          '"import random" 블록을 가장 위에 놓으세요.',
          '"random.randint(a,b)" 블록으로 attack = random.randint(1, 10) 을 만드세요.',
          '"말하기" 블록으로 attack 을 출력하세요.',
        ],
        explanation:
          "import random 은 파이썬에게 무작위 기능이 담긴 도구 모음(random 모듈)을 가져오라는 뜻이에요. randint(1, 10) 은 1부터 10 사이 정수 중 하나를 무작위로 뽑아줍니다. 실행할 때마다 값이 달라져요.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          const last = lines[lines.length - 1] ?? "";
          return code.includes("import random") && code.includes("randint(") && /^\d+$/.test(last);
        },
      },
    ],
  },
  {
    id: "list",
    title: "몬스터 처치 후 아이템 획득하기",
    concept: "list",
    summary: "여러 값을 순서대로 한 상자에 담는 리스트와, 인덱스·반복문으로 다루는 법을 배웁니다.",
    missions: [
      {
        id: "list-1",
        story: "몬스터를 물리치고 아이템을 3개 얻었어요! 포션, 방패, 두루마리예요.",
        objective: "item1, item2, item3 이라는 상자 3개를 각각 만들어서 포션, 방패, 두루마리를 담고, 순서대로 출력해보세요.",
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["var_set", "print", "variable"],
        hints: [
          '"변수" 탭에서 item1, item2, item3 상자를 각각 만드세요.',
          '"변수 = 값" 블록 3개로 각각 "포션", "방패", "두루마리" 를 넣으세요.',
          '"말하기" 블록 3개로 순서대로 출력하세요.',
        ],
        explanation: "아이템이 100개면 상자를 100개 만들어야 할까요? 값 여러 개를 상자 하나에 순서대로 담는 방법이 있어요 — 바로 리스트입니다.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          return !code.includes("[") && lines.includes("포션") && lines.includes("방패") && lines.includes("두루마리");
        },
      },
      {
        id: "list-2",
        story: "이번엔 세 아이템을 가방(상자) 하나에 담아봅시다.",
        objective:
          '리스트를 쓰면 여러 값을 상자 하나에 순서대로 담을 수 있어요. bag 이라는 상자를 만들고 ["포션", "방패", "두루마리"] 를 통째로 담은 다음, bag 을 그대로 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["list_empty", "print", "variable"],
        hints: [
          '"리스트" 탭의 "[ ... ]" 블록을 놓고, 왼쪽 상자 이름엔 bag, 오른쪽 칸엔 대괄호를 포함해서 ["포션", "방패", "두루마리"] 라고 통째로 적어보세요.',
          '"말하기" 블록에 bag 을 따옴표 없이 적어서 출력해보세요.',
        ],
        explanation: "리스트 하나에 여러 값이 순서대로 들어갔죠? 출력해보면 대괄호와 함께 안의 값들이 전부 보여요.",
        validate: ({ code, output }) => code.includes("[") && output.includes("포션") && output.includes("방패") && output.includes("두루마리"),
      },
      {
        id: "list-3",
        story: "이번엔 가방에서 아이템 하나만 콕 집어서 확인해봅시다.",
        objective:
          "리스트의 각 값은 0번부터 시작하는 번호(인덱스)로 꺼낼 수 있어요. bag 리스트에서 인덱스 1번(두 번째 아이템)을 꺼내서 출력해보세요.",
        starterCode: 'bag = ["포션", "방패", "두루마리"]\n',
        allowedBlockIds: ["subscript_get", "print", "variable"],
        hints: [
          '"리스트" 탭의 "[i] 읽기" 블록을 놓으세요.',
          "상자 이름 칸엔 bag, 번호 칸엔 1 을 적어보세요. (첫 번째는 0번이에요)",
          '결과를 담을 상자 이름(예: picked)을 하나 만들고, "말하기"로 출력해보세요.',
        ],
        explanation: "인덱스는 0부터 시작해서 bag[0]은 포션, bag[1]은 방패예요. 순서만 알면 원하는 값을 바로 꺼낼 수 있어요.",
        validate: ({ code, output }) => /\[\s*1\s*\]/.test(code) && output.trim() === "방패",
      },
      {
        id: "list-4",
        story: "이번엔 하나씩 꺼내지 말고, 가방 전체를 한 번에 확인해봅시다.",
        objective:
          "for와 len()을 함께 쓰면 리스트 안 모든 값을 자동으로 꺼내서 쓸 수 있어요. len()으로 bag의 아이템 수를 구하고, 그 수만큼 for로 반복하면서 각 인덱스의 아이템을 하나씩 출력해보세요.",
        starterCode: 'bag = ["포션", "방패", "두루마리"]\n',
        allowedBlockIds: ["builtin_len", "for_range", "subscript_get", "print", "variable"],
        hints: [
          '"내장" 탭의 "len()" 블록으로 bag의 길이를 count 같은 상자에 저장하세요.',
          '"for range" 블록에 반복 변수 i, 반복 횟수엔 방금 만든 count 를 넣으세요.',
          'for 안쪽에 "[i] 읽기" 블록으로 bag[i] 를 꺼내서 상자에 담고, "말하기"로 출력하세요.',
        ],
        explanation: "가방이 3개든 300개든, len()과 for를 함께 쓰면 코드를 바꾸지 않고도 전부 처리할 수 있어요.",
        validate: ({ code, output }) => code.includes("for ") && code.includes("len(") && nonEmptyLines(output).length >= 3,
      },
      {
        id: "list-5",
        story: "새 아이템을 주웠어요! 가방에 추가해봅시다.",
        objective: 'append를 쓰면 리스트 맨 뒤에 새 값을 추가할 수 있어요. bag 리스트에 "장검" 을 추가한 다음, bag 전체를 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: 'bag = ["포션", "방패", "두루마리"]\n',
        allowedBlockIds: ["list_append", "print", "variable"],
        hints: [
          '"리스트" 탭의 ".append()" 블록에 bag 와 "장검" 을 넣어보세요.',
          '그 아래 "말하기" 블록으로 bag 을 통째로 출력해보세요.',
        ],
        explanation: "append는 리스트 끝에 값 하나를 새로 붙여줘요. 원래 있던 값은 그대로 두고 새 값만 추가됩니다.",
        validate: ({ code, output }) => code.includes(".append(") && output.includes("장검") && output.includes("포션"),
      },
    ],
  },
  {
    id: "dict",
    title: "장비 인벤토리 만들기",
    concept: "dict",
    summary: "이름=값 짝을 하나로 묶어 관리하는 딕셔너리를 배웁니다.",
    missions: [
      {
        id: "dict-1",
        story: "무기와 방어구를 각각 따로 관리해야 합니다.",
        objective:
          'weapons 리스트에 "낡은 검", "긴 창" 을, armors 리스트에 "가죽 갑옷", "강철 갑옷" 을 순서를 맞춰서 각각 만들고, 첫 번째 무기와 방어구를 인덱스로 꺼내서 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["list_empty", "subscript_get", "print", "variable"],
        hints: [
          '"[ ... ]" 블록으로 weapons = ["낡은 검", "긴 창"], armors = ["가죽 갑옷", "강철 갑옷"] 을 각각 만드세요.',
          '"[i] 읽기" 블록으로 weapons[0] 과 armors[0] 을 각각 꺼내서 상자에 담고 출력하세요.',
        ],
        explanation:
          "리스트 두 개를 순서 맞춰 관리하는 건 번거롭고, 순서가 하나라도 어긋나면 무기와 방어구가 뒤바뀌는 실수가 생겨요. 이름=값 짝을 하나로 묶어서 관리하는 방법이 있어요 — 바로 딕셔너리입니다.",
        validate: ({ code, output }) => !code.includes("{") && output.includes("낡은 검") && output.includes("가죽 갑옷"),
      },
      {
        id: "dict-2",
        story: "이제 착용 중인 장비를 딕셔너리 하나에 묶어봅시다.",
        objective:
          '딕셔너리를 쓰면 "키": 값 짝을 하나의 상자에 저장할 수 있어요. equipment 라는 상자를 만들고 {"weapon": "낡은 검", "armor": "가죽 갑옷"} 을 통째로 담은 다음, equipment 를 그대로 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["dict_empty", "print", "variable"],
        hints: [
          '"딕셔너리" 탭의 "{ ... }" 블록을 놓고, 왼쪽 상자 이름엔 equipment, 오른쪽 칸엔 중괄호를 포함해서 {"weapon": "낡은 검", "armor": "가죽 갑옷"} 이라고 통째로 적어보세요.',
          '"말하기" 블록으로 equipment 를 출력해보세요.',
        ],
        explanation: "딕셔너리는 이름표(키)가 붙은 값들을 하나의 상자에 담아요. 출력해보면 중괄호 안에 키와 값이 짝지어 나와요.",
        validate: ({ code, output }) => code.includes("{") && output.includes("낡은 검") && output.includes("가죽 갑옷"),
      },
      {
        id: "dict-3",
        story: "이번엔 착용 중인 무기만 콕 집어서 확인해봅시다.",
        objective: '딕셔너리는 키로 값을 꺼낼 수 있어요. equipment 딕셔너리에서 "weapon" 키의 값을 꺼내서 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: 'equipment = {"weapon": "낡은 검", "armor": "가죽 갑옷"}\n',
        allowedBlockIds: ["subscript_get", "print", "variable"],
        hints: [
          '"[i] 읽기" 블록에 상자 이름 equipment, 번호 칸엔 "weapon" 을 큰따옴표로 감싸서 적어보세요. (리스트의 번호 대신 딕셔너리는 키를 넣어요)',
          '결과를 담을 상자를 만들고 "말하기"로 출력하세요.',
        ],
        explanation: '리스트는 순서(인덱스)로, 딕셔너리는 이름(키)로 값을 꺼내요. equipment["weapon"] 은 "낡은 검"을 돌려줍니다.',
        validate: ({ code, output }) => /\[\s*"weapon"\s*\]/.test(code) && output.trim() === "낡은 검",
      },
      {
        id: "dict-4",
        story: "무기를 강철 검으로 교체해봅시다.",
        objective:
          '[키] = 값 을 쓰면 딕셔너리에 있던 값을 바꿀 수 있어요. equipment 딕셔너리의 "weapon" 값을 "강철 검" 으로 바꾼 다음, equipment 전체를 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: 'equipment = {"weapon": "낡은 검", "armor": "가죽 갑옷"}\n',
        allowedBlockIds: ["dict_set_item", "print", "variable"],
        hints: [
          '"[key] =" 블록에 equipment, 키 칸엔 "weapon", 값 칸엔 "강철 검" 을 큰따옴표로 감싸서 적어보세요.',
          '"말하기" 블록으로 equipment 를 통째로 출력해보세요.',
        ],
        explanation: 'equipment["weapon"] = "강철 검" 처럼 쓰면 딕셔너리에 있던 키 값이 새 값으로 바뀝니다.',
        validate: ({ code, output }) => /\[\s*"weapon"\s*\]\s*=/.test(code) && output.includes("weapon") && output.includes("강철 검"),
      },
    ],
  },
  {
    id: "tuple",
    title: "몬스터 고정 보상 받기",
    concept: "tuple",
    summary: "순서와 구성이 절대 바뀌면 안 되는 값을 담는 튜플을 배웁니다.",
    missions: [
      {
        id: "tuple-1",
        story: "몬스터를 처치하면 항상 같은 보상(아이템, 골드)을 줍니다. 이번 몬스터는 포션과 골드 10을 줘요.",
        objective: "item, gold 라는 상자를 각각 만들어서 포션, 10을 담고 출력하세요.",
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["var_set", "print", "variable"],
        hints: [
          '"변수" 탭에서 item, gold 상자를 각각 만드세요.',
          '"변수 = 값" 블록으로 item 엔 "포션", gold 엔 10 을 넣으세요.',
          '"말하기" 블록 2개로 각각 출력하세요.',
        ],
        explanation:
          "item, gold 를 상자 두 개로 따로 관리하면 어딘가로 넘길 때 두 개를 늘 같이 챙겨야 해서 번거로워요. 이렇게 절대 바뀌면 안 되는 값 묶음을 위한 도구가 있어요 — 바로 튜플입니다.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          return code.includes("=") && lines.includes("포션") && lines.includes("10");
        },
      },
      {
        id: "tuple-2",
        story: "이번엔 보상을 튜플 하나로 묶어봅시다.",
        objective:
          '튜플을 쓰면 여러 값을 순서대로 묶어서 저장할 수 있어요. 리스트와 달리 한 번 만들면 안의 값을 바꿀 수 없어요. reward 라는 상자를 만들고 ("포션", 10) 을 통째로 담은 다음, reward 를 그대로 출력해보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["tuple_init", "print", "variable"],
        hints: [
          '"( ... )" 블록을 놓고, 왼쪽 상자 이름엔 reward, 오른쪽 칸엔 괄호를 포함해서 ("포션", 10) 이라고 통째로 적어보세요.',
          '"말하기" 블록으로 reward 를 출력해보세요.',
        ],
        explanation:
          "튜플은 리스트와 비슷하게 여러 값을 순서대로 담지만, 한 번 만들면 안의 값을 바꿀 수 없어요. 몬스터가 주는 고정 보상처럼 '절대 바뀌면 안 되는 값'을 담을 때 딱이에요.",
        validate: ({ code, output }) => /\(\s*"포션"\s*,\s*10\s*\)/.test(code) && output.includes("포션") && output.includes("10"),
      },
      {
        id: "tuple-3",
        story: "이번엔 보상에서 아이템과 골드를 각각 꺼내봅시다.",
        objective: "reward[0]은 아이템 이름, reward[1]은 골드예요. 각각 상자에 꺼내 담아서 순서대로 출력해보세요.",
        starterCode: 'reward = ("포션", 10)\n',
        allowedBlockIds: ["subscript_get", "print", "variable"],
        hints: [
          '"[i] 읽기" 블록으로 reward[0] 을 꺼내서 상자에 담고 출력하세요.',
          '"[i] 읽기" 블록을 하나 더 놓고 reward[1] 을 꺼내서 상자에 담고 출력하세요.',
        ],
        explanation: "리스트처럼 튜플도 인덱스로 값을 꺼낼 수 있어요. reward[0]은 포션, reward[1]은 10입니다.",
        validate: ({ code, output }) => {
          const lines = nonEmptyLines(output);
          return /\[\s*0\s*\]/.test(code) && /\[\s*1\s*\]/.test(code) && lines.includes("포션") && lines.includes("10");
        },
      },
    ],
  },
  {
    id: "function",
    title: "공격/방어/스킬 함수 만들기",
    concept: "함수",
    summary: "함수 정의·재사용부터 매개변수, 반환값, 가변 매개변수까지 배웁니다.",
    missions: [
      {
        id: "function-1",
        story: '유령이 전투 중에 "공격!"을 세 번 연달아 외쳐야 합니다.',
        objective: '"말하기" 블록을 세 개 놓아서 "공격!"을 세 번 출력하세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["print"],
        hints: ['"말하기" 블록을 세 번 놓고, 모두 "공격!" 이라고 적어보세요.'],
        explanation:
          "전투가 이제 막 시작인데 벌써 블록 3개예요. 공격을 열 번, 스무 번 해야 한다면 어떻게 될까요? 자주 쓰는 동작에 이름을 붙여서 저장해두고, 그 이름만 불러서 재사용하는 방법이 있어요 — 바로 함수입니다.",
        validate: ({ code, output }) => {
          const printCount = (code.match(/print\(/g) ?? []).length;
          return printCount >= 3 && nonEmptyLines(output).length >= 3;
        },
      },
      {
        id: "function-2",
        story: "이번엔 '공격'이라는 동작 자체를 하나로 저장해봅시다.",
        objective:
          '함수를 쓰면 자주 하는 동작에 이름을 붙여두고, 그 이름만 불러서 다시 실행할 수 있어요. "내 블록" 탭에서 attack 이라는 함수를 만들고, 안에 "공격!"을 출력하게 한 다음 한 번 불러보세요.',
        tip: QUOTE_TIP,
        starterCode: "",
        allowedBlockIds: ["def_func", "func_call", "print", "my_blocks"],
        hints: [
          '"내 블록" 탭에서 "+ 함수 만들기"로 attack 이라는 기능을 만들어보세요.',
          '만들어진 블록 안쪽에 "말하기" 블록을 놓고 "공격!" 이라고 적어보세요.',
          '"내 블록" 탭에 생긴 attack 칩을 한 번 눌러서 작업 영역에 불러와보세요.',
        ],
        explanation:
          "방금 만든 건 파이썬의 함수(def)입니다. 동작 하나를 이름 붙여 저장해두고, 그 이름을 부르면 저장된 동작이 실행돼요.",
        validate: ({ code, output }) => code.includes("def ") && nonEmptyLines(output).length >= 1,
      },
      {
        id: "function-3",
        story: '아까 블록 3개를 직접 놓아서 만들었던 "공격!" 세 번을, 이번엔 attack 함수 재사용으로 끝내봅시다.',
        objective: "attack 을 다시 만들지 말고, 세 번 불러서 세 번 출력되게 하세요.",
        starterCode: 'def attack():\n    print("공격!")\n',
        allowedBlockIds: ["def_func", "func_call", "print", "my_blocks"],
        hints: [
          '"내 블록" 탭을 열면 지난번에 만든 attack 칩이 이미 있어요.',
          "그 칩을 세 번 눌러서 작업 영역에 세 번 불러오세요.",
        ],
        explanation:
          "아까는 블록 3개, 이번엔 클릭 3번으로 끝났죠? 함수는 한 번 정의해두면 여러 번 재사용할 수 있다는 게 진짜 힘입니다.",
        validate: ({ code, output }) => code.includes("def ") && nonEmptyLines(output).length >= 3,
      },
      {
        id: "function-4",
        story: "그런데 공격력이 매번 똑같으면 재미없겠죠? 상황마다 다른 공격력을 외치게 해봅시다.",
        objective:
          '매개변수를 쓰면 함수를 부를 때마다 다른 값을 넘겨줄 수 있어요. attack 함수를 만들 때 매개변수 칸에 power 라고 적고, 안에서 power 값을 출력한 다음, attack(10) 처럼 숫자를 넣어 불러보세요.',
        starterCode: "",
        allowedBlockIds: ["def_func", "func_call", "print", "my_blocks"],
        hints: [
          '"+ 함수 만들기"에서 이름은 attack, 매개변수 칸엔 power 라고 적어보세요.',
          '함수 안쪽에 "말하기" 블록을 놓고, 안에 power 라고만 적어보세요. (따옴표 없이 — 매개변수도 상자처럼 값을 담고 있어요)',
          '"내 블록" 탭의 attack 호출 블록을 불러온 다음, 인수 칸에 10 이라고 적어보세요.',
        ],
        explanation:
          "power 는 매개변수예요. 함수를 부를 때 괄호 안에 넣어준 값이 그대로 매개변수에 전달됩니다. 같은 함수라도 부를 때마다 다른 값을 넣어서 다른 결과를 낼 수 있어요.",
        validate: ({ code, output }) => /def\s+\w+\(\s*\w+\s*\)/.test(code) && output.trim() === "10",
      },
      {
        id: "function-5",
        story: "이번엔 필살기로, 공격력을 2배로 계산해서 알려주는 스킬 함수를 만들어봅시다.",
        objective:
          'return을 쓰면 함수가 계산한 결과를 밖으로 돌려줄 수 있어요. power 를 매개변수로 받아 2배로 계산해서 돌려주는 skillAttack 함수를 만들고, 그 결과를 출력해보세요. (power 는 5로 불러보세요)',
        starterCode: "",
        allowedBlockIds: ["def_func", "func_call", "func_return", "operator_mul", "print", "variable", "my_blocks"],
        hints: [
          '"+ 함수 만들기"로 이름은 skillAttack, 매개변수는 power 로 만들어보세요.',
          '함수 안에서 "변수" 탭의 "+ 변수 만들기"로 doubled 상자를 만들고, "연산" 탭의 "×" 블록으로 doubled = power * 2 를 만들어보세요.',
          '"함수" 탭의 "return" 블록으로 doubled 를 돌려주세요.',
          '작업 영역에 "말하기" 블록을 새로 놓고, 안에 skillAttack(5) 라고 직접 적어보세요. 함수가 돌려준 값이 그대로 출력돼요.',
        ],
        explanation:
          "return 은 함수가 계산한 값을 밖으로 돌려줍니다. 그래서 skillAttack(5) 를 print() 안에 바로 넣어서 쓸 수 있어요 — 함수 호출 자체가 마치 값처럼 동작하는 거예요.",
        validate: ({ code, output }) => code.includes("return") && output.trim() === "10",
      },
      {
        id: "function-6",
        story: "이번엔 스킬로 한 번에 여러 몬스터를 공격하고 싶어요. 근데 몇 마리를 공격할지는 매번 다릅니다.",
        objective:
          '가변 매개변수(*가 붙은 매개변수)를 쓰면 함수를 부를 때 값을 몇 개든 원하는 만큼 넘길 수 있어요. attackAll 함수를 만들 때 매개변수 칸에 *targets 라고 적고, 안에서 "공격!" 을 출력하게 한 다음, 대상을 3마리 넣어서 한 번, 1마리만 넣어서 또 한 번 불러보세요.',
        starterCode: "",
        allowedBlockIds: ["def_func", "func_call", "print", "my_blocks"],
        hints: [
          '"+ 함수 만들기"에서 이름은 attackAll, 매개변수 칸엔 *targets 라고 적어보세요. (별표를 꼭 붙여야 해요)',
          '함수 안쪽엔 "말하기" 블록으로 "공격!" 을 출력하세요.',
          'attackAll 호출 블록을 두 번 불러온 다음, 하나는 인수 칸에 "슬라임", "고블린", "드래곤" 을, 다른 하나엔 "슬라임" 하나만 적어보세요. 개수가 달라도 오류 없이 실행돼요.',
        ],
        explanation:
          "가변 매개변수는 값을 몇 개 보내든 다 받아줍니다. 매개변수 하나는 정확히 값 하나만 받지만, *가 붙으면 0개든 10개든 전부 받아서 하나로 묶어줘요.",
        validate: ({ code, output }) => /def\s+\w+\([^)]*\*/.test(code) && nonEmptyLines(output).length >= 2,
      },
      {
        id: "function-7",
        story: "이번엔 몬스터의 공격을 막아내는 방어 함수를 만들어봅시다.",
        objective:
          'defend 함수를 만들 때 매개변수 칸에 power 라고 적고, 안에서 power 에서 5를 뺀 값(실제로 받는 피해)을 계산해서 return 한 다음, defend(20) 을 호출한 결과를 출력해보세요.',
        starterCode: "",
        allowedBlockIds: ["def_func", "func_call", "func_return", "operator_sub", "print", "variable", "my_blocks"],
        hints: [
          '"+ 함수 만들기"로 이름은 defend, 매개변수는 power 로 만들어보세요.',
          '함수 안에서 "변수" 탭의 "+ 변수 만들기"로 reduced 상자를 만들고, "연산" 탭의 "-" 블록으로 reduced = power - 5 를 만들어보세요.',
          '"함수" 탭의 "return" 블록으로 reduced 를 돌려주세요.',
          '작업 영역에 "말하기" 블록을 새로 놓고, 안에 defend(20) 이라고 직접 적어보세요.',
        ],
        explanation:
          "defend 함수는 받은 피해(power)에서 방어력만큼을 미리 깎아서 돌려줘요. 공격(attack), 방어(defend), 스킬(skillAttack)처럼 역할별로 함수를 나눠두면 필요할 때마다 골라 쓸 수 있어요.",
        validate: ({ code, output }) => code.includes("return") && output.trim() === "15",
      },
    ],
  },
];

export function findTutorial(id: string | undefined): Tutorial | undefined {
  return BLOCK_TUTORIALS.find((t) => t.id === id);
}

export function allMissionIds(): string[] {
  return BLOCK_TUTORIALS.flatMap((t) => t.missions.map((m) => m.id));
}
